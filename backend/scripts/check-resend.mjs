/**
 * Kiểm tra tên miền gửi đã xác thực với Resend chưa, và in ra CHÍNH XÁC bản ghi
 * DNS cần thêm — có đối chiếu với DNS thật (giống công cụ mail:check của Mailjet,
 * nhờ vậy phát hiện được cả trường hợp gõ thiếu ký tự hoặc sai tên host).
 *
 * Dùng:
 *   node scripts/check-resend.mjs           # chỉ xem trạng thái
 *   node scripts/check-resend.mjs --verify  # yêu cầu Resend kiểm tra lại ngay
 */
import 'dotenv/config'

const KEY = process.env.RESEND_API_KEY
const WANT = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '').trim()
const wantVerify = process.argv.includes('--verify')

const norm = (s) => String(s || '').replace(/\s+/g, ' ').replace(/^"|"$/g, '').trim()
const ok = (b) => (b ? '\u2705' : '\u274c')

const api = async (path, method = 'GET') => {
  const res = await fetch(`https://api.resend.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  })
  const text = await res.text()
  let data = null
  try {
    data = JSON.parse(text)
  } catch {
    data = null
  }
  return { ok: res.ok, status: res.status, data, text }
}

const dnsLookup = async (name, type) => {
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`)
    const json = await res.json()
    return (json.Answer || []).map((a) => String(a.data))
  } catch {
    return []
  }
}

function printHowToGetKey() {
  console.log(`
${ok(false)} Chưa có RESEND_API_KEY trong backend/.env

Cách lấy (khoảng 3 phút):
  1. Vào https://resend.com -> đăng ký bằng Gmail
  2. Menu trái -> "API Keys" -> "Create API Key" (quyền Sending access)
  3. Copy key (bắt đầu bằng "re_") rồi thêm vào backend/.env:

       RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
       RESEND_FROM=MN-Qronx <no-reply@mn-qronx.id.vn>

  4. Thêm tên miền: menu trái -> "Domains" -> "Add Domain" -> nhập send.mn-qronx.id.vn
  5. Chạy lại lệnh này để lấy danh sách bản ghi DNS cần thêm.
`)
}

async function main() {
  if (!KEY) {
    printHowToGetKey()
    return 1
  }

  console.log(`Kiểm tra trạng thái tên miền gửi trên Resend\n${'-'.repeat(56)}`)

  const listed = await api('/domains')
  if (!listed.ok) {
    const msg = String(listed.data?.message || listed.text.slice(0, 200))
    console.log(`${ok(false)} Không gọi được Resend API — HTTP ${listed.status}`)
    console.log(`   ${msg}`)
    if (/api key/i.test(msg)) {
      console.log('   \u2192 RESEND_API_KEY sai hoặc đã bị thu hồi. Lấy key mới ở Resend \u2192 API Keys.')
    }
    return 1
  }

  const domains = listed.data?.data || listed.data || []
  if (!domains.length) {
    console.log(`${ok(false)} Tài khoản Resend chưa có tên miền nào.`)
    console.log('   \u2192 Vào https://resend.com/domains \u2192 Add Domain \u2192 nhập send.mn-qronx.id.vn')
    return 1
  }

  const targets = WANT ? domains.filter((d) => d.name === WANT) : domains
  if (!targets.length) {
    console.log(`${ok(false)} Không thấy tên miền "${WANT}" trong tài khoản Resend.`)
    console.log(`   Đang có: ${domains.map((d) => d.name).join(', ')}`)
    return 1
  }

  let allVerified = true

  for (const dom of targets) {
    if (wantVerify) {
      const v = await api(`/domains/${dom.id}/verify`, 'POST')
      const again = await api(`/domains/${dom.id}`)
      console.log(`\n\u21bb Đã yêu cầu Resend kiểm tra lại "${dom.name}" — HTTP ${v.status}`)
      if (again.ok) Object.assign(dom, again.data)
      else if (v.data) Object.assign(dom, v.data)
    }

    const verified = String(dom.status || '').toLowerCase() === 'verified'
    if (!verified) allVerified = false

    console.log(`\n${ok(verified)} Tên miền: ${dom.name}`)
    console.log(`   Trạng thái Resend : ${dom.status || '(không rõ)'}`)
    if (dom.region) console.log(`   Region            : ${dom.region}`)
    console.log(`   ID                : ${dom.id}`)

    const records = dom.records || []
    if (!records.length) {
      console.log('   (Resend chưa trả về bản ghi nào — mở https://resend.com/domains để xem)')
      continue
    }

    console.log('\n   Bản ghi DNS cần có (thêm tại PA Vietnam):')
    for (const r of records) {
      const host = String(r.name || '').replace(new RegExp(`\\.?${dom.name.replace(/\./g, '\\.')}\\.?$`), '') || '@'
      const val = norm(r.value)
      const recordOk = String(r.status || '').toLowerCase() === 'verified'

      const answers = await dnsLookup(r.name, r.type)
      const found = answers.some((a) => norm(a).includes(val.slice(0, 40)))

      console.log(
        `\n   ${ok(recordOk && found)} ${r.record || r.type}  ·  loại ${r.type}  ·  Resend: ${r.status || '?'}  ·  DNS thật: ${
          found ? 'có' : 'CHƯA CÓ'
        }`
      )
      console.log(`      Nhập tên bản ghi : ${host}`)
      console.log(`      Giá trị          : ${val}${r.type === 'MX' && r.priority ? `  (ưu tiên ${r.priority})` : ''}`)
      if (answers.length && !found) {
        console.log(`      DNS đang có      : ${answers.map((a) => norm(a).slice(0, 70)).join(' | ')}`)
        console.log('      \u26a0\ufe0f  Giá trị khác với Resend yêu cầu — nhiều panel bỏ qua thay đổi khi SỬA;')
        console.log('          hãy XOÁ hẳn bản ghi cũ rồi THÊM LẠI (đây là lỗi đã gặp với Mailjet).')
      }
    }
  }

  if (!allVerified) {
    console.log('\n   \u2192 Thêm/xoá lại đủ bản ghi trên, chờ 5\u201330 phút rồi chạy lại:')
    console.log('      cd backend && npm run mail:resend -- --verify')
    return 1
  }

  console.log('\n   \u2192 Tên miền đã xác thực. Gửi thử: cd backend && npm run mail:send -- <gmail-của-bạn>')
  return 0
}

process.exitCode = await main()
