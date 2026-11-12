import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Archive,
  ArrowsClockwise,
  BellRinging,
  CaretRight,
  CheckCircle,
  Clock,
  CreditCard,
  House,
  Lightning,
  Lock,
  Monitor,
  Moon,
  Notepad,
  Plus,
  Repeat,
  ShieldCheck,
  Sparkle,
  SquaresFour,
  Sun,
  Timer,
  Translate,
} from '@phosphor-icons/react'
import { LogoMark } from '../../components/Logo'
import WorldLogo from '../../components/WorldLogo'
import { useTheme } from '../../context/ThemeContext'
import { useLanguage } from '../../context/LanguageContext'
import { landing } from '../../i18n/landing'
import { EXTENSION_STORE_URL, DESKTOP_DOWNLOAD_URL } from '../../lib/constants'
import RoomScene from '../../components/landing/RoomScene'
import RailCards from '../../components/landing/RailCards'

// ======================================================================
//  LANDING — thế giới PHÒNG MINI-HOMPY: trang chủ là NHÀ RIÊNG của bạn.
//  Việc = món đồ; đến hạn = món sáng đèn mà chuông kế bên reo.
//  Khối chia tách = đường chấm; không kicker, không chữ đổi màu thác nước,
//  không hàng ba thẻ tính năng đồng cỡ.
// ======================================================================

// ---------- Helper ----------
function useT() {
  const { lang } = useLanguage()
  return landing[lang]
}

// ---------- Scroll reveal hook (reveal-On-scroll duy nhất) ----------
function useScrollReveal(options = {}) {
  const ref = useRef(null)
  const threshold = options?.threshold || 0.15
  const rootMargin = options?.rootMargin || '0px'
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('visible')
          observer.unobserve(el)
        }
      },
      { threshold, rootMargin }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold, rootMargin])
  return ref
}

// ---------- Đường chấm chia mục ----------
function Divider({ className = '' }) {
  return <div aria-hidden="true" className={`dot-divider mx-auto max-w-5xl opacity-80 ${className}`} />
}

// ---------- ThemeToggle / LangToggle — pill tròn của thế giới phòng ----------
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-room-moss/70 text-room-ink ring-1 ring-room-acorn/25 transition hover:bg-room-moss"
      aria-label={theme === 'light' ? 'Chế độ tối' : 'Chế độ sáng'}
    >
      {theme === 'light' ? <Moon size={16} weight="bold" /> : <Sun size={16} weight="bold" />}
    </button>
  )
}

function LangToggle({ lang }) {
  const { toggleLang } = useLanguage()
  return (
    <button
      type="button"
      onClick={toggleLang}
      className="flex h-9 items-center gap-1 rounded-full bg-room-moss/70 px-2.5 text-[11px] font-black text-room-ink ring-1 ring-room-acorn/25 transition hover:bg-room-moss"
      aria-label="Ngôn ngữ"
    >
      <Translate size={14} weight="bold" /> {lang === 'vi' ? 'EN' : 'VI'}
    </button>
  )
}

