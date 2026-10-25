import fs from 'node:fs'

// docs/database.md — bước 7 của chuyển nhà cung cấp: "Đổi DATABASE_URL trong
// backend/.env của máy dev sang DB mới". Chuỗi kết nối Tiger Cloud được lưu ở
// backups/_target-url.txt sau buổi chuyển nhà 06/10/2026; .env dev chưa bao giờ
// được cập nhật nên vẫn trỏ vào DB Render đã hết hạn (mọi query báo
// "Server has closed the connection", test chạy tức chết ở globalSetup).

const target = fs.readFileSync('backups/_target-url.txt', 'utf8').trim()
if (!target.startsWith('postgres')) {
  console.error('File backups/_target-url.txt không chứa chuỗi kết nối Postgres, dừng không sửa .env.')
  process.exit(1)
}
const url = target.includes('/') && target.includes('sslmode=') ? target : target + (target.includes('?') ? '&sslmode=require' : '?sslmode=require')

fs.copyFileSync('.env', '.env.bak-render-dpg')

let env = fs.readFileSync('.env', 'utf8')
env = env.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${url}"`)
fs.writeFileSync('.env', env)
console.log('Đã đổi DATABASE_URL trong .env sang DB Tiger Cloud, host mới:', new URL(url.replace('postgres://', 'postgresql://')).host)
