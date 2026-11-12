import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'
import Button from './Button'
import { RoomButton } from './RoomUI'

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  hideClose = false,
  // skin="room" = da phòng cho các modal mở trong thế giới phòng (M3):
  // giấy Paper + ring Acorn, KHÔNG backdrop-blur (craft floor — no glass).
  // Mặc định 'classic' giữ nguyên bản navy cho mọi nơi khác.
  skin = 'classic',
}) {
  const room = skin === 'room'
  const panelRef = useRef(null)
  const previousFocus = useRef(null)
  // onClose thường được truyền inline (hàm mới mỗi lần render cha) → giữ qua ref
  // để effect chỉ chạy khi modal mở/đóng, tránh "cướp" focus sau mỗi lần gõ phím.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return undefined
    previousFocus.current = document.activeElement
    const onKey = (e) => {
      if (e.key === 'Escape' && onCloseRef.current) onCloseRef.current()
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const t = setTimeout(() => {
      // Ưu tiên focus ô nhập liệu đầu tiên (không nhảy vào nút Đóng)
      const panel = panelRef.current
      if (!panel) return
      const control = panel.querySelector('input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])')
      ;(control || panel.querySelector('button, [href]'))?.focus()
    }, 30)
    return () => {
      document.removeEventListener('keydown', onKey)
      clearTimeout(t)
      previousFocus.current?.focus?.()
    }
  }, [open])

  if (!open) return null

  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`absolute inset-0 animate-fade-in ${
          room ? 'bg-room-ink/45' : 'bg-navy-900/50 backdrop-blur-sm'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className={`relative w-full ${sizes[size]} max-h-[92dvh] overflow-y-auto ${
          room
            ? 'rounded-t-2xl bg-room-paper ring-1 ring-room-acorn/25 animate-slide-up sm:rounded-2xl'
            : 'rounded-t-2xl bg-white shadow-2xl animate-slide-up dark:bg-slate-800 sm:rounded-2xl'
        } ${size === 'sm' ? 'sm:animate-scale-in' : 'sm:animate-slide-up'}`}
      >
        {(title || !hideClose) && (
          <div
            className={`sticky top-0 z-10 flex items-start justify-between gap-4 px-5 py-4 ${
              room ? 'border-b border-room-acorn/15 bg-room-paper' : 'border-b border-navy-100 bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-800/95'
            }`}
          >
            <div>
              {title && <h2 className={`text-lg font-bold ${room ? 'text-room-ink' : 'text-navy-900 dark:text-white'}`}>{title}</h2>}
              {description && (
                <p className={`mt-0.5 text-sm ${room ? 'font-semibold text-room-ink/60' : 'text-navy-500 dark:text-slate-400'}`}>
                  {description}
                </p>
              )}
            </div>
            {!hideClose && onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng"
                className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 ${
                  room
                    ? 'text-room-ink/60 hover:bg-room-oat/70 focus-visible:ring-room-acorn'
                    : 'text-navy-400 hover:bg-navy-100 hover:text-navy-700 focus-visible:ring-blue-500'
                }`}
              >
                <X size={18} weight="bold" />
              </button>
            )}
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div
            className={`sticky bottom-0 flex justify-end gap-3 border-t px-5 py-4 ${
              room
                ? 'border-room-acorn/15 bg-room-paper'
                : 'border-navy-100 bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-800/95'
            }`}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Xác nhận',
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  danger = false,
  loading = false,
  skin = 'classic',
}) {
  const room = skin === 'room'
  return (
    <Modal open={open} onClose={onClose} size="sm" title={title} skin={skin}>
      <p className={room ? 'text-sm font-semibold leading-relaxed text-room-ink/80' : 'text-sm leading-relaxed text-navy-600 dark:text-slate-300'}>
        {message}
      </p>
      <div className="mt-5 flex justify-end gap-3">
        {room ? (
          <RoomButton variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </RoomButton>
        ) : (
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
        )}
        {room ? (
          <RoomButton variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </RoomButton>
        ) : (
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        )}
      </div>
    </Modal>
  )
}
