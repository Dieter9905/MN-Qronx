/**
 * Kích hoạt xác minh tên miền gửi thư bên Mailjet và tự thử lại.
 *
 * Dùng: node scripts/verify-mailjet-domain.mjs [sender-id] [so-lan] [giay-giua-cac-lan]
 *
 * Vì sao cần: Mailjet kiểm tra DNS bằng resolver của họ. Nếu bản ghi TXT mới được
 * thêm, resolver đó có thể còn cache kết quả "không tồn tại" (negative cache) tới
 * hết TTL, nên lần kiểm tra đầu vẫn báo lỗi dù DNS đã đúng. Thử lại định kỳ sẽ ăn.
 *
 * Thành công = không còn lỗi File/DNS và sender chuyển khỏi trạng thái Inactive.
 */
import 'dotenv/config'

const user = process.env.SMTP_USER
const pass = process.env.SMTP_PASS
if (!user || !pass) {
  console.error('\u274c Thiếu SMTP_USER / SMTP_PASS trong backend/.env')
  process.exit(1)
}

const SENDER_ID = process.argv[2] || '6485107452'
const ATTEMPTS = Number(process.argv[3] || 6)
const INTERVAL = Number(process.argv[4] || 90)
const auth = { Authorization: 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64') }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const senderStatus = async () => {
  const res = await fetch(`https://api.mailjet.com/v3/REST/sender/${SENDER_ID}`, { headers: auth })
  const json = await res.json()
  return json.Data?.[0] || {}
}

console.log(`Xác minh tên miền Mailjet — sender ${SENDER_ID}`)
console.log(`Thử tối đa ${ATTEMPTS} lần, cách nhau ${INTERVAL}s\n${'-'.repeat(56)}`)

for (let i = 1; i <= ATTEMPTS; i++) {
  const res = await fetch(`https://api.mailjet.com/v3/REST/sender/${SENDER_ID}/validate`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: '{}',
  })
  const json = await res.json()
  const errs = json.Errors || {}
  const status = await senderStatus()

  if (json.StatusCode >= 400) {
    console.log(`Lần ${i}: \u26a0\ufe0f  Mailjet API trả lỗi ${json.StatusCode} — ${json.ErrorMessage || ''}`)
  } else if (!errs.FileValidationError && !errs.DNSValidationError) {
    console.log(`Lần ${i}: \u2705 KHÔNG CÒN LỖI — sender đang ở trạng thái "${status.Status}"`)
    if (status.Status !== 'Inactive') {
      console.log('\n\u2705 TÊN MIỀN ĐÃ ĐƯỢC XÁC MINH. Giờ có thể gửi thư thật.')
      process.exit(0)
    }
    console.log('   (chưa đổi trạng thái — thử lại lần sau)')
  } else {
    console.log(`Lần ${i}: \u274c chưa thấy bản ghi — ${errs.DNSValidationError || errs.GlobalError || ''}`)
    console.log(`   sender: ${status.Status}`)
  }

  if (i < ATTEMPTS) await sleep(INTERVAL * 1000)
}

console.log('-'.repeat(56))
console.log('Vẫn chưa xác minh được sau các lần thử.')
console.log('Nguyên nhân thường gặp: cache DNS âm phía Mailjet (chờ tới ~1 giờ) —')
console.log('hoặc bản ghi TXT trong DNS chưa đúng tên host/giá trị.')
console.log('Chạy `npm run mail:check` để đối chiếu DNS với yêu cầu của Mailjet.')
process.exit(1)
