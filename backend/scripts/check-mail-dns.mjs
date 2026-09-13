/**
 * Kiểm tra DNS xác thực email cho tên miền gửi (Mailjet yêu cầu SPF + DKIM).
 *
 * Dùng: node scripts/check-mail-dns.mjs [domain]
 * Mặc định lấy domain từ EMAIL_FROM trong .env, fallback mn-qronx.id.vn.
 *
 * Điểm mạnh: tự gọi Mailjet API (SMTP_USER = API key, SMTP_PASS = secret key)
 * để lấy ĐÚNG tên bản ghi + giá trị cần có, rồi so với DNS thật — nhờ vậy phát
 * hiện được cả trường hợp sai tên host hoặc thiếu 1 ký tự trong giá trị
 * (những lỗi mà mắt thường nhìn ảnh chụp màn hình khó thấy).
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
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim()
const stripDot = (s) => String(s || '').replace(/\.$/, '')

/** Lấy thông tin domain + token xác thực trực tiếp từ Mailjet API. */
const mailjetDomainInfo = async (dom) => {
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!user || !pass) return null
  try {
    const res = await fetch('https://api.mailjet.com/v3/REST/dns?Limit=100', {
      headers: { Authorization: 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64') },
    })
    if (!res.ok) return { error: `Mailjet API trả HTTP ${res.status}` }
    const json = await res.json()
    const hit = (json.Data || []).find((d) => String(d.Domain).toLowerCase() === dom.toLowerCase())
    if (!hit) return { error: `Không thấy domain ${dom} trong tài khoản Mailjet` }
    return hit
  } catch (err) {
    return { error: `Không gọi được Mailjet API: ${err.message}` }
  }
}

console.log(`Kiểm tra DNS xác thực email cho: ${domain}\n${'-'.repeat(56)}`)

const info = await mailjetDomainInfo(domain)
const ownershipHost = info && !info.error && info.OwnerShipTokenRecordName
  ? stripDot(info.OwnerShipTokenRecordName).replace(new RegExp(`\\.${domain}$`), '')
  : (process.env.MAILJET_OWNERSHIP_HOST || 'mailjet._93f3b17d').trim()

const dkimHost = 'mailjet._domainkey'
const [txt, dkimRecs, dmarc, mx, ownership] = await Promise.all([
  dns(domain, 'TXT'),
  dns(`${dkimHost}.${domain}`, 'TXT'),
  dns(`_dmarc.${domain}`, 'TXT'),
  dns(domain, 'MX'),
  dns(`${ownershipHost}.${domain}`, 'TXT'),
])

// --- Xác nhận quyền sở hữu (bước Mailjet yêu cầu đầu tiên) ---
const expectedToken = info && !info.error ? info.OwnerShipToken : null
const gotToken = ownership[0] || null
console.log(`${ok(ownership.length > 0)} Xác nhận sở hữu — host "${ownershipHost}"`)
if (!ownership.length) {
  console.log(`   CHƯA CÓ bản ghi này. Cần thêm TXT: host "${ownershipHost}"${expectedToken ? `, giá trị "${expectedToken}"` : ''}`)
} else if (expectedToken && norm(gotToken) !== norm(expectedToken)) {
  console.log(`   DNS đang có : "${gotToken}" (${gotToken.length} ký tự)`)
  console.log(`   Mailjet cần : "${expectedToken}" (${expectedToken.length} ký tự)`)
  const a = norm(gotToken)
  const b = norm(expectedToken)
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  console.log(`   \u274c SAI GIÁ TRỊ — khác nhau từ ký tự thứ ${i + 1}: DNS có "${a.slice(i, i + 8)}", cần "${b.slice(i, i + 8)}"`)
  console.log('   \u2192 Sửa lại đúng giá trị Mailjet hiện (nên Copy, đừng gõ tay).')
  console.log(`   \u26a0\ufe0f  Đúng host là "${ownershipHost}" — chú ý có DẤU CHẤM giữa "mailjet." và "_".`)
} else {
  console.log(`   Giá trị: ${gotToken} \u2705`)
}

