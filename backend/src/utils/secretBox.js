// ─── Mã hoá bí mật hai chiều (mật khẩu cổng trường) ───────────────────────
// Mật khẩu tài khoản trường cần ĐỌC LẠI được (mỗi ngày đăng nhập hộ), nên
// không dùng hash. Dùng AES-256-GCM: có IV ngẫu nhiên mỗi lần mã hoá và tag
// xác thực để phát hiện dữ liệu bị sửa. Khoá dẫn xuất từ JWT_SECRET để không
// phải thêm biến môi trường bắt buộc; đổi JWT_SECRET sẽ buộc kết nối lại.
//
// Định dạng lưu: base64(iv).base64(tag).base64(ciphertext)
import crypto from 'node:crypto'
import config from '../config/index.js'

const KEY = crypto.createHash('sha256').update(`${config.jwt.secret}|mnq-school-credentials`).digest()

export function sealSecret(plain) {
  if (typeof plain !== 'string' || !plain) throw new Error('Bí mật rỗng')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.')
}

export function openSecret(sealed) {
  try {
    const [ivB64, tagB64, dataB64] = String(sealed || '').split('.')
    if (!ivB64 || !tagB64 || !dataB64) return null
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivB64, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8')
  } catch {
    // Sai khoá (JWT_SECRET đổi) hoặc dữ liệu hỏng → coi như không có mật khẩu
    return null
  }
}
