// Gợi ý cài tiện ích Chrome cho người dùng đã đăng nhập (chiến lược tăng
// lượt tải: tận dụng kênh web sẵn có). Chỉ hiện khi EXTENSION_STORE_URL
// đã cấu hình trong src/lib/constants.js; nằm ở góc phải-dưới, dễ tắt và
// không hiện lại sau khi người dùng đóng (nhớ localStorage).
import { useEffect, useState } from 'react'
import { X, BellRinging, ArrowRight } from '@phosphor-icons/react'
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
      // Mobile: trải trọn bề rộng cách đáy 84px để không đè thanh nav dưới
      // (BottomNav cao 65px); cụm 3 nút nổi bên phải cần chừa 132px để không đè
      // lên thẻ. sm+ trở lên quay về dock góc phải-dưới như cũ.
      // neo trái, hẹp hơn 280px trên mobile để cụm nút nổi không che nội dung.
      className="fixed bottom-[84px] left-3 z-30 w-[min(280px,calc(100%-132px))] overflow-hidden rounded-2xl bg-room-paper p-4 shadow-[0_18px_34px_-22px_rgb(0_0_0/0.30)] ring-1 ring-room-acorn/25 sm:bottom-4 sm:left-auto sm:right-4 sm:z-40 sm:w-[320px]"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Đóng gợi ý"
        className="absolute right-2 top-2 rounded-lg p-1 text-room-ink/40 transition-colors hover:bg-room-oat/60 hover:text-room-ink"
      >
        <X size={14} weight="bold" />
      </button>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-room-oat/70 text-room-acorn ring-1 ring-room-acorn/20">
          <BellRinging size={20} weight="bold" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-room-ink">
            Nhận chuông nhắc ngay cả khi đóng tab
          </p>
          <p className="mt-1 text-xs leading-relaxed text-room-ink/65">
            Cài tiện ích Chrome MN-Qronx — báo thức &amp; Pomodoro chạy nền
            trên trình duyệt.
          </p>
          <a
            href={EXTENSION_STORE_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-room-acorn px-3.5 py-1.5 text-xs font-bold text-room-paper shadow-[0_10px_20px_-10px_rgb(0_0_0/0.30)] transition-colors hover:brightness-[0.96]"
          >
            Cài tiện ích miễn phí
            <ArrowRight size={12} weight="bold" />
          </a>
        </div>
      </div>
    </div>
  )
}