// --- SPF ---
const spf = txt.find((t) => t.toLowerCase().startsWith('v=spf1'))
const spfHasMailjet = Boolean(spf && /mailjet/i.test(spf))
console.log(`${ok(spf)} SPF: ${spf || 'CHƯA CÓ'}`)
if (spf && !spfHasMailjet) console.log('   \u26a0\ufe0f  SPF chưa include:spf.mailjet.com')
if (info && !info.error && info.SPFRecordValue && spf && norm(spf) !== norm(info.SPFRecordValue)) {
  console.log(`   \u2139\ufe0f  Mailjet khuyến nghị: ${info.SPFRecordValue}`)
}

// --- DKIM ---
const dkimJoined = norm(dkimRecs.join(''))
const expectedDkim = info && !info.error ? norm(info.DKIMRecordValue) : null
console.log(`${ok(dkimRecs.length > 0)} DKIM (${dkimHost}): ${dkimRecs.length ? dkimJoined.slice(0, 60) + '\u2026' : 'CHƯA CÓ'}`)
if (expectedDkim && dkimJoined && dkimJoined !== expectedDkim) {
  console.log(`   \u274c Giá trị DKIM trong DNS KHÁC với khoá Mailjet (DNS ${dkimJoined.length} ký tự, Mailjet ${expectedDkim.length} ký tự)`)
}
if (expectedDkim && dkimJoined === expectedDkim) console.log('   Khớp đúng khoá Mailjet \u2705')

// --- DMARC (khuyến nghị, không bắt buộc) ---
const dmarcRec = dmarc.find((t) => t.toLowerCase().startsWith('v=dmarc1'))
console.log(`${ok(dmarcRec)} DMARC (_dmarc): ${dmarcRec || 'chưa có (nên thêm để tăng độ tin cậy)'}`)

// --- MX (chỉ để biết nơi nhận thư của domain) ---
console.log(`\u2139\ufe0f  MX (nhận thư): ${mx.length ? mx.join(', ') : 'không có'}`)

// --- Trạng thái phía Mailjet ---
if (info && !info.error) {
  console.log('-'.repeat(56))
  console.log(`Mailjet báo: SPF = ${info.SPFStatus || '?'} | DKIM = ${info.DKIMStatus || '?'}`
    + (info.LastCheckAt ? ` | lần kiểm tra cuối: ${info.LastCheckAt}` : ''))
  if (info.OwnerShipTokenRecordName) console.log(`Bản ghi sở hữu Mailjet yêu cầu: ${info.OwnerShipTokenRecordName}`)
} else if (info?.error) {
  console.log(`\u2139\ufe0f  Không đọc được dữ liệu Mailjet: ${info.error}`)
}

// --- Kết luận ---
const ownershipOk = Boolean(ownership.length && (!expectedToken || norm(gotToken) === norm(expectedToken)))
const allGood = Boolean(ownershipOk && spf && spfHasMailjet && dkimRecs.length > 0)
console.log('-'.repeat(56))
if (allGood) {
  console.log('Kết quả: DNS ĐÃ ĐỦ để Mailjet xác thực domain \u2705')
  console.log('Bước tiếp theo: Mailjet \u2192 Domains and senders \u2192 bấm Validate/Refresh.')
} else {
  console.log('Kết quả: CÒN SAI/THIẾU bản ghi \u2014 chi tiết cách thêm: docs/email-domain-setup.md')
}
console.log()

// --- Bảng giá trị đúng để copy sang PA Vietnam ---
if (info && !info.error && !allGood) {
  console.log('Bản ghi cần có trong DNS (copy chính xác):')
  console.log(`  1) TXT | host: ${ownershipHost} | value: ${info.OwnerShipToken}`)
  console.log(`  2) TXT | host: @ | value: ${info.SPFRecordValue || 'v=spf1 include:spf.mailjet.com ?all'}`)
  console.log(`  3) TXT | host: ${dkimHost} | value: <bấm Copy trong Mailjet, chuỗi rất dài>`)
  console.log('     (Mailjet \u2192 tab SPF/DKIM Authentication \u2192 biểu tượng \u2699 cạnh tên miền)')
}
process.exitCode = allGood ? 0 : 1
