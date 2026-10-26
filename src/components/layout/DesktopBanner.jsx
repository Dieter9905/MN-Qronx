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
      className="relative border-b border-blue-100 bg-gradient-to-r from-blue-50 via-cyan-50 to-blue-50 dark:border-slate-800 dark:from-blue-950/60 dark:via-slate-900 dark:to-blue-950/60"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6 lg:flex-nowrap">
        <BellRinging size={22} weight="fill" className="shrink-0 text-blue-600 dark:text-cyan-300" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm leading-snug text-navy-700 dark:text-slate-300">
          <strong className="font-semibold text-navy-900 dark:text-white">{t.desktopBannerTitle}</strong>{' '}
          {t.desktopBannerText}
        </p>
        <a
          href={DESKTOP_DOWNLOAD_URL}
          download
          className="group inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-brand-gradient px-3.5 text-sm font-semibold text-white shadow-glow-purple transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-purple"
        >
          <Monitor size={18} weight="bold" className="icon-pop" aria-hidden="true" />
          {t.desktopBannerCta}
        </a>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t.desktopBannerSkip}
          title={t.desktopBannerSkip}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-navy-400 transition hover:bg-navy-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <X size={16} weight="bold" />
        </button>
      </div>
    </div>
  )
}
