import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle, WarningCircle, Info, X } from '@phosphor-icons/react'

const ToastContext = createContext(null)

let toastSeq = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
    clearTimeout(timers.current[id])
    delete timers.current[id]
  }, [])

  const push = useCallback(
    (type, message, { duration = 3500 } = {}) => {
      const id = ++toastSeq
      setToasts((list) => [...list.slice(-4), { id, type, message }])
      timers.current[id] = setTimeout(() => dismiss(id), duration)
      return id
    },
    [dismiss]
  )

  const api = useMemo(
    () => ({
      success: (m, o) => push('success', m, o),
      error: (m, o) => push('error', m, o),
      info: (m, o) => push('info', m, o),
      dismiss,
    }),
    [push, dismiss]
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          className="pointer-events-none fixed inset-x-0 top-4 z-[200] flex flex-col items-center gap-2 px-4"
          aria-live="polite"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl bg-navy-900 px-4 py-3 text-white shadow-2xl animate-slide-down"
            >
              {t.type === 'success' && <CheckCircle size={20} className="mt-0.5 shrink-0 text-emerald-400" weight="fill" />}
              {t.type === 'error' && <WarningCircle size={20} className="mt-0.5 shrink-0 text-rose-400" weight="fill" />}
              {t.type === 'info' && <Info size={20} className="mt-0.5 shrink-0 text-cyan-400" weight="fill" />}
              <p className="flex-1 text-sm font-medium leading-relaxed">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Đóng thông báo"
                className="cursor-pointer rounded-md p-0.5 text-navy-300 transition hover:bg-white/10 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast phải dùng bên trong ToastProvider')
  return ctx
}

// Helper xử lý response của service: toast lỗi nếu fail, trả về data nếu ok
export function useServiceToast() {
  const toast = useToast()
  return useCallback(
    async (promise, { successMessage, onSuccess, errorMessage } = {}) => {
      const res = await promise
      if (!res.success) {
        toast.error(res.message || errorMessage || 'Có lỗi xảy ra')
        return null
      }
      if (successMessage) toast.success(successMessage)
      if (onSuccess) onSuccess(res.data)
      return res.data
    },
    [toast]
  )
}
