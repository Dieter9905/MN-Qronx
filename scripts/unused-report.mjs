// Duyệt lint JSON xuất từ `npx eslint src -f json` (đối số 1 là đường dẫn file,
// mặc định lint-after.json) và in gọn từng lỗi theo quy tắc chỉ định.
import fs from 'node:fs'
const rows = JSON.parse(fs.readFileSync(process.argv[2] || 'lint-after.json', 'utf8'))
const wanted = process.argv[3] || 'unused-imports/no-unused-imports'
for (const row of rows) {
  const path = row.filePath.replace(/\\/g, '/').split('/').slice(-2).join('/')
  for (const m of row.messages) {
    if (!wanted || m.ruleId === wanted) {
      console.log(`${path}:${m.line} [${m.ruleId}] ${m.message.split('\n')[0]}`)
    }
  }
}