// ---------- Nav — thanh pill nổi ----------
function GuestNav() {
  const t = useT()
  const { lang } = useLanguage()
  const links = [
    { href: '#tinh-nang', label: t.navFeatures, anchor: true },
    { href: '#cach-hoat-dong', label: t.navHowItWorks, anchor: true },
    { href: '#gioi-thieu', label: t.navAbout, anchor: true },
    { href: '/pricing', label: t.navPricing, anchor: false },
    { href: '#lien-he', label: t.navContact, anchor: true },
  ]
  return (
    <header className="relative z-40 px-3 pt-4 sm:px-5">
      <nav
        aria-label="Chính"
        className="mx-auto flex max-w-[1300px] items-center justify-between gap-2 rounded-full bg-room-paper/95 py-2 pl-3 pr-2 ring-1 ring-room-acorn/30 shadow-[0_12px_28px_-18px_rgb(0_0_0/0.35)]"
      >
        <Link to="/" className="pl-1" aria-label="MN-Qronx – Trang chủ">
          <WorldLogo />
        </Link>
        <div className="hidden items-center gap-0.5 lg:flex">
          {links.map((l) =>
            l.anchor ? (
              <a
                key={l.href}
                href={l.href}
                className="rounded-full px-3 py-1.5 text-sm font-bold text-room-ink/75 transition hover:bg-room-oat/60 hover:text-room-ink"
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.href}
                to={l.href}
                className="rounded-full px-3 py-1.5 text-sm font-bold text-room-ink/75 transition hover:bg-room-oat/60 hover:text-room-ink"
              >
                {l.label}
              </Link>
            )
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <LangToggle lang={lang} />
          <Link
            to="/login"
            className="hidden px-2.5 py-2 text-sm font-bold text-room-ink/80 transition hover:text-room-acorn md:block"
          >
            {t.login}
          </Link>
          <Link
            to="/app"
            className="hidden items-center gap-1.5 rounded-full bg-room-acorn px-4 py-2 font-display text-sm font-bold text-room-paper shadow-[0_8px_18px_-8px_rgb(0_0_0/0.3)] transition hover:-translate-y-0.5 sm:flex"
          >
            <House size={15} weight="bold" /> {t.goToApp}
          </Link>
        </div>
      </nav>
    </header>
  )
}

// ---------- HERO — khung đầu bố cục 3 cột: story · PHÒNG · rail ----------
function Hero() {
  const t = useT()
  const { lang } = useLanguage()
  const blips = [
    { icon: Sparkle, label: t.heroFreeTrial },
    { icon: ArrowsClockwise, label: t.heroSync },
    { icon: CreditCard, label: t.heroNoCard },
  ]
  return (
    <section className="mx-auto max-w-[1300px] px-4 pb-4 pt-5 sm:px-6 sm:pt-7">
      <div className="grid items-start gap-8 lg:grid-cols-[1.02fr_1.42fr_0.76fr] xl:gap-10">
        {/* Cột trái: câu dẫn + hành động */}
        <div className="order-2 self-center lg:order-1">
          <h1 className="font-display text-[2.15rem] leading-[1.08] text-room-ink sm:text-[2.35rem]">
            {t.heroTitle1}
            <br />
            <span className="text-room-acorn">{t.heroTitle2}</span>
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-room-ink/80">{t.heroDesc}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-full bg-room-acorn px-6 py-3 font-display text-[15px] font-bold text-room-paper shadow-[0_14px_26px_-12px_rgb(0_0_0/0.3)] transition hover:-translate-y-0.5 hover:bg-room-acorn/95"
            >
              {t.heroCta}
              <CaretRight size={16} weight="bold" />
            </Link>
            <a
              href="#tinh-nang"
              className="inline-flex items-center gap-2 rounded-full px-5 py-3 font-display text-[15px] font-bold text-room-ink ring-1 ring-room-acorn/40 transition hover:bg-room-oat/60"
            >
              {t.heroCtaSecondary}
            </a>
          </div>
          <a
            href={DESKTOP_DOWNLOAD_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-room-ink/70 underline decoration-room-acorn/40 decoration-dotted decoration-2 underline-offset-4 transition hover:text-room-acorn"
          >
            <Monitor size={15} weight="bold" /> {t.heroDesktopCta}
          </a>
          <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2.5">
            {blips.map((b) => (
              <li key={b.label} className="flex items-center gap-1.5 text-sm font-semibold text-room-ink/80">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-room-moss/80 text-room-ink ring-1 ring-room-acorn/20">
                  <b.icon size={13} weight="bold" />
                </span>
                {b.label}
              </li>
            ))}
          </ul>
        </div>

        {/* Cột giữa: PHÒNG — vật chủ đạo */}
        <div className="order-1 self-start lg:order-2">
          <RoomScene t={t} />
        </div>

        {/* Cột phải: rail 3 card */}
        <div className="order-3 self-start">
          <RailCards t={t} lang={lang} />
        </div>
      </div>
    </section>
  )
}

// ---------- Tủ hộc — 6 tính năng là 6 ngăn kéo trong MỘT thân tủ ----------
function Features() {
  const t = useT()
  const cabinetRef = useScrollReveal()
  const drawers = [
    { icon: Notepad, key: 'f1' },
    { icon: BellRinging, key: 'f2' },
    { icon: ArrowsClockwise, key: 'f3' },
    { icon: Repeat, key: 'f4' },
    { icon: SquaresFour, key: 'f5' },
    { icon: Archive, key: 'f6' },
  ]
  return (
    <section id="tinh-nang" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6 lg:py-20">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <h2 className="font-display text-3xl leading-tight text-room-ink sm:text-4xl">
          {t.featuresTitle1}
          <br />
          <span className="text-room-acorn">{t.featuresTitle2}</span>
        </h2>
        <p className="max-w-md text-[15px] leading-relaxed text-room-ink/75">{t.featuresDesc}</p>
      </div>

      <div
        ref={cabinetRef}
        className="reveal relative mt-10 rounded-[2.2rem] bg-room-oat/70 p-3 ring-1 ring-room-acorn/30 sm:p-5"
      >
        <div className="rounded-[1.8rem] bg-room-paper/75 px-4 py-8 ring-1 ring-room-acorn/20 sm:px-7">
          {/* Tấm danh thiếp gắn trên mặt tủ */}
          <div className="mx-auto mb-8 flex w-fit items-center gap-2 rounded-full bg-room-moss px-4 py-1.5 text-[11px] font-black tracking-[0.16em] text-room-ink ring-1 ring-room-acorn/25">
            <SquaresFour size={13} weight="bold" /> {t.featuresLabel}
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {drawers.map((d) => (
              <article
                key={d.key}
                className="rounded-2xl bg-room-moss/55 px-5 py-5 ring-1 ring-room-acorn/25"
              >
                <div className="flex items-center gap-3">
                  {/* Núm kéo */}
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-room-paper ring-1 ring-room-acorn/35">
                    <span className="h-2 w-2 rounded-full bg-room-acorn/70" aria-hidden="true" />
                  </span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-room-paper/80 text-room-acorn ring-1 ring-room-acorn/30">
                    <d.icon size={15} weight="bold" />
                  </span>
                  <h3 className="font-display text-[15px] font-bold leading-tight text-balance text-room-ink">
                    {t[`${d.key}Title`]}
                  </h3>
                </div>
                <p className="mt-3 text-pretty text-[13px] leading-relaxed text-room-ink/75">
                  {t[`${d.key}Desc`]}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------- Dây phơi — 4 bước treo trên dây, ghim gỗ ----------
function HowItWorks() {
  const t = useT()
  const lineRef = useScrollReveal()
  const steps = [
    { icon: Plus, key: 'howStep1' },
    { icon: Timer, key: 'howStep2' },
    { icon: BellRinging, key: 'howStep3' },
    { icon: CheckCircle, key: 'howStep4' },
  ]
  return (
    <section id="cach-hoat-dong" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6 lg:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl leading-tight text-room-ink sm:text-4xl">
          {t.howTitle1}
          <br />
          <span className="text-room-acorn">{t.howTitle2}</span>
        </h2>
        <p className="mt-4 text-pretty text-[15px] leading-relaxed text-room-ink/75">{t.howDesc}</p>
      </div>

      <div ref={lineRef} className="relative mx-auto mt-12 max-w-5xl">
        {/* Dây phơi */}
        <svg
          aria-hidden="true"
          viewBox="0 0 1000 40"
          preserveAspectRatio="none"
          className="pointer-events-none absolute -top-6 left-0 hidden h-10 w-full lg:block"
        >
          <path
            d="M6 8 Q 500 40 994 8"
            fill="none"
            stroke="rgb(var(--room-acorn) / 0.8)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
        <ol className="grid gap-5 pt-4 sm:grid-cols-2 lg:grid-cols-4 lg:pt-6">
          {steps.map((s, i) => (
            <li
              key={s.key}
              className={`relative rounded-2xl bg-room-paper px-5 pb-5 pt-8 ring-1 ring-room-acorn/30 ${
                i % 2 ? 'lg:rotate-[1.1deg]' : 'lg:-rotate-[0.9deg]'
              }`}
            >
              {/* Ghim gỗ kẹp dây (chỉ hiện khi có dây) */}
              <span
                aria-hidden="true"
                className="absolute left-1/2 top-[-14px] z-10 hidden h-9 w-4 -translate-x-1/2 rounded-[5px] bg-room-oat ring-1 ring-room-acorn/45 shadow-[0_3px_6px_rgb(0_0_0/0.28)] lg:block"
              />
              {/* Băng giấy dán mép tấm */}
              <span aria-hidden="true" className="absolute -top-2 left-6 h-3 w-10 rotate-[-5deg] rounded-[3px] bg-room-oat/90 opacity-90 ring-1 ring-room-acorn/20" />
              {/* Số thứ tự — thẻ gỗ nhỏ, tương phản an toàn mọi theme */}
              <span aria-hidden="true" className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-room-oat font-display text-xs font-black text-room-ink ring-1 ring-room-acorn/35">
                {i + 1}
              </span>
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-room-moss text-room-ink ring-1 ring-room-acorn/25">
                  <s.icon size={17} weight="bold" />
                </span>
                <h3 className="font-display text-[15px] font-bold leading-snug text-balance text-room-ink">
                  {t[`${s.key}Title`]}
                </h3>
              </div>
              <p className="mt-2.5 text-pretty text-[13px] leading-relaxed text-room-ink/70">{t[`${s.key}Desc`]}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

// ---------- Câu chuyện chữ Q — mỏ neo thương hiệu ----------
function QStory() {
  const t = useT()
  const leftRef = useScrollReveal()
  const rightRef = useScrollReveal()
  const meanings = [
    { icon: Clock, name: t.syncIcon1, desc: t.syncIcon1Desc },
    { icon: CheckCircle, name: t.syncIcon2, desc: t.syncIcon2Desc },
    { icon: Lightning, name: t.syncIcon3, desc: t.syncIcon3Desc },
    { q: true, name: t.syncIcon4, desc: t.syncIcon4Desc },
  ]
  const bullets = [
    { icon: ArrowsClockwise, text: t.syncBullet1 },
    { icon: ShieldCheck, text: t.syncBullet2 },
    { icon: Lock, text: t.syncBullet3 },
  ]
  return (
    <section id="gioi-thieu" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6 lg:py-20">
      <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr]">
        <div ref={leftRef} className="reveal">
          <div className="rounded-[2rem] bg-room-moss/70 p-10 text-center ring-1 ring-room-acorn/30">
            <LogoMark size={92} />
            <p className="mt-5 font-display text-lg font-bold text-room-ink/80">{t.ctaTagline}</p>
          </div>
        </div>
        <div ref={rightRef} className="reveal">
          <h2 className="font-display text-3xl leading-tight text-balance text-room-ink sm:text-4xl">
            {t.syncTitle}
          </h2>
          <p className="mt-3 max-w-xl text-pretty text-[15px] leading-relaxed text-room-ink/75">{t.syncDesc}</p>
          <ul className="mt-6 space-y-3">
            {meanings.map((m, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-room-oat text-room-acorn ring-1 ring-room-acorn/25">
                  {m.q ? <LogoMark size={16} /> : <m.icon size={15} weight="bold" />}
                </span>
                <span className="text-sm font-bold text-room-ink">{m.name}</span>
                <span aria-hidden="true" className="h-px flex-1" style={{ backgroundImage: 'radial-gradient(rgb(var(--room-acorn) / 0.5) 1px, transparent 1.1px)', backgroundSize: '10px 2px' }} />
                <span className="text-sm text-room-ink/60">{m.desc}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <Divider className="max-w-md opacity-60" />
          </div>
          <ul className="mt-6 grid gap-2.5 sm:grid-cols-3">
            {bullets.map((b) => (
              <li key={b.text} className="flex items-center gap-2 text-[13px] font-semibold text-room-ink/70">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-room-sage/60 text-room-ink ring-1 ring-room-acorn/20">
                  <b.icon size={12} weight="bold" />
                </span>
                {b.text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

// ---------- Nền móng — lời mời cuối, phòng informal ----------
function FinalCta() {
  const t = useT()
  const ctaRef = useScrollReveal()
  return (
    <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
      <div
        ref={ctaRef}
        className="reveal relative rounded-[2.2rem] bg-room-moss/80 px-6 py-14 text-center ring-1 ring-room-acorn/30"
      >
        {/* Khung chấm trang trí bên trong */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-3 rounded-[1.9rem] border-2 border-dashed border-room-acorn/25" />
        <LogoMark size={56} />
        <h2 className="mt-5 font-display text-3xl font-bold text-balance text-room-ink sm:text-[2.6rem]">
          {t.ctaTagline}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-room-ink/80">{t.ctaDesc}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/register"
            className="inline-flex items-center gap-2 rounded-full bg-room-acorn px-6 py-3 font-display text-[15px] font-bold text-room-paper shadow-[0_14px_26px_-12px_rgb(0_0_0/0.3)] transition hover:-translate-y-0.5 hover:bg-room-acorn/95"
          >
            {t.ctaRegister}
            <CaretRight size={16} weight="bold" />
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-full px-5 py-3 font-display text-[15px] font-bold text-room-ink ring-1 ring-room-acorn/40 transition hover:bg-room-oat/60"
          >
            {t.ctaLogin}
          </Link>
        </div>
        {EXTENSION_STORE_URL ? (
          <a
            href={EXTENSION_STORE_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-room-paper/80 px-4 py-2 text-sm font-bold text-room-ink ring-1 ring-room-acorn/25 transition hover:bg-room-paper"
          >
            <Lightning size={15} weight="bold" /> {t.extCta}
          </a>
        ) : null}
      </div>
    </section>
  )
}

// ---------- Chân trang — style sổ tay khách ký tên ----------
function GuestFooter() {
  const t = useT()
  const footerRef = useScrollReveal()
  const productLinks = [
    { href: '#tinh-nang', label: t.footerFeatures, anchor: true },
    { href: '#cach-hoat-dong', label: t.footerHowItWorks, anchor: true },
    { href: '/register', label: t.footerRegister, anchor: false },
    { href: '/login', label: t.footerLogin, anchor: false },
    { href: '/pricing', label: t.navPricing, anchor: false },
  ]
  return (
    <footer id="lien-he" className="mt-10 scroll-mt-24 rounded-t-[2.4rem] bg-room-oat/60 ring-1 ring-room-acorn/25">
      <div ref={footerRef} className="reveal mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr_1fr]">
          <div>
            <WorldLogo />
            <p className="mt-4 max-w-sm text-pretty text-sm leading-relaxed text-room-ink/75">{t.footerDesc}</p>
            <p className="mt-5 inline-flex rounded-full bg-room-paper/80 px-3.5 py-1.5 text-[11px] font-black tracking-[0.18em] text-room-acorn ring-1 ring-room-acorn/30">
              {t.footerPlan}
            </p>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold text-room-ink">{t.footerProduct}</h3>
            <ul className="mt-3 space-y-2 text-sm font-semibold text-room-ink/70">
              {productLinks.map((l) =>
                l.anchor ? (
                  <li key={l.href}>
                    <a href={l.href} className="transition hover:text-room-acorn">
                      {l.label}
                    </a>
                  </li>
                ) : (
                  <li key={l.href}>
                    <Link to={l.href} className="transition hover:text-room-acorn">
                      {l.label}
                    </Link>
                  </li>
                )
              )}
            </ul>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold text-room-ink">{t.footerContact}</h3>
            <ul className="mt-3 space-y-2 text-sm font-semibold text-room-ink/70">
              <li>
                <a href="mailto:support@mn-qronx.id.vn" className="transition hover:text-room-acorn">
                  support@mn-qronx.id.vn
                </a>
              </li>
              <li>mn-qronx.id.vn</li>
              <li className="flex items-center gap-1.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-room-sage/60 text-room-ink ring-1 ring-room-acorn/20">
                  <House size={13} weight="bold" />
                </span>
                {t.footerProject}
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-room-acorn/15 pt-5 text-xs font-semibold text-room-ink/65 sm:flex-row">
          <p>{t.footerCopyright}</p>
          <p className="flex items-center gap-1.5">
            <Lock size={13} weight="bold" /> {t.footerSecurity}
          </p>
        </div>
      </div>
    </footer>
  )
}

// ---------- Trang ----------
export default function LandingPage() {
  return (
    <div className="room-world min-h-dvh bg-room-paper font-body text-room-ink transition-colors duration-300">
      <GuestNav />
      <Hero />
      <Divider className="my-2 opacity-60" />
      <Features />
      <Divider className="my-2" />
      <HowItWorks />
      <Divider className="my-2" />
      <QStory />
      <FinalCta />
      <GuestFooter />
    </div>
  )
}
