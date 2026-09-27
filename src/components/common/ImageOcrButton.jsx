import { useRef } from 'react'
import { ImageSquare } from '@phosphor-icons/react'

/**
 * Lấy tệp ảnh đầu tiên từ một lần KÉO–THẢ.
 * Chỉ nhận ảnh và chỉ lấy ảnh ĐẦU TIÊN: kéo cả thư mục ảnh vào cũng không nên làm
 * app đọc mười tấm rồi treo.
 */
export function imageFileFromDrop(event) {
  const files = event?.dataTransfer?.files
  if (!files?.length) return null
  return [...files].find((f) => String(f.type).startsWith('image/')) || null
}

/**
 * Ảnh từ clipboard (Ctrl+V ảnh chụp màn hình). Chỉ lấy khi clipboard KHÔNG có
 * chữ: nếu khách đang dán văn bản thì đó là việc của ô nhập, không phải của OCR.
 */
export function imageFileFromClipboard(event) {
  const items = event?.clipboardData?.items
  if (!items?.length) return null
  for (const item of items) {
    if (item.kind === 'file' && String(item.type).startsWith('image/')) {
      return item.getAsFile()
    }
  }
  return null
}

/**
 * Nút chọn ảnh có chữ. Không tự gọi OCR — nhận `onFile` và để chỗ gọi quyết định
 * (mọi đường ảnh vào app đều đi qua cùng một hook `useImageOcr`).
 *
 * Nút KHÔNG tự tạo công việc: chữ OCR luôn sai vài chỗ, mà công việc sai giờ/sai
 * chữ thì tệ hơn là không có công việc. Khách đọc lại, sửa, rồi mới tạo.
 */
export default function ImageOcrButton({
  onFile,
  busy = false,
  disabled = false,
  className = '',
  label = 'Chụp hoặc chọn ảnh có chữ',
}) {
  const inputRef = useRef(null)

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          // Xoá giá trị để chọn LẠI đúng tấm ảnh đó vẫn kích hoạt onChange
          e.target.value = ''
          onFile?.(file)
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || busy}
        title={label}
        aria-label={label}
        aria-busy={busy}
        className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-navy-50 text-navy-500 ring-1 ring-inset ring-navy-100 transition hover:text-violet-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600 ${className}`}
      >
        {busy ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-400/40 border-t-violet-500" />
        ) : (
          <ImageSquare size={18} weight="fill" />
        )}
      </button>
    </>
  )
}
