import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Nhập công việc bằng GIỌNG NÓI (Web Speech API của trình duyệt).
 *
 * Vì sao dùng API của trình duyệt thay vì thu âm rồi gửi lên máy chủ MN-Qronx:
 * không tốn hạn mức AI, không độ trễ mạng, không phải thuê thêm dịch vụ, và chạy
 * được cả khi máy chủ đang ngủ (Render gói free).
 *
 * ⚠️ ĐỪNG hứa với khách là "giọng nói không rời khỏi máy". Chrome/Edge KHÔNG nhận
 * dạng tại máy: chúng gửi audio tới dịch vụ của Google rồi trả chữ về (chỉ từ
 * Chrome 139 mới có chế độ tại máy qua `processLocally`, và app này chưa dùng).
 * Đó cũng chính là lý do có mã lỗi "network" bên dưới.
 *
 * Giới hạn có thật, phải nói thẳng trong giao diện:
 * - Chrome / Edge / Safari (kể cả Chrome trên Android): chạy được.
 * - Firefox: KHÔNG có API → `isVoiceSupported()` false, giao diện ẨN nút mic, vì
 *   bấm vào sẽ không có gì xảy ra và khách tưởng app lỗi.
 * - Chromium NHÚNG trong ứng dụng khác (Electron — gồm khung trình duyệt của app
 *   desktop): API CÓ mặt nhưng bản dựng không kèm khoá dịch vụ nhận dạng của
 *   Google, nên mọi phiên đều kết thúc bằng mã lỗi "network" DÙ mạng rất tốt
 *   (electron/electron#46143). Ở đây cố ý KHÔNG ẩn nút: bấm vào sẽ nhận được câu
 *   giải thích đúng và cách sửa, còn ẩn đi thì tính năng như biến mất mà không ai
 *   biết vì sao — cái cần tránh là "bấm mà không có gì xảy ra", không phải nút.
 */

/** Trình duyệt này có nhận dạng giọng nói không? */
export function isVoiceSupported() {
  if (typeof window === 'undefined') return false
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
}

// Mã lỗi của Web Speech API → câu tiếng Việt nói được việc phải làm tiếp.
// "aborted" không có ở đây vì đó là do chính người dùng bấm dừng.
// "network" cũng không: câu cho nó phải tính theo môi trường, xem `networkErrorMessage`.
const ERROR_MESSAGES = {
  'not-allowed': 'Bạn chưa cho phép dùng micro. Hãy bật quyền micro cho trang này rồi thử lại.',
  'service-not-allowed': 'Trình duyệt đang chặn nhận dạng giọng nói. Hãy mở trang bằng Chrome và thử lại.',
  'audio-capture': 'Không tìm thấy micro nào đang kết nối.',
  'no-speech': 'Không nghe thấy gì. Bấm micro rồi nói gần máy hơn.',
  'language-not-supported': 'Giọng nói tiếng Việt chưa được hỗ trợ trên máy này.',
}

/** Bản Chromium nhúng trong ứng dụng khác (Electron) — API có nhưng dịch vụ thì không. */
function isEmbeddedChromium() {
  if (typeof navigator === 'undefined') return false
  return /\bElectron\//i.test(navigator.userAgent || '')
}

/**
 * Câu cho mã lỗi "network" — mã gây hiểu nhầm nhiều nhất trong cả API này.
 *
 * Chrome báo "network" cho MỌI trường hợp không lấy được chữ từ dịch vụ nhận dạng
 * của Google, kể cả khi mạng của khách hoàn toàn bình thường. Vì vậy câu cũ
 * ("Kiểm tra kết nối rồi thử lại") đổ lỗi sai chỗ và khiến khách đi kiểm tra router
 * trong khi nguyên nhân là trình duyệt. Ở đây tách làm ba trường hợp thật.
 */
function networkErrorMessage() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'Máy đang không có kết nối mạng nên chưa nhận dạng được giọng nói. Khi có mạng trở lại, bấm micro và nói lại giúp tôi.'
  }
  if (isEmbeddedChromium()) {
    return 'Trình duyệt đang mở app là bản Chromium nhúng trong ứng dụng khác, không có dịch vụ nhận dạng giọng nói của Google — nên báo lỗi mạng dù mạng vẫn tốt. Mở MN-Qronx bằng Chrome, Edge hoặc Safari trên máy để dùng micro; hoặc cứ gõ tay, mọi thứ khác vẫn chạy bình thường.'
  }
  return 'Trình duyệt không gọi được dịch vụ nhận dạng giọng nói (Chrome gửi tiếng nói tới máy chủ Google để nhận dạng, không nhận dạng tại máy). Hay gặp khi: VPN / tường lửa / tiện ích chặn quảng cáo đang chặn máy chủ Google, DNS chặn Google, hoặc đang dùng trình duyệt không phải Chrome/Edge/Safari. Mở bằng Chrome rồi bấm micro lại giúp tôi.'
}

