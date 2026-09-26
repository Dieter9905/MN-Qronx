import QRCode from 'qrcode'
import ApiError from '../utils/ApiError.js'

/**
 * Tự sinh mã VietQR (chuẩn EMVCo do NAPAS ban hành) và ảnh QR ngay trong backend.
 *
 * Trước đây ảnh QR lấy từ một dịch vụ bên ngoài (img.vietqr.io). Tự sinh thì:
 *  - không phụ thuộc dịch vụ thứ ba (không lo hết hạn, đổi cách trả tiền, chặn IP)
 *  - nhúng thẳng **nội dung chuyển khoản = mã đơn** vào mã nên khách quét là ra
 *    đúng lệnh chuyển khoản có sẵn số tiền + nội dung
 *  - app Android đọc được chuỗi payload để tự vẽ QR
 *
 * Cấu trúc một mã VietQR (mỗi "đối tượng dữ liệu" = ID 2 ký tự + độ dài 2 ký tự + dữ liệu):
 *   00  Payload Format Indicator = "01"
 *   01  Point of Initiation: "12" = dùng một lần (đơn hàng), "11" = dùng lại được
 *   38  Thông tin tài khoản thụ hưởng
 *         00 = "A000000727" (định danh NAPAS)
 *         01 = 00 (BIN ngân hàng) + 01 (số tài khoản)
 *         02 = "QRIBFTTA" (chuyển nhanh vào tài khoản)
 *   53  Tiền tệ = "704" (VND)
 *   54  Số tiền
 *   58  Mã quốc gia = "VN"
 *   59  Tên người thụ hưởng (tuỳ chọn)
 *   60  Thành phố (tuỳ chọn)
 *   62  Thông tin bổ sung → 08 = NỘI DUNG CHUYỂN KHOẢN (chính là mã đơn)
 *   63  "6304" + mã kiểm tra CRC-16/CCITT-FALSE (4 ký tự hex, viết hoa)
 */

const NAPAS_GUID = 'A000000727'
const SERVICE_CODE_ACCOUNT = 'QRIBFTTA' // chuyển nhanh vào tài khoản
const SERVICE_CODE_CARD = 'QRIBFTTC' // chuyển nhanh vào thẻ
const CURRENCY_VND = '704'
const MAX_CONTENT = 25 // giới hạn nội dung chuyển khoản của VietQR

/** Đối tượng dữ liệu: ID + độ dài (2 ký tự, đệm 0) + giá trị. */
export function tlv(id, value) {
  const text = String(value ?? '')
  if (text.length > 99) throw ApiError.badRequest(`Trường ${id} quá dài (tối đa 99 ký tự)`)
  return `${id}${String(text.length).padStart(2, '0')}${text}`
}

/**
 * CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) — đúng thuật toán EMVCo yêu cầu.
 * Kiểm chứng: CRC của chuỗi "123456789" phải là 0x29B1.
 */
