// ─── Banner mời cài bản desktop (chỉ hiện với người dùng web) ────────
// Chuông báo trên web chỉ kêu khi tab đang mở; bản desktop (Windows)
// có daemon nền nên báo đúng giờ kể cả khi app đã tắt. Banner nhắc
// người dùng cài để không lỡ hẹn. Ẩn hẳn khi:
//   - đang chạy BÊN TRONG app desktop (WebView2 có window.chrome.webview
//     — tại đó daemon nền đã lo chuông từ trước, mời thêm là thừa),
//   - máy không phải Windows (file .exe chỉ chạy trên Windows),
//   - người dùng đã bấm "Để sau" (nhớ localStorage, không nhắc lại).

import { useEffect, useState } from 'react'
import { BellRinging, Monitor, X } from '@phosphor-icons/react'
import { useLanguage } from '../../context/LanguageContext'
import { app } from '../../i18n/app'
import { DESKTOP_DOWNLOAD_URL } from '../../lib/constants'

const DISMISS_KEY = 'mnq:desktopBannerDismissed'

export default function DesktopBanner() {
  const { lang } = useLanguage()
  const t = app[lang]
  // Mặc định ẩn để không nháy — useEffect quyết định hiện/ẩn
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    const insideDesktopApp = typeof window.chrome?.webview !== 'undefined'
    const isWindows = /Windows NT/.test(navigator.userAgent)
    let dismissed = false
    try { dismissed = localStorage.getItem(DISMISS_KEY) === '1' } catch { /* private mode */ }
    setHidden(insideDesktopApp || dismissed || !isWindows)
  }, [])

  if (hidden) return null

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* không nhớ được thì thôi */ }
    setHidden(true)
  }

  return (
    <div
      role="status"
      className="relative border-b border-room-acorn/15 bg-room-oat/40"
    >
      {/* Mobile: xếp dọc chữ + nút (flex-col); sm+ trở lên trở lại hàng ngang.
          Trước đây ở 1 hàng với shrink-0, chữ bị bóp còn ~120px nên wrap thành
          cả chục dòng — đọc không được. */}
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-x-3 gap-y-2 px-4 py-3 sm:flex-row sm:items-center sm:px-6 sm:py-2.5 lg:flex-nowrap">
        <div className="flex w-full min-w-0 items-start gap-2 sm:items-center sm:gap-3">
          <BellRinging size={20} weight="bold" className="mt-0.5 shrink-0 text-room-acorn sm:mt-0" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm leading-snug text-room-ink/80">
            <strong className="font-bold text-room-ink">{t.desktopBannerTitle}</strong>{' '}
            {t.desktopBannerText}
          </p>
        </div>
        {/* CTA + nút đóng luôn chung một hàng (kể cả trên mobile) */}
        <div className="flex shrink-0 items-center gap-1">
          <a
            href={DESKTOP_DOWNLOAD_URL}
            download
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-room-acorn px-4 text-sm font-bold text-room-paper shadow-[0_14px_26px_-12px_rgb(0_0_0/0.30)] transition-all hover:brightness-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-room-acorn"
          >
            <Monitor size={17} weight="bold" aria-hidden="true" />
            {t.desktopBannerCta}
          </a>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t.desktopBannerSkip}
            title={t.desktopBannerSkip}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-room-ink/45 transition hover:bg-room-paper hover:text-room-ink"
          >
            <X size={16} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  )
}
