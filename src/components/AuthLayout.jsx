import { Link } from 'react-router-dom'
import { CheckCircle, BellRinging, ArrowsClockwise } from '@phosphor-icons/react'
import { Logo, LogoMark } from './Logo'

export default function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="flex min-h-dvh bg-navy-50">
      {/* Brand panel */}
      <aside className="relative hidden w-1/2 overflow-hidden bg-navy-900 lg:block">
        <div className="absolute inset-0 bg-hero-glow" aria-hidden="true" />
        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <Link to="/" aria-label="Về trang chủ">
            <Logo size={40} dark tagline />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <LogoMark size={44} />
              <div>
                <p className="text-lg font-extrabold leading-tight text-white">Plan. Do. On Time.</p>
                <p className="text-sm text-navy-300">“Lên kế hoạch – Bắt tay làm – Đúng thời điểm.”</p>
              </div>
            </div>
            <ul className="mt-8 space-y-4">
              {[
                { icon: BellRinging, text: 'Nhắc nhở kiểu báo thức – khó lòng bỏ lỡ deadline' },
                { icon: ArrowsClockwise, text: 'Đồng bộ dữ liệu giữa Website và Mobile App' },
                { icon: CheckCircle, text: 'Dashboard & lịch ngày/tuần/tháng trực quan' },
              ].map((f) => (
                <li key={f.text} className="flex items-start gap-3 text-sm font-medium text-navy-200">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                    <f.icon size={16} weight="bold" className="text-cyan-300" />
                  </span>
                  {f.text}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-navy-400">© 2026 MN-Qronx · www.mn-qronx.com</p>
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md animate-slide-up">
          <div className="mb-8 lg:hidden">
            <Link to="/">
              <Logo size={34} />
            </Link>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-navy-900">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-navy-500">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </div>
      </main>
    </div>
  )
}
