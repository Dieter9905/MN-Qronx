// In đúng các cảnh báo react-hooks/exhaustive-deps đang còn trong file JSON lint.
import fs from 'node:fs'
const rows = JSON.parse(fs.readFileSync('lint-now.json', 'utf8'))
for (const row of rows) {
  const path = row.filePath.replace(/\\/g, '/').split('/').slice(-2).join('/')
  for (const m of row.messages) {
    if (m.ruleId === 'react-hooks/exhaustive-deps') console.log(`${path}:${m.line} [sev=${m.severity}] ${m.message}`)
  }
}
