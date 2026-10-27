// Gợi ý cài tiện ích Chrome cho người dùng đã đăng nhập (chiến lược tăng
// lượt tải: tận dụng kênh web sẵn có). Chỉ hiện khi EXTENSION_STORE_URL
// đã cấu hình trong src/lib/constants.js; nằm ở góc phải-dưới, dễ tắt và
// không hiện lại sau khi người dùng đóng (nhớ localStorage).
import { useEffect, useState } from 'react'
import { X, ArrowRight } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import { EXTENSION_STORE_URL } from '../lib/constants'

const DISMISS_KEY = 'mnq-ext-promo-dismissed'

export default function ExtensionPromoBar() {
  const { user, loading } = useAuth()
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    if (loading) return
    const dismissed = localStorage.getItem(DISMISS_KEY) === '1'
    setHidden(!user || dismissed || !EXTENSION_STORE_URL)
  }, [user, loading])

  if (hidden) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setHidden(true)
  }

  return (
    <div
      role="complementary"
      aria-label="Gợi ý cài tiện ích trình duyệt"
      className="fixed bottom-4 right-4 z-40 w-[320px] overflow-hidden rounded-2xl bg-white p-4 shadow-xl ring-1 ring-navy-100 dark:bg-slate-800 dark:ring-slate-700"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Đóng gợi ý"
        className="absolute right-2 top-2 rounded-lg p-1 text-navy-300 transition-colors hover:bg-navy-50 hover:text-navy-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
      >
        <X size={14} weight="bold" />
      </button>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-lg text-white">
          🕒
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-navy-800 dark:text-white">
            Nhận chuông nhắc ngay cả khi đóng tab
          </p>
          <p className="mt-1 text-xs leading-relaxed text-navy-500 dark:text-slate-400">
            Cài tiện ích Chrome MN-Qronx — báo thức &amp; Pomodoro chạy nền
            trên trình duyệt.
          </p>
          <a
            href={EXTENSION_STORE_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-blue-500"
          >
            Cài tiện ích miễn phí
            <ArrowRight size={12} weight="bold" />
          </a>
        </div>
      </div>
    </div>
  )
}