export function crc16Ccitt(text) {
  let crc = 0xffff
  const bytes = Buffer.from(String(text), 'utf8')
  for (const byte of bytes) {
    crc ^= byte << 8
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc & 0xffff
}

/** Ghép mã hoàn chỉnh: phần thân + "6304" + CRC. */
export function withChecksum(body) {
  const withoutCrc = `${body}6304`
  const crc = crc16Ccitt(withoutCrc).toString(16).toUpperCase().padStart(4, '0')
  return `${withoutCrc}${crc}`
}

/** Kiểm tra một payload có đúng CRC không (dùng cho test và cho lúc nạp mã có sẵn). */
export function verifyChecksum(payload) {
  const text = String(payload || '')
  if (text.length < 8) return false
  const body = text.slice(0, -4)
  const given = text.slice(-4).toUpperCase()
  return crc16Ccitt(body).toString(16).toUpperCase().padStart(4, '0') === given
}

/**
 * Nội dung chuyển khoản: bỏ dấu, gọn khoảng trắng, cắt theo giới hạn VietQR.
 * Nhiều app ngân hàng hiển thị/ghi nội dung theo kiểu không dấu nên làm sẵn ở đây.
 */
export function normalizeContent(text, max = MAX_CONTENT) {
  const plain = String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^A-Za-z0-9 .\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.slice(0, max)
}

function normalizeBankBin(bin) {
  const text = String(bin || '').trim().toUpperCase()
  if (/^[0-9]{6}$/.test(text)) return text
  return '' // mã viết tắt không dùng được trong QR; nơi gọi phải đổi sang BIN
}

/**
 * Sinh chuỗi payload VietQR cho một đơn hàng.
 *
 * @param {object} params
 * @param {string} params.bankBin        BIN 6 số của ngân hàng (ACB = 970416)
 * @param {string} params.accountNumber  số tài khoản nhận tiền
 * @param {number} [params.amount]       số tiền VND (bỏ trống = khách tự nhập)
 * @param {string} [params.content]      nội dung chuyển khoản (mã đơn)
 * @param {string} [params.merchantName] tên người thụ hưởng (không dấu)
 * @param {string} [params.merchantCity]
 * @param {boolean} [params.oneTime]     true = quét một lần (đơn hàng)
 * @param {'ACCOUNT'|'CARD'} [params.target]
 */
export function buildVietQrPayload({
  bankBin,
  accountNumber,
  amount = 0,
  content = '',
  merchantName = '',
  merchantCity = '',
  oneTime = true,
  target = 'ACCOUNT',
} = {}) {
  const bin = normalizeBankBin(bankBin)
  if (!bin) {
    throw ApiError.badRequest('Cần BIN 6 số của ngân hàng để sinh mã QR (ACB = 970416).')
  }
  const account = String(accountNumber || '').replace(/\s+/g, '')
  if (!/^[0-9]{6,19}$/.test(account)) {
    throw ApiError.badRequest('Số tài khoản phải gồm 6–19 chữ số để sinh mã QR.')
  }

  const consumerId = tlv('00', bin) + tlv('01', account)
  const merchantAccount =
    tlv('00', NAPAS_GUID) + tlv('01', consumerId) + tlv('02', target === 'CARD' ? SERVICE_CODE_CARD : SERVICE_CODE_ACCOUNT)

  let body =
    tlv('00', '01') + // phiên bản dữ liệu
    tlv('01', oneTime ? '12' : '11') + // quét một lần / dùng lại được
    tlv('38', merchantAccount) +
    tlv('53', CURRENCY_VND)

  const money = Math.round(Number(amount) || 0)
  if (money > 0) {
    const moneyText = String(money)
    if (moneyText.length > 13) throw ApiError.badRequest('Số tiền quá lớn để đưa vào mã QR.')
    body += tlv('54', moneyText)
  }

  body += tlv('58', 'VN')

  const name = normalizeContent(merchantName, 50)
  if (name) body += tlv('59', name)
  const city = normalizeContent(merchantCity, 50)
  if (city) body += tlv('60', city)

  const note = normalizeContent(content, MAX_CONTENT)
  if (note) body += tlv('62', tlv('08', note))

  return withChecksum(body)
}

/** Ảnh QR dạng data URL (PNG) — nhúng thẳng vào JSON, không cần endpoint riêng. */
export async function qrPngDataUrl(payload, { width = 480, margin = 1 } = {}) {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin,
    width,
    color: { dark: '#0F172AFF', light: '#FFFFFFFF' },
  })
}

/** Ảnh QR dạng SVG (nhẹ, in đẹp) cho app/kiosk cần vector. */
export async function qrSvg(payload, { margin = 1, width = 480 } = {}) {
  return QRCode.toString(payload, { type: 'svg', margin, width, errorCorrectionLevel: 'M' })
}

/** Sinh payload + ảnh trong một lần gọi. */
export async function buildVietQr(params, imageOptions) {
  const payload = buildVietQrPayload(params)
  return {
    payload,
    imageDataUrl: await qrPngDataUrl(payload, imageOptions),
    imageMime: 'image/png',
    content: normalizeContent(params?.content),
    amount: Math.round(Number(params?.amount) || 0),
  }
}

export default {
  tlv,
  crc16Ccitt,
  withChecksum,
  verifyChecksum,
  normalizeContent,
  buildVietQrPayload,
  buildVietQr,
  qrPngDataUrl,
  qrSvg,
  NAPAS_GUID,
  SERVICE_CODE_ACCOUNT,
  MAX_CONTENT,
}
