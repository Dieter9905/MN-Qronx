import { compressImageFile } from './chatImage'

/**
 * Đọc chữ trong ẢNH để biến thành công việc (chụp tờ giấy nhớ, ảnh chụp màn hình,
 * thời khoá biểu, tin nhắn…).
 *
 * Vì sao OCR ngay trên máy chứ không gửi ảnh lên máy chủ:
 * - Ảnh chụp giấy tờ, tin nhắn, lịch học là thứ riêng tư; gửi lên máy chủ nghĩa là
 *   nó phải được lưu ở đâu đó, và app này đang cố KHÔNG lưu ảnh của khách.
 * - AI của MN-Qronx là model tự chạy (xem thư mục `ai/`), chỉ đọc CHỮ, không đọc
 *   ảnh. Muốn đọc ảnh thì phải thêm một dịch vụ nhìn ảnh thuê ngoài — tốn tiền mỗi
 *   lần chụp và phải gửi ảnh của khách đi.
 * - Bộ nhận dạng tải một lần rồi trình duyệt tự cache (IndexedDB), nên từ lần thứ
 *   hai trở đi gần như tức thì và dùng được cả khi mạng yếu.
 *
 * Đổi lại, phải nói thật với khách về giới hạn: CHỮ IN / ẢNH CHỤP MÀN HÌNH đọc
 * tốt; chữ viết tay và ảnh nghiêng, thiếu sáng thì sai nhiều. Vì vậy chữ đọc được
 * luôn đổ vào ô nhập để khách ĐỌC LẠI VÀ SỬA trước khi tạo, chứ không tạo thẳng.
 */

// Chỉ tiếng Việt: bộ `vie` đã gồm bảng chữ Latin (đọc được cả từ tiếng Anh xen
// trong câu) mà dung lượng chỉ bằng một nửa so với tải thêm `eng`. Thêm ngôn ngữ
// vào đây là đổi thời gian tải lần đầu — cân nhắc trước khi thêm.
const OCR_LANGS = 'vie'
const CDN_SOURCES = [
  'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
  'https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js',
]

let scriptPromise = null

function loadTesseract() {
  if (typeof window !== 'undefined' && window.Tesseract) return Promise.resolve(window.Tesseract)
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const tryOne = (index) => {
      if (index >= CDN_SOURCES.length) {
        scriptPromise = null
        reject(new Error('Không tải được bộ nhận dạng chữ. Kiểm tra mạng rồi thử lại.'))
        return
      }
      const el = document.createElement('script')
      el.src = CDN_SOURCES[index]
      el.async = true
      el.onload = () => {
        if (window.Tesseract) resolve(window.Tesseract)
        else tryOne(index + 1)
      }
      el.onerror = () => {
        el.remove()
        tryOne(index + 1)
      }
      document.head.appendChild(el)
    }
    tryOne(0)
  })
  return scriptPromise
}

// Gạch đầu dòng và số thứ tự: "• Mua sữa", "- Đi chợ", "1. Nộp báo cáo"
const BULLET_RX = /^\s*(?:[-–—•*·▪●○]|\(?\d{1,2}[.)])\s+/
// Từ nối cho thấy dòng sau vẫn là CÙNG một câu bị xuống dòng giữa chừng
const CONTINUE_RX = /^(?:và|với|rồi|sau đó|hoặc|cùng|thêm|and|with|plus)\b/i
const END_PUNCT_RX = /[.;:!?…]$/
const HAS_LETTER_RX = /[a-zA-ZÀ-ỹ]/

// Mốc NGÀY đủ mạnh để bắt đầu một công việc mới (thứ trong tuần, chủ nhật, ngày
// cụ thể). Cố ý không tính "mai"/"nay" đứng một mình: "Chiều mai 2h họp" chỉ có
// MỘT mốc, tách ở đó là tạo ra dòng rác.
const ANCHOR_RX =
  /(?<![a-zà-ỹ0-9])(?:thứ\s*(?:[2-7]|hai|ba|tư|năm|sáu|bảy)|chủ\s*nhật|t[2-7]|ngày\s*\d{1,2}(?:\s*[/-]\s*\d{1,2})?|ngày\s+mai|hôm\s+nay|ngày\s+kia)(?![a-zà-ỹ0-9])/gi
// Mốc GIỜ trong dòng ("19h", "8h30", "7 giờ", "2pm")
const CLOCK_IN_LINE_RX = /(?<!\d)\d{1,2}\s*(?:[:h](?![a-zà-ỹ])|(?:giờ|tiếng)\b|(?:am|pm)\b)/i

/**
 * Cắt một dòng OCR bị GỘP thành nhiều công việc.
 *
 * Đây là lỗi gặp thật khi chụp ảnh giấy: hai việc nằm trên hai dòng giấy nhưng
 * tesseract đọc thành MỘT dòng chữ ("Thứ 5 đi họp lớp lúc 19h Chủ nhật 8h đưa con
 * đi học bơi"), và bộ tách công việc coi cả câu là một việc — mất luôn một việc
 * của khách mà không báo gì. Luật cắt: một mốc thứ/ngày MỚI, đứng sau chỗ đã có
 * GIỜ, và còn chữ thật ở phía sau mốc đó.
 */
