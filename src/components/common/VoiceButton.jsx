import { useEffect, useRef } from 'react'
import { Microphone, MicrophoneSlash } from '@phosphor-icons/react'
import { useVoiceInput } from '../../lib/useVoiceInput'

/**
 * Nút micro dùng chung cho mọi chỗ nhập việc bằng lời (trợ lý AI, Tạo nhanh).
 *
 * Trình duyệt không hỗ trợ (Firefox) → không render gì cả. Thà thiếu nút còn hơn
 * có nút mà bấm vào không xảy ra gì: khách sẽ tưởng app lỗi.
 */
export default function VoiceButton({
  onText,
  onInterim,
  onError,
  disabled = false,
  className = '',
  label = 'Nói để tạo công việc',
}) {
  const { supported, listening, interim, toggle } = useVoiceInput({ onText, onError })

  // `onInterim` để chỗ gọi tự hiện chữ đang đọc dở ngay cạnh ô nhập của họ.
  // Gọi trong effect (không gọi thẳng khi render) vì đây là setState của component
  // cha — gọi lúc render sẽ làm React cảnh báo và có thể lặp vô hạn.
  const onInterimRef = useRef(onInterim)
  useEffect(() => {
    onInterimRef.current = onInterim
  })
  useEffect(() => {
    onInterimRef.current?.(interim)
  }, [interim])

  if (!supported) return null

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      title={listening ? 'Đang nghe… bấm để dừng' : label}
      aria-label={listening ? 'Dừng nghe' : label}
      aria-pressed={listening}
      className={`relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl ring-1 ring-inset transition disabled:cursor-not-allowed disabled:opacity-50 ${
        listening
          ? 'bg-rose-500 text-white ring-rose-400 shadow-glow-blue'
          : 'bg-navy-50 text-navy-500 ring-navy-100 hover:text-violet-600 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600'
      } ${className}`}
    >
      {listening ? <MicrophoneSlash size={18} weight="fill" /> : <Microphone size={18} weight="fill" />}
      {listening && (
        <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
        </span>
      )}
    </button>
  )
}
