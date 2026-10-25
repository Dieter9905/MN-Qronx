// Đổ dữ liệu từ bản sao lưu (scripts/db-dump.mjs) sang một DB Postgres khác.
//
// Vì sao không dùng psql/pg_restore: máy dev không có PostgreSQL client. Cách
// này còn chặt hơn cho việc đổi nhà cung cấp — Postgres tự phân tích JSON về
// đúng kiểu cột (json_populate_recordset), nên ngày giờ, số, enum, bytea, mảng
// không phải đi qua tay Node.
//
// Ba lớp chặn sai sót:
//   1. Mặc định CHẠY THỬ, chỉ in kế hoạch. Phải thêm --apply mới ghi thật.
//   2. Từ chối ghi nếu DB đích đang có dữ liệu (trừ khi --force).
//   3. Sau khi ghi, so TỪNG DÒNG với file sao lưu; lệch là báo đỏ.
//
// Dùng:
//   TARGET_DATABASE_URL="postgres://..." node scripts/db-restore.mjs [thư-mục]
//   ... thêm --apply để ghi thật, --force để cho phép DB đích đã có dữ liệu.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(here, '..')

function loadEnv() {
  const file = path.join(backendDir, '.env')
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (!m || process.env[m[1]] !== undefined) continue
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

loadEnv()

function maskUrl(url) {
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.username}@${u.host}${u.pathname}`
  } catch {
    return '(không đọc được)'
  }
}

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const force = args.includes('--force')
// Làm sạch DB đích rồi ghi lại từ đầu. Dùng cho lần chốt cuối: giữa lúc sao lưu
// và lúc đổi cấu hình, app cũ vẫn ghi được vài dòng vào DB cũ — sao lưu lại rồi
// khôi phục đè lên là cách duy nhất để không mất chúng.
const replace = args.includes('--replace')
const positional = args.filter((a) => !a.startsWith('--'))

const backupsRoot = path.join(backendDir, 'backups')
let backupDir = positional[0]
if (backupDir) {
  backupDir = path.resolve(backendDir, backupDir)
} else {
  const all = fs
    .readdirSync(backupsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(backupsRoot, d.name))
    .sort()
  backupDir = all[all.length - 1]
}

if (!backupDir || !fs.existsSync(path.join(backupDir, '_manifest.json'))) {
  console.error(`Không thấy bản sao lưu ở: ${backupDir}`)
  process.exit(1)
}

const targetUrl = process.env.TARGET_DATABASE_URL
if (!targetUrl) {
  console.error('THIẾU TARGET_DATABASE_URL — đặt chuỗi kết nối của DB mới.')
  console.error('Script cố tình KHÔNG đọc DATABASE_URL: tránh ghi nhầm vào DB đang chạy.')
  process.exit(1)
}

const manifest = JSON.parse(
  fs.readFileSync(path.join(backupDir, '_manifest.json'), 'utf8')
)

// Chặn ghi nhầm vào chính DB nguồn. So cả máy chủ LẪN tên database: cùng máy
// chủ nhưng khác database (VD một DB diễn tập) là hợp lệ.
function dbIdentity(url) {
  try {
    const u = new URL(url)
    return `${u.hostname}:${u.port || 5432}${u.pathname}`
  } catch {
    return url
  }
}

if (dbIdentity(targetUrl) === dbIdentity(manifest.source)) {
  console.error('DB đích trùng đúng DB nguồn. Dừng để không ghi đè chính dữ liệu đang dùng.')
  process.exit(1)
}

const { PrismaClient } = await import('@prisma/client')
const prisma = new PrismaClient({ datasourceUrl: targetUrl })

const tables = Object.keys(manifest.tables)

// Sắp xếp theo khoá ngoại: bảng được tham chiếu phải vào trước.
function insertionOrder(names, foreignKeys) {
  const deps = new Map(names.map((n) => [n, new Set()]))
  for (const fk of foreignKeys) {
    if (deps.has(fk.table) && deps.has(fk.references) && fk.table !== fk.references) {
      deps.get(fk.table).add(fk.references)
    }
  }
  const out = []
  const placed = new Set()
  while (out.length < names.length) {
    const ready = names.filter(
      (n) => !placed.has(n) && [...deps.get(n)].every((d) => placed.has(d))
    )
    if (ready.length === 0) {
      const stuck = names.filter((n) => !placed.has(n))
      throw new Error(`Vòng lặp khoá ngoại ở: ${stuck.join(', ')}`)
    }
    for (const n of ready) {
      out.push(n)
      placed.add(n)
    }
  }
  return out
}

function normalizeRows(rowsText) {
  const rows = JSON.parse(rowsText)
  return rows
    .map((row) =>
      JSON.stringify(
        Object.fromEntries(Object.entries(row).sort(([a], [b]) => a.localeCompare(b)))
      )
    )
    .sort()
}

const quoted = (name) => `"${name}"`

function readRowsSql(table) {
  return `select coalesce(json_agg(t), '[]'::json)::text as data from ${quoted(table)} t`
}

try {
  const [info] = await prisma.$queryRawUnsafe(
    `select current_database() as db, version() as version`
  )
  console.log(`Nguồn sao lưu : ${manifest.source} (${manifest.createdAt})`)
  console.log(`Đích          : ${maskUrl(targetUrl)}`)
  console.log(`Postgres đích : ${info.version.split(',')[0]}`)
  console.log(`Chế độ        : ${apply ? 'GHI THẬT' : 'chạy thử (thêm --apply để ghi)'}\n`)

  // ── 1. Schema đích phải khớp bản sao lưu ────────────────────────────────
  const targetTables = await prisma.$queryRawUnsafe(
    `select table_name as name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'`
  )
  const have = new Set(targetTables.map((t) => t.name))
  const missing = tables.filter((t) => !have.has(t))
  if (missing.length) {
    console.error('DB đích còn thiếu bảng — chạy trước:')
    console.error('  TARGET_DATABASE_URL="..." npx prisma db push --skip-generate')
    console.error(`Thiếu: ${missing.join(', ')}`)
    process.exit(1)
  }

  // So TẬP cột, không so thứ tự cột. DB lâu ngày có cột xếp theo thứ tự được
  // thêm vào, DB dựng mới lại xếp theo schema.prisma — lệch thứ tự là bình
  // thường và vô hại, vì câu lệnh ghi liệt kê tên cột ở cả hai phía.
  let reordered = 0
  for (const table of tables) {
    const cols = await prisma.$queryRawUnsafe(
      `select column_name as name from information_schema.columns
       where table_schema = 'public' and table_name = $1 order by ordinal_position`,
      table
    )
    const expected = manifest.tables[table].columns.map((c) => c.name)
    const actual = cols.map((c) => c.name)
    const missingCols = expected.filter((c) => !actual.includes(c))
    const extraCols = actual.filter((c) => !expected.includes(c))
    if (missingCols.length || extraCols.length) {
      console.error(`Cột của "${table}" không khớp bản sao lưu.`)
      if (missingCols.length) console.error(`  thiếu ở đích  : ${missingCols.join(', ')}`)
      if (extraCols.length) console.error(`  thừa ở đích   : ${extraCols.join(', ')}`)
      console.error('Chạy `npx prisma db push` để đồng bộ schema rồi thử lại.')
      process.exit(1)
    }
    if (expected.join('|') !== actual.join('|')) reordered++
  }
  console.log(
    `✓ Schema đích khớp bản sao lưu (đủ ${tables.length} bảng, đủ cột)` +
      (reordered ? ` — ${reordered} bảng xếp cột khác thứ tự, không ảnh hưởng` : '')
  )

  // ── 2. DB đích phải trống ───────────────────────────────────────────────
  const existing = {}
  let existingTotal = 0
  for (const table of tables) {
    const [{ n }] = await prisma.$queryRawUnsafe(
      `select count(*)::int as n from ${quoted(table)}`
    )
    existing[table] = n
    existingTotal += n
  }
  if (existingTotal > 0 && !force && !replace) {
    console.error(`\nDB đích đã có ${existingTotal} dòng. Dừng lại.`)
    for (const [t, n] of Object.entries(existing)) if (n) console.error(`  ${t}: ${n}`)
    console.error('Muốn ghi đè/thêm, chạy lại với --force.')
    console.error('Muốn xoá sạch rồi ghi lại (lần chốt cuối), chạy lại với --replace.')
    process.exit(1)
  }
  console.log(
    '✓ DB đích ' +
      (existingTotal === 0
        ? 'trống'
        : replace
          ? `sẽ được LÀM SẠCH trước khi ghi (${existingTotal} dòng hiện có)`
          : `đã có ${existingTotal} dòng, ghi thêm vì có --force`)
  )

  const order = insertionOrder(tables, manifest.foreignKeys)
  const totalRows = Object.values(manifest.tables).reduce((s, t) => s + t.rows, 0)
  console.log(`✓ Thứ tự ghi theo khoá ngoại: ${order.length} bảng, ${totalRows} dòng\n`)

  if (!apply) {
    console.log('Kế hoạch (chưa ghi gì):')
    for (const table of order) {
      const n = manifest.tables[table].rows
      if (n) console.log(`  ${table.padEnd(28)} ${n} dòng`)
    }
    console.log('\nChạy lại kèm --apply để ghi thật.')
    process.exit(0)
  }

  // ── 3. Ghi toàn bộ trong MỘT giao dịch: hỏng ở đâu thì không có gì dở dang ──
  await prisma.$transaction(
    async (tx) => {
      if (replace) {
        // Cố ý xoá TOÀN BỘ bảng, không kèm where: đích là DB mới vừa dựng, và
        // giữ lại dòng cũ thì khoá chính sẽ đụng ngay ở bước ghi bên dưới.
        // Thứ tự ngược với lúc ghi — bảng con đi trước bảng cha.
        for (const table of [...order].reverse()) {
          if (!existing[table]) continue
          await tx.$executeRawUnsafe(`delete from ${quoted(table)}`)
          process.stdout.write(`  xoá ${table.padEnd(28)} ${existing[table]}\n`)
        }
        console.log('')
      }

      for (const table of order) {
        const { rows } = manifest.tables[table]
        if (!rows) continue
        const data = fs.readFileSync(path.join(backupDir, `${table}.json`), 'utf8')
        const columns = manifest.tables[table].columns
          .map((c) => quoted(c.name))
          .join(', ')
        const [{ n }] = await tx.$queryRawUnsafe(
          `with inserted as (
             insert into ${quoted(table)} (${columns})
             select ${columns} from json_populate_recordset(null::${quoted(table)}, $1::json)
             returning 1
           ) select count(*)::int as n from inserted`,
          data
        )
        if (n !== rows) throw new Error(`${table}: ghi ${n} dòng, đáng lẽ ${rows}`)
        process.stdout.write(`  ${table.padEnd(28)} ${n}\n`)
      }

      // Sequence phải nhảy qua id lớn nhất, nếu không lần tạo mới tiếp theo sẽ
      // đụng khoá chính đã có. Ưu tiên giá trị sequence thật của nguồn (giữ cả
      // id đã bị xoá, không dùng lại); nguồn chưa dùng thì lấy max(id).
      for (const seq of manifest.sequences) {
        if (!tables.includes(seq.table)) continue
        await tx.$executeRawUnsafe(
          `select setval(
             pg_get_serial_sequence($1, $2),
             greatest(coalesce($3::bigint, (select max(${quoted(seq.column)}) from ${quoted(seq.table)}), 1), 1),
             coalesce($3::bigint, (select max(${quoted(seq.column)}) from ${quoted(seq.table)})) is not null
           )`,
          seq.table,
          seq.column,
          seq.lastValue === null || seq.lastValue === undefined ? null : seq.lastValue
        )
      }
    },
    { timeout: 120_000, maxWait: 15_000 }
  )
  console.log(`\n✓ Đã ghi ${totalRows} dòng vào DB đích`)

  // ── 4. Đối chiếu TỪNG DÒNG với bản sao lưu ─────────────────────────────
  let bad = 0
  for (const table of order) {
    const { rows } = manifest.tables[table]
    if (!rows) continue
    const [{ data }] = await prisma.$queryRawUnsafe(readRowsSql(table))
    const expected = normalizeRows(
      fs.readFileSync(path.join(backupDir, `${table}.json`), 'utf8')
    )
    const actual = normalizeRows(data)
    if (expected.length !== actual.length || expected.some((v, i) => v !== actual[i])) {
      bad++
      console.error(`  LỆCH: ${table} (sao lưu ${expected.length}, đích ${actual.length})`)
    }
  }
  if (bad) {
    console.error(`\nĐỐI CHIẾU THẤT BẠI ở ${bad} bảng — kiểm tra trước khi trỏ app sang DB mới.`)
    process.exitCode = 1
  } else {
    console.log('✓ Đối chiếu từng dòng: DB đích giống hệt bản sao lưu')
  }
} catch (error) {
  console.error('\nKHÔI PHỤC THẤT BẠI:', error.message.split('\n')[0])
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
