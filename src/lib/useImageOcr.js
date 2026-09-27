import { useCallback, useRef, useState } from 'react'
import { recognizeTextFromImage } from './imageOcr'

const PHASE_TEXT = {
  prepare: 'Đang chuẩn bị ảnh…',
  load: 'Đang tải bộ nhận dạng (lần đầu hơi lâu)…',
  read: 'Đang đọc chữ trong ảnh…',
}

/**
 * Chạy OCR ảnh và giữ trạng thái để giao diện hiện được tiến trình.
 *
 * Tách khỏi nút bấm vì ảnh vào app bằng BA đường — bấm chọn, kéo–thả, dán ảnh
 * chụp màn hình — mà cả ba phải chạy y hệt nhau và cùng một dòng trạng thái. Nếu
 * mỗi đường tự gọi OCR thì sớm muộn cũng có đường quên hiện tiến trình hoặc quên
 * tắt worker.
 */
export function useImageOcr({ onText, onError } = {}) {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null)
  const onTextRef = useRef(onText)
  const onErrorRef = useRef(onError)
  onTextRef.current = onText
  onErrorRef.current = onError

  const run = useCallback(async (file) => {
    if (!file) {
      onErrorRef.current?.('Chỉ nhận tệp ảnh (JPG, PNG…)')
      return
    }
    setBusy(true)
    setStatus(PHASE_TEXT.prepare)
    try {
      const result = await recognizeTextFromImage(file, {
        onProgress: ({ phase, progress }) => {
          const pct = typeof progress === 'number' ? ` ${Math.round(progress * 100)}%` : ''
          setStatus(`${PHASE_TEXT[phase] || PHASE_TEXT.read}${pct}`)
        },
      })
      if (!result.text) {
        onErrorRef.current?.(
          'Không đọc được chữ nào trong ảnh. Thử ảnh rõ hơn, chụp thẳng góc, hoặc gõ tay.'
        )
        return
      }
      onTextRef.current?.(result)
    } catch (err) {
      onErrorRef.current?.(err?.message || 'Không đọc được ảnh này.')
    } finally {
      setBusy(false)
      setStatus(null)
    }
  }, [])

  return { busy, status, run }
}

export default useImageOcr
