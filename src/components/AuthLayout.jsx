import { Link } from 'react-router-dom'
import { ArrowsClockwise, BellRinging, CreditCard, Sparkle } from '@phosphor-icons/react'
import WorldLogo from './WorldLogo'

// ======================================================================
//  AuthLayout — "cửa phòng": bước qua màn này là bước về phòng
//  mini-hompy đã dọn sẵn. Panel trái = tường phòng (Porcelain + Acorn;
//  tối = phòng buổi tối có đèn ấm, KHÔNG navy/slate). Panel phải = mặt
//  giấy của form. Copy/blip kế thừa hero landing để một nhà một giọng.
// ======================================================================

// Blips đặc trưng của phòng — cùng ngữ liệu với hero landing (trung thực theo PRODUCT.md)
const BLIPS = [
  { icon: Sparkle, text: 'Miễn phí khi dùng thử' },
  { icon: ArrowsClockwise, text: 'Đồng bộ giữa web và mobile' },
  { icon: CreditCard, text: 'Không cần thẻ tín dụng' },
]

export default function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="room-world flex min-h-dvh bg-room-paper text-room-ink transition-colors duration-300">
      {/* Tường phòng — chỉ hiện từ lg; tường là Porcelain, tối = buổi đêm */}
      <aside className="relative hidden w-[46%] bg-room-paper lg:block">
        {/* Đèn ấm đặt trên tủ — chỉ buổi tối */}
        <div
          aria-hidden="true"
          className="lamp-glow pointer-events-none absolute -top-20 right-4 h-80 w-80 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgb(238 203 138 / 0.5) 0%, rgb(238 203 138 / 0.15) 55%, transparent 100%)',
          }}
        />
        {/* Dây chấm dọc — đường kẻ tường, bắt panel và mặt giấy tách nhau */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 h-full w-[3px] opacity-80"
          style={{
            backgroundImage: 'radial-gradient(rgb(var(--room-acorn) / 0.5) 1.6px, transparent 1.7px)',
            backgroundSize: '3px 16px',
            backgroundPosition: 'center',
            backgroundRepeat: 'repeat-y',
          }}
        />

        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <Link to="/" className="w-fit" aria-label="MN-Qronx – về trang chủ">
            <WorldLogo size={32} />
          </Link>

          <div>
            <h2 className="font-display text-[2.15rem] leading-[1.08] text-room-ink">
              Phòng của bạn,
              <br />
              <span className="text-room-acorn">đã dọn sẵn.</span>
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-room-ink/80">
              Việc của bạn là những món đồ được đặt vào phòng. Đến hạn thì món đồ sáng đèn và chuông reo — trên web,
              mobile và tiện ích trình duyệt.
            </p>

            {/* Thẻ dán tape: một mảnh của nhật ký phòng */}
            <div className="relative mt-10 max-w-xs rounded-2xl bg-room-paper/85 px-5 pb-5 pt-6 ring-1 ring-room-acorn/25 shadow-[0_14px_30px_-18px_rgb(0_0_0/0.25)]">
              <span
                aria-hidden="true"
                className="absolute -top-2.5 left-6 h-3 w-12 rotate-[-5deg] rounded-[3px] bg-room-oat/90 ring-1 ring-room-acorn/20"
              />
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-room-moss text-room-ink ring-1 ring-room-acorn/25">
                  <BellRinging size={15} weight="bold" />
                </span>
                <h3 className="font-display text-[15px] font-bold leading-tight text-room-ink">
                  Nhật ký đúng hạn
                </h3>
              </div>
              <p className="mt-2.5 text-[13px] leading-relaxed text-room-ink/70">
                Mỗi lần bạn hoàn thành đúng hạn đều được ghi lại — phòng luôn nhớ công của bạn.
              </p>
            </div>

            {/* Blips của phòng */}
            <ul className="mt-9 flex flex-wrap gap-x-5 gap-y-2.5">
              {BLIPS.map((b) => (
                <li key={b.text} className="flex items-center gap-1.5 text-sm font-semibold text-room-ink/80">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-room-moss/80 text-room-ink ring-1 ring-room-acorn/20">
                    <b.icon size={13} weight="bold" />
                  </span>
                  {b.text}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs font-semibold text-room-ink/60">© 2026 MN-Qronx · www.mn-qronx.id.vn</p>
        </div>
      </aside>

      {/* Form — mặt giấy */}
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Link to="/" className="inline-block" aria-label="MN-Qronx – về trang chủ">
              <WorldLogo size={30} />
            </Link>
          </div>
          <h1 className="font-display text-[1.95rem] leading-tight text-room-ink sm:text-[2.15rem]">{title}</h1>
          {subtitle && <p className="mt-2.5 text-[15px] leading-relaxed text-room-ink/75">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </div>
      </main>
    </div>
  )
}
