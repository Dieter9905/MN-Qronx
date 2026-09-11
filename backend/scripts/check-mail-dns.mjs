/**
 * Kiểm tra DNS xác thực email cho tên miền gửi (Mailjet yêu cầu SPF + DKIM).
 *
 * Dùng: node scripts/check-mail-dns.mjs [domain]
 * Mặc định lấy domain từ EMAIL_FROM trong .env, fallback mn-qronx.id.vn.
 */
import 'dotenv/config'

const EMAIL_FROM = process.env.EMAIL_FROM || ''
const fromMatch = /<([^>]+)>/.exec(EMAIL_FROM)
const fallbackFrom = (fromMatch ? fromMatch[1] : EMAIL_FROM).split('@')[1]
const FREE_WEBMAIL = ['gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com', 'proton.me', 'protonmail.com']
let domain = (process.argv[2] || fallbackFrom || 'mn-qronx.id.vn').trim()

if (FREE_WEBMAIL.includes(domain.toLowerCase())) {
  console.log(`\n\u26a0\ufe0f  EMAIL_FROM đang dùng webmail miễn phí (${domain}) — KHÔNG thể gắn SPF/DKIM,\n   Mailjet sẽ từ chối. Chuyển sang tên miền riêng, ví dụ no-reply@mn-qronx.id.vn.`)
  console.log('   \u2192 Đang kiểm tra mn-qronx.id.vn để bạn thấy trạng thái thật.\n')
  domain = 'mn-qronx.id.vn'
}

const dns = async (name, type) => {
  const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`)
  const json = await res.json()
  return (json.Answer || []).map((a) => String(a.data).replace(/^"|"$/g, ''))
}

const ok = (b) => (b ? '\u2705' : '\u274c')

console.log(`Kiểm tra DNS xác thực email cho: ${domain}\n${'-'.repeat(50)}`)

const [txt, dkim, dmarc, mx] = await Promise.all([
  dns(domain, 'TXT'),
  dns(`mailjet._domainkey.${domain}`, 'TXT'),
  dns(`_dmarc.${domain}`, 'TXT'),
  dns(domain, 'MX'),
])

// --- SPF ---
const spf = txt.find((t) => t.toLowerCase().startsWith('v=spf1'))
const spfHasMailjet = Boolean(spf && /mailjet/i.test(spf))
console.log(`${ok(spf)} SPF: ${spf || 'CHƯA CÓ'}`)
if (spf && !spfHasMailjet) console.log('   \u26a0\ufe0f  SPF chưa include:spf.mailjet.com')

// --- DKIM ---
console.log(`${ok(dkim.length > 0)} DKIM (mailjet._domainkey): ${dkim.length ? dkim[0].slice(0, 60) + '…' : 'CHƯA CÓ'}`)

// --- DMARC (khuyến nghị, không bắt buộc) ---
const dmarcRec = dmarc.find((t) => t.toLowerCase().startsWith('v=dmarc1'))
console.log(`${ok(dmarcRec)} DMARC (_dmarc): ${dmarcRec || 'chưa có (nên thêm để tăng độ tin cậy)'}`)

// --- MX (chỉ để biết nơi nhận thư của domain) ---
console.log(`\u2139\ufe0f  MX (nhận thư): ${mx.length ? mx.join(', ') : 'không có'}`)

// --- Kết luận ---
const allGood = Boolean(spf && spfHasMailjet && dkim.length > 0)
console.log('-'.repeat(50))
if (allGood) {
  console.log('Kết quả: DNS ĐÃ ĐỦ để Mailjet xác thực domain \u2705')
  console.log('Bước tiếp theo: vào Mailjet \u2192 Sender domains \u2192 bấm Validate/Check.\n')
} else {
  console.log('Kết quả: CÒN THIẾU bản ghi \u2014 chi tiết cách thêm: docs/email-domain-setup.md\n')
}
process.exitCode = allGood ? 0 : 1
