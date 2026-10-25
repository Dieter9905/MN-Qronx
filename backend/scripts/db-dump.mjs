// Sao lưu toàn bộ dữ liệu của DATABASE_URL ra JSON.
//
// Vì sao không dùng pg_dump: máy dev không có PostgreSQL client. Nhưng cách này
// còn tốt hơn cho việc di chuyển nhà cung cấp — Postgres tự sinh JSON
// (json_agg) nên ngày giờ, số thập phân, bytea đều ra đúng định dạng chuẩn mà
// json_populate_recordset ăn lại được, không phải tự đoán kiểu ở phía Node.
//
// Dùng:
//   node scripts/db-dump.mjs [thư-mục-ra]
// Mặc định: backups/<thời-điểm>/
//
// Thư mục backups/ nằm trong .gitignore: đây là dữ liệu thật của khách.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(here, '..')

// Prisma Client chỉ tự nạp .env trong một số trường hợp, nạp tay cho chắc.
function loadEnv() {
  const file = path.join(backendDir, '.env')
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (!m) continue
    const key = m[1]
    if (process.env[key] !== undefined) continue
    let value = m[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

loadEnv()

const { PrismaClient } = await import('@prisma/client')

function maskUrl(url) {
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.username}@${u.host}${u.pathname}`
  } catch {
    return '(không đọc được)'
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const outDir = path.resolve(
  backendDir,
  process.argv[2] || path.join('backups', stamp)
)

if (!process.env.DATABASE_URL) {
  console.error('THIẾU DATABASE_URL — kiểm tra backend/.env')
  process.exit(1)
}

fs.mkdirSync(outDir, { recursive: true })
const prisma = new PrismaClient()

try {
  const [source] = await prisma.$queryRawUnsafe(
    `select current_database() as db, version() as version,
            pg_size_pretty(pg_database_size(current_database())) as size`
  )
  console.log(`Nguồn: ${maskUrl(process.env.DATABASE_URL)}`)
  console.log(`DB: ${source.db} · ${source.size} · ${source.version.split(',')[0]}`)

  const tables = await prisma.$queryRawUnsafe(
    `select table_name as name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
     order by table_name`
  )

  const manifest = {
    createdAt: new Date().toISOString(),
    source: maskUrl(process.env.DATABASE_URL),
    database: source.db,
    postgresVersion: source.version,
    tables: {},
    foreignKeys: [],
    sequences: [],
  }

  let total = 0
  for (const { name } of tables) {
    // Tên bảng lấy từ information_schema nên an toàn để nội suy; vẫn bọc nháy kép.
    const [{ data }] = await prisma.$queryRawUnsafe(
      `select coalesce(json_agg(t), '[]'::json)::text as data from "${name}" t`
    )
    const [{ count }] = await prisma.$queryRawUnsafe(
      `select count(*)::int as count from "${name}"`
    )
    fs.writeFileSync(path.join(outDir, `${name}.json`), data, 'utf8')

    const columns = await prisma.$queryRawUnsafe(
      `select column_name as name, data_type as type, is_nullable as nullable,
              column_default as "default"
       from information_schema.columns
       where table_schema = 'public' and table_name = $1
       order by ordinal_position`,
      name
    )
    manifest.tables[name] = { rows: count, columns }
    total += count
    console.log(`  ${name}: ${count} dòng`)
  }

  manifest.foreignKeys = await prisma.$queryRawUnsafe(
    `select tc.table_name as "table", ccu.table_name as "references"
     from information_schema.table_constraints tc
     join information_schema.constraint_column_usage ccu
       on tc.constraint_name = ccu.constraint_name
      and tc.constraint_schema = ccu.constraint_schema
     where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'`
  )

  // Cột nào dùng sequence, và sequence đang ở đâu. Lấy cả last_value chứ không
  // chỉ max(id): nếu không, các id của dòng đã xoá trước đây sẽ được dùng lại ở
  // DB mới. Không mất dữ liệu, nhưng id trùng với id cũ mà máy khách còn giữ là
  // chuyện không đáng có.
  manifest.sequences = await prisma.$queryRawUnsafe(     `select c.relname as "table", a.attname as "column", ps.last_value::text as "lastValue"
     from pg_class s
     join pg_depend d on d.objid = s.oid and d.deptype in ('a', 'i')
     join pg_class c on c.oid = d.refobjid
     join pg_attribute a on a.attrelid = d.refobjid and a.attnum = d.refobjsubid
     left join pg_sequences ps
       on ps.schemaname = 'public' and ps.sequencename = s.relname
     where s.relkind = 'S'
     order by c.relname, a.attname`
  )

  fs.writeFileSync(
    path.join(outDir, '_manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  )

  console.log(`\nXong: ${total} dòng / ${tables.length} bảng`)
  console.log(`Thư mục: ${outDir}`)
} catch (error) {
  console.error('SAO LƯU THẤT BẠI:', error.message)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