function splitPackedLine(text) {
  const parts = []
  let cursor = 0
  ANCHOR_RX.lastIndex = 0
  let match
  while ((match = ANCHOR_RX.exec(text))) {
    const index = match.index
    if (index <= cursor) continue
    const before = text.slice(cursor, index).trim()
    const after = text.slice(index).trim()
    // Phía sau mốc phải còn ít nhất HAI từ có chữ: "…đi học bơi chủ nhật" không
    // được cắt thành một dòng rác chỉ có chữ "chủ nhật", còn "Chủ nhật 8h đưa con
    // đi học bơi" thì đúng là một việc mới.
    const restWords = after
      .slice(match[0].length)
      .trim()
      .split(/\s+/)
      .filter((w) => /[a-zA-ZÀ-ỹ]/.test(w))
    const afterHasContent = restWords.length >= 2
    if (CLOCK_IN_LINE_RX.test(before) && afterHasContent) {
      parts.push(before)
      cursor = index
    }
  }
  parts.push(text.slice(cursor).trim())
  return parts.filter((p) => p.length > 1)
}

/**
 * Dọn văn bản OCR thành chuỗi mà bộ tách công việc hiểu đúng.
 *
 * Điểm khó nhất là XUỐNG DÒNG, và nó có HAI chiều sai ngược nhau:
 * 1. OCR xuống dòng giữa câu vì hết bề ngang trang → giữ nguyên thì "Họp nhóm
 *    lúc 9h" bị xé thành hai công việc "Họp nhóm lúc" và "9h".
 * 2. OCR GỘP hai việc trên hai dòng giấy thành một dòng chữ → coi là một việc thì
 *    mất luôn một việc.
 * Nên: dòng có gạch đầu dòng, hoặc bắt đầu bằng chữ hoa sau một dòng đã kết thúc
 * câu, hoặc dòng bị gộp chứa nhiều mốc thứ/ngày → công việc mới; dòng còn lại →
 * nối vào dòng trước.
 */
export function cleanOcrText(raw = '') {
  const lines = String(raw)
    .split(/\r?\n/)
    .map((line) => ({ bulleted: BULLET_RX.test(line), text: line.replace(BULLET_RX, '').replace(/\s+/g, ' ').trim() }))
    // Dòng bị gộp nhiều việc → cắt trước, và mọi mảnh cắt ra đều là ranh giới cứng
    .flatMap((line) =>
      line.text.length > 1
        ? splitPackedLine(line.text).map((text, i) => ({ bulleted: line.bulleted || i > 0, text }))
        : [line]
    )
    .filter((line) => line.text.length > 1 && HAS_LETTER_RX.test(line.text))

  const out = []
  for (const line of lines) {
    const prev = out[out.length - 1]
    const merge =
      !line.bulleted &&
      Boolean(prev) &&
      !END_PUNCT_RX.test(prev) &&
      // Chữ thường (hoặc từ nối) ở đầu dòng ⇒ gần như chắc chắn là vế tiếp của câu
      (/^[a-zà-ỹ]/.test(line.text) || CONTINUE_RX.test(line.text)) &&
      // Nối quá dài thì thà tách ra còn hơn dính hai việc vào nhau
      prev.length + line.text.length < 220
    if (merge) out[out.length - 1] = `${prev} ${line.text}`
    else out.push(line.text)
  }

  return out
    .join('\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim()
}

/**
 * Đọc chữ trong một tệp ảnh.
 * @param {File|Blob} file
 * @param {(state: {phase: 'prepare'|'load'|'read', progress?: number}) => void} [onProgress]
 * @returns {Promise<{text: string, lines: string[], confidence: number}>}
 */
export async function recognizeTextFromImage(file, { onProgress } = {}) {
  if (!file) throw new Error('Không đọc được tệp ảnh')

  onProgress?.({ phase: 'prepare' })
  // Dùng lại hàm nén của hội thoại hỗ trợ: nó giới hạn 8 MB, thu cạnh dài về
  // 1600px và đổi HEIC/PNG sang JPEG — đúng thứ OCR cần (ảnh quá lớn làm OCR
  // chậm gấp nhiều lần mà chữ không rõ hơn).
  const prepared = await compressImageFile(file)

  const Tesseract = await loadTesseract()

  let worker = null
  try {
    worker = await Tesseract.createWorker(OCR_LANGS, 1, {
      logger: (m) => {
        if (m.status === 'loading tesseract core' || m.status === 'loading language traineddata' || m.status === 'initializing api') {
          onProgress?.({ phase: 'load', progress: m.progress })
        } else if (m.status === 'recognizing text') {
          onProgress?.({ phase: 'read', progress: m.progress })
        }
      },
    })
    const { data } = await worker.recognize(prepared.previewUrl)
    // `text` GIỮ nguyên dấu xuống dòng: bộ tách công việc dùng chính dấu đó để biết
    // đâu là việc mới. Gộp hết thành một dòng (như trước) là xoá mất thông tin
    // quan trọng nhất của một tờ giấy ghi nhiều việc.
    const text = cleanOcrText(data?.text || '')
    const lines = text.split('\n').filter(Boolean)
    const confidence = Math.round(data?.confidence || 0)
    return { text, lines, confidence: Number.isFinite(confidence) ? confidence : 0 }
  } finally {
    // Giải phóng worker + bộ nhớ model: để lại là chiếm vài chục MB trong tab
    try {
      await worker?.terminate()
    } catch {
      /* đóng tab thì thôi */
    }
  }
}
