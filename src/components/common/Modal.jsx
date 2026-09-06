import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'
import Button from './Button'

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  hideClose = false,
}) {
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
        className="absolute inset-0 bg-navy-900/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className={`relative w-full ${sizes[size]} max-h-[92dvh] overflow-y-auto rounded-t-2xl bg-white shadow-2xl animate-slide-up dark:bg-slate-800 sm:rounded-2xl ${size === 'sm' ? 'sm:animate-scale-in' : 'sm:animate-slide-up'}`}
      >
        {(title || !hideClose) && (
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-navy-100 bg-white/95 px-5 py-4 backdrop-blur dark:border-slate-700 dark:bg-slate-800/95">
            <div>
              {title && <h2 className="text-lg font-bold text-navy-900 dark:text-white">{title}</h2>}
              {description && <p className="mt-0.5 text-sm text-navy-500 dark:text-slate-400">{description}</p>}
            </div>
            {!hideClose && onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng"
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-navy-400 transition hover:bg-navy-100 hover:text-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <X size={18} weight="bold" />
              </button>
            )}
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="sticky bottom-0 flex justify-end gap-3 border-t border-navy-100 bg-white/95 px-5 py-4 backdrop-blur dark:border-slate-700 dark:bg-slate-800/95">
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
}) {
  return (
    <Modal open={open} onClose={onClose} size="sm" title={title}>
      <p className="text-sm leading-relaxed text-navy-600 dark:text-slate-300">{message}</p>
      <div className="mt-5 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