/**
 * @param {object} opts
 * @param {(text: string) => void} opts.onText  nhận từng đoạn chữ ĐÃ CHỐT (final)
 * @param {(message: string) => void} [opts.onError]
 * @param {string} [opts.lang]
 */
export function useVoiceInput({ onText, onError, lang = 'vi-VN' } = {}) {
  const [listening, setListening] = useState(false)
  // Chữ đang được đọc dở (chưa chốt) — hiện ngay để người dùng biết máy đang nghe
  const [interim, setInterim] = useState('')
  const supported = isVoiceSupported()

  const recognitionRef = useRef(null)
  // Người dùng có đang MUỐN nghe hay không. Khác `listening`: Chrome tự kết thúc
  // phiên sau vài giây im lặng, mà người dùng thì vẫn đang "bật mic" — cần khởi
  // động lại để họ nói tiếp câu sau mà không phải bấm lại.
  const wantRef = useRef(false)
  const restartCountRef = useRef(0)
  const onTextRef = useRef(onText)
  const onErrorRef = useRef(onError)
  const langRef = useRef(lang)

  useEffect(() => {
    onTextRef.current = onText
    onErrorRef.current = onError
    langRef.current = lang
  }, [onText, onError, lang])

  const stop = useCallback(() => {
    wantRef.current = false
    restartCountRef.current = 0
    setListening(false)
    setInterim('')
    try {
      recognitionRef.current?.stop()
    } catch {
      /* chưa chạy thì thôi */
    }
    recognitionRef.current = null
  }, [])

  const start = useCallback(() => {
    if (!isVoiceSupported()) {
      onErrorRef.current?.('Trình duyệt này không nhận dạng giọng nói. Hãy gõ tay hoặc mở bằng Chrome.')
      return
    }
    // Chromium nhúng (Electron) không có dịch vụ nhận dạng: mở phiên chỉ để nhận
    // đúng một lỗi "network" gây hiểu nhầm, nên nói thẳng lý do ngay từ đây.
    if (isEmbeddedChromium()) {
      onErrorRef.current?.(networkErrorMessage())
      return
    }
    if (wantRef.current) return

    wantRef.current = true
    restartCountRef.current = 0
    setListening(true)

    const begin = () => {
      const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition
      const rec = new Ctor()
      rec.lang = langRef.current
      rec.continuous = true
      // Chữ tạm: hiện ngay khi đang nói để nút mic có phản hồi thị giác
      rec.interimResults = true
      rec.maxAlternatives = 1

      rec.onresult = (event) => {
        let finalText = ''
        let interimText = ''
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i]
          const chunk = result[0]?.transcript || ''
          if (result.isFinal) finalText += chunk
          else interimText += chunk
        }
        setInterim(interimText)
        const clean = finalText.trim()
        if (clean) {
          setInterim('')
          onTextRef.current?.(clean)
        }
      }

      rec.onerror = (event) => {
        const code = event?.error
        // Người dùng bấm dừng, hoặc trình duyệt tự huỷ phiên → không phải lỗi
        if (code === 'aborted') return
        const msg = code === 'network' ? networkErrorMessage() : ERROR_MESSAGES[code]
        if (msg) {
          wantRef.current = false
          setListening(false)
          setInterim('')
          onErrorRef.current?.(msg)
        }
      }

      rec.onend = () => {
        // Chrome kết thúc phiên sau một quãng im lặng; nếu người dùng vẫn muốn
        // nghe thì mở phiên mới. Chặn ở 20 lần để một lỗi lặp vô hạn không biến
        // thành vòng lặp xin quyền micro.
        if (!wantRef.current) return
        if (restartCountRef.current >= 20) {
          wantRef.current = false
          setListening(false)
          setInterim('')
          onErrorRef.current?.('Đã nghe khá lâu rồi. Bấm micro để nói tiếp nhé.')
          return
        }
        restartCountRef.current += 1
        setTimeout(() => {
          if (wantRef.current) begin()
        }, 150)
      }

      try {
        rec.start()
      } catch {
        wantRef.current = false
        setListening(false)
        onErrorRef.current?.('Không mở được micro. Kiểm tra quyền micro của trình duyệt.')
        return
      }
      recognitionRef.current = rec
    }

    begin()
  }, [])

  const toggle = useCallback(() => {
    if (wantRef.current) stop()
    else start()
  }, [start, stop])

  // Rời trang giữa lúc đang nghe → phải tắt, nếu không micro vẫn bật và trình
  // duyệt vẫn hiện chấm đỏ ghi âm.
  useEffect(() => () => {
    wantRef.current = false
    try {
      recognitionRef.current?.abort?.()
    } catch {
      /* im lặng khi đóng */
    }
  }, [])

  return { supported, listening, interim, start, stop, toggle }
}

export default useVoiceInput
