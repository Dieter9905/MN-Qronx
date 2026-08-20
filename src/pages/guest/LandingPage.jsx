import { Link } from 'react-router-dom'
import {
  ListChecks,
  BellRinging,
  ArrowsClockwise,
  CalendarBlank,
  Clock,
  CheckCircle,
  Lightning,
  CaretRight,
  DeviceMobile,
  Monitor,
  Globe,
  Plus,
  House,
  ChartBar,
  Gear,
  UserCirclePlus,
  Bell,
  Fire,
  ShieldCheck,
  Lock,
  Eye,
  Timer,
  Sun,
  Moon,
  Translate,
} from '@phosphor-icons/react'
import { Logo, LogoMark } from '../../components/Logo'
import Button from '../../components/common/Button'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useLanguage } from '../../context/LanguageContext'
import { landing } from '../../i18n/landing'

// ---------- Helper ----------
function useT() {
  const { lang } = useLanguage()
  return landing[lang]
}

// ---------- ThemeToggle ----------
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      onClick={toggleTheme}
      className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy-100/70 text-navy-600 transition-all hover:scale-110 hover:bg-navy-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
      aria-label={theme === 'light' ? 'Chế độ tối' : 'Chế độ sáng'}
    >
      {theme === 'light' ? <Moon size={18} weight="bold" /> : <Sun size={18} weight="bold" />}
    </button>
  )
}

// ---------- LangToggle ----------
function LangToggle() {
  const { lang, toggleLang } = useLanguage()
  return (
    <button
      onClick={toggleLang}
      className="flex h-9 items-center gap-1 rounded-xl bg-navy-100/70 px-3 text-xs font-bold text-navy-600 transition-all hover:scale-110 hover:bg-navy-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
      aria-label="Đổi ngôn ngữ"
    >
      <Translate size={14} weight="bold" />
      {lang.toUpperCase()}
    </button>
  )
}

// ---------- GuestNav ----------
function GuestNav() {
  const { user } = useAuth()
  const t = useT()
  return (
    <header className="sticky top-0 z-40 border-b border-navy-100/60 bg-white/85 backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/85">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" aria-label="MN-Qronx – Trang chủ">
          <Logo size={34} />
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-semibold text-navy-600 dark:text-slate-300 md:flex" aria-label="Điều hướng">
          <a href="#tinh-nang" className="transition hover:text-blue-600 dark:hover:text-blue-400">{t.navFeatures}</a>
          <a href="#cach-hoat-dong" className="transition hover:text-blue-600 dark:hover:text-blue-400">{t.navHowItWorks}</a>
          <a href="#gioi-thieu" className="transition hover:text-blue-600 dark:hover:text-blue-400">{t.navAbout}</a>
          <a href="#lien-he" className="transition hover:text-blue-600 dark:hover:text-blue-400">{t.navContact}</a>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LangToggle />
          {user ? (
            <Link to="/app">
              <Button variant="gradient" size="sm" icon={CaretRight}>
                {t.goToApp}
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/login" className="hidden sm:block">
                <Button variant="ghost" size="sm">{t.login}</Button>
              </Link>
              <Link to="/register">
                <Button variant="gradient" size="sm" icon={UserCirclePlus}>
                  {t.register}
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

// ---------- Hero ----------
function Hero() {
  const t = useT()
  return (
    <section className="relative overflow-hidden bg-navy-900 text-white dark:bg-slate-950">
      {/* Animated orbs */}
      <div className="orb animate-glow-pulse h-[500px] w-[500px] bg-blue-500 -top-40 -left-40" />
      <div className="orb animate-glow-pulse h-[400px] w-[400px] bg-purple-500 -bottom-32 -right-32" style={{ animationDelay: '1.5s' }} />
      <div className="absolute inset-0 bg-hero-glow dark:bg-hero-glow-dark" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" aria-hidden="true" />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:pb-28 lg:pt-24">
        <div className="animate-slide-up">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-cyan-300 ring-1 ring-inset ring-white/15">
            <Lightning size={14} weight="fill" />
            {t.heroBadge}
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-[1.12] tracking-tight sm:text-5xl lg:text-[3.4rem]">
            {t.heroTitle1}
            <br />
            <span className="bg-brand-gradient bg-clip-text text-transparent text-shimmer">{t.heroTitle2}</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-navy-200">
            {t.heroDesc}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/register">
              <Button variant="gradient" size="lg" icon={CaretRight} iconWeight="bold">
                {t.heroCta}
              </Button>
            </Link>
            <a href="#tinh-nang">
              <Button variant="light" size="lg">
                {t.heroCtaSecondary}
              </Button>
            </a>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold text-navy-300">
            <span className="flex items-center gap-1.5">
              <CheckCircle size={16} weight="fill" className="text-cyan-400" /> {t.heroFreeTrial}
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle size={16} weight="fill" className="text-cyan-400" /> {t.heroSync}
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle size={16} weight="fill" className="text-cyan-400" /> {t.heroNoCard}
            </span>
          </div>
        </div>

        {/* Hero visual – 3D tilt card */}
        <div className="relative mx-auto w-full max-w-md animate-slide-up perspective-1000" style={{ animationDelay: '120ms' }}>
          <HeroVisual />
        </div>
      </div>
    </section>
  )
}

function HeroVisual() {
  const t = useT()
  const tasks = [
    { time: '09:00', title: t.heroTask1, color: '#8B5CF6', tag: t.heroTag1 },
    { time: '14:30', title: t.heroTask2, color: '#2563EB', tag: t.heroTag2 },
    { time: '19:00', title: t.heroTask3, color: '#06B6D4', tag: t.heroTag3 },
  ]
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-brand-gradient opacity-20 blur-3xl animate-glow-pulse" aria-hidden="true" />
      <div className="relative hero-3d rounded-3xl bg-white/95 p-4 shadow-2xl ring-1 ring-white/40 dark:bg-slate-800/95 dark:ring-slate-600/40">
        {/* Thanh trình duyệt */}
        <div className="flex items-center gap-2 px-1 pb-3">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <span className="ml-2 flex-1 rounded-md bg-navy-50 px-3 py-1 text-[11px] font-medium text-navy-400 dark:bg-slate-700 dark:text-slate-400">
            app.mn-qronx.com
          </span>
        </div>
        {/* Dashboard mini */}
        <div className="rounded-2xl bg-navy-50/70 p-4 dark:bg-slate-900/70">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-navy-900 dark:text-white">{t.heroGreeting}</p>
              <p className="text-xs text-navy-400 dark:text-slate-500">{t.heroDate}</p>
            </div>
            <span className="rounded-full bg-brand-gradient px-3 py-1 text-[11px] font-bold text-white">
              5 · 3 ✅
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { n: '5', l: t.heroTasks, c: 'text-blue-600 dark:text-blue-400' },
              { n: '3', l: t.heroDone, c: 'text-emerald-600 dark:text-emerald-400' },
              { n: '2', l: t.heroRemaining, c: 'text-amber-600 dark:text-amber-400' },
            ].map((s) => (
              <div key={s.l} className="rounded-xl bg-white p-2.5 text-center shadow-sm dark:bg-slate-800">
                <p className={`text-lg font-extrabold ${s.c}`}>{s.n}</p>
                <p className="text-[10px] font-semibold text-navy-400 dark:text-slate-500">{s.l}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-navy-400 dark:text-slate-500">{t.heroSchedule}</p>
          <ul className="mt-2 space-y-1.5">
            {tasks.map((t, i) => (
              <li
                key={t.title}
                className="flex items-center gap-2.5 rounded-xl bg-white p-2.5 shadow-sm dark:bg-slate-800"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <span
                  className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg text-[9px] font-bold"
                  style={{ backgroundColor: `${t.color}1a`, color: t.color }}
                >
                  <Clock size={11} weight="bold" />
                  {t.time}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-navy-800 dark:text-white">{t.title}</span>
                  <span className="block text-[10px] text-navy-400 dark:text-slate-500">{t.tag}</span>
                </span>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} aria-hidden="true" />
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Card báo thức nổi – 3D float */}
      <div
        className="absolute -right-4 -top-6 flex animate-hero-float items-center gap-3 rounded-2xl bg-navy-900 p-3 text-white shadow-glow-purple ring-1 ring-white/20 dark:bg-slate-800"
        style={{ animationDelay: '300ms' }}
      >
        <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient">
          <Bell size={18} weight="fill" />
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-ping rounded-full bg-rose-400" />
        </span>
        <span>
          <span className="block text-xs font-bold">{t.heroAlarmTitle}</span>
          <span className="block text-[10px] text-navy-300">{t.heroAlarmSnooze}</span>
        </span>
      </div>
    </div>
  )
}

// ---------- Tính năng ----------
const FEATURES = [
  { icon: ListChecks, color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30', titleKey: 'f1Title', descKey: 'f1Desc' },
  { icon: BellRinging, color: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/30', titleKey: 'f2Title', descKey: 'f2Desc' },
  { icon: ArrowsClockwise, color: 'text-cyan-600 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-900/30', titleKey: 'f3Title', descKey: 'f3Desc' },
  { icon: Clock, color: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30', titleKey: 'f4Title', descKey: 'f4Desc' },
  { icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30', titleKey: 'f5Title', descKey: 'f5Desc' },
  { icon: Fire, color: 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-900/30', titleKey: 'f6Title', descKey: 'f6Desc' },
]

function Features() {
  const t = useT()
  return (
    <section id="tinh-nang" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-purple">{t.featuresLabel}</span>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy-900 dark:text-white sm:text-4xl">
          {t.featuresTitle1} <span className="bg-brand-gradient bg-clip-text text-transparent">{t.featuresTitle2}</span>
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-navy-500 dark:text-slate-400">
          {t.featuresDesc}
        </p>
      </div>
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 perspective-1000">
        {FEATURES.map((f, i) => (
          <article
            key={f.titleKey}
            className="card card-3d group p-6"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${f.color}`}>
              <f.icon size={24} weight="duotone" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-navy-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400">{t[f.titleKey]}</h3>
            <p className="mt-2 text-sm leading-relaxed text-navy-500 dark:text-slate-400">{t[f.descKey]}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

// ---------- Cách hoạt động ----------
function HowItWorks() {
  const t = useT()
  const steps = [
    { icon: Plus, titleKey: 'howStep1Title', descKey: 'howStep1Desc' },
    { icon: Timer, titleKey: 'howStep2Title', descKey: 'howStep2Desc' },
    { icon: BellRinging, titleKey: 'howStep3Title', descKey: 'howStep3Desc' },
    { icon: CheckCircle, titleKey: 'howStep4Title', descKey: 'howStep4Desc' },
  ]
  return (
    <section id="cach-hoat-dong" className="relative overflow-hidden bg-white py-20 dark:bg-slate-900 lg:py-28">
      <div className="absolute inset-0 bg-brand-gradient-soft dark:opacity-50" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-blue">{t.howLabel}</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy-900 dark:text-white sm:text-4xl">
            {t.howTitle1} <span className="bg-brand-gradient bg-clip-text text-transparent">{t.howTitle2}</span>
          </h2>
          <p className="mt-4 text-lg text-navy-500 dark:text-slate-400">
            {t.howDesc}
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 perspective-1000">
          {steps.map((s, i) => (
            <div key={s.titleKey} className="card card-3d relative p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow-blue">
                  <s.icon size={22} weight="bold" />
                </span>
                <span className="text-3xl font-extrabold text-navy-100 dark:text-slate-700">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <h3 className="mt-4 font-bold text-navy-900 dark:text-white">{t[s.titleKey]}</h3>
              <p className="mt-2 text-sm leading-relaxed text-navy-500 dark:text-slate-400">{t[s.descKey]}</p>
            </div>
          ))}
        </div>

        {/* Màn hình báo thức demo – 3D perspective */}
        <div className="mt-16 perspective-1200">
          <div className="overflow-hidden rounded-3xl bg-navy-900 shadow-2xl ring-1 ring-navy-800 dark:bg-slate-800 dark:ring-slate-700" style={{ transformStyle: 'preserve-3d' }}>
            <div className="grid items-center gap-8 p-8 sm:p-12 lg:grid-cols-2">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-3 py-1 text-xs font-bold text-rose-300 ring-1 ring-inset ring-rose-500/30">
                  <BellRinging size={13} weight="fill" /> {t.alarmLabel}
                </span>
                <h3 className="mt-4 text-2xl font-extrabold text-white sm:text-3xl">
                  {t.alarmTitle} <span className="text-cyan-300">{t.alarmTitle2}</span>
                </h3>
                <p className="mt-3 leading-relaxed text-navy-200">
                  {t.alarmDesc}
                </p>
                <ul className="mt-5 space-y-2 text-sm text-navy-200">
                  {[t.alarmList1, t.alarmList2, t.alarmList3].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle size={17} weight="fill" className="mt-0.5 shrink-0 text-cyan-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              {/* Mô phỏng điện thoại – 3D float */}
              <div className="relative mx-auto w-full max-w-[260px] animate-hero-float">
                <div className="rounded-[2.2rem] bg-navy-950 p-2.5 shadow-2xl ring-1 ring-white/10 dark:bg-slate-950">
                  <div className="relative overflow-hidden rounded-[1.7rem] bg-alarm-gradient px-5 pb-6 pt-10">
                    <div className="mx-auto h-1 w-16 rounded-full bg-white/25" />
                    <div className="mt-8 flex flex-col items-center text-center">
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
                        <BellRinging size={26} weight="fill" className="animate-alarm-bell text-cyan-300" />
                      </span>
                      <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.25em] text-white/50">{t.alarmTime}</p>
                      <p className="mt-2 text-base font-extrabold leading-snug text-white">{t.alarmTask}</p>
                      <span className="mt-3 rounded-full bg-purple-400/20 px-2.5 py-0.5 text-[10px] font-bold text-purple-200 ring-1 ring-inset ring-purple-400/30">
                        {t.alarmTag}
                      </span>
                    </div>
                    <div className="mt-8 grid grid-cols-2 gap-2">
                      <span className="flex h-11 items-center justify-center rounded-xl bg-white/15 text-xs font-bold text-white ring-1 ring-white/20">
                        {t.alarmSnooze}
                      </span>
                      <span className="flex h-11 items-center justify-center rounded-xl bg-white text-xs font-extrabold text-navy-900">
                        {t.alarmStop}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------- Đồng bộ + Giới thiệu ----------
function SyncSection() {
  const t = useT()
  return (
    <section id="gioi-thieu" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <div className="relative mx-auto max-w-sm perspective-1000">
            <div className="absolute -inset-4 rounded-[2.5rem] bg-brand-gradient opacity-15 blur-2xl" aria-hidden="true" />
            <div className="relative hero-3d rounded-3xl bg-white p-4 shadow-card-hover ring-1 ring-navy-100 dark:bg-slate-800 dark:ring-slate-700">
              <div className="rounded-2xl bg-navy-900 p-5 text-white dark:bg-slate-950">
                <Logo size={30} dark tagline />
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-navy-200">
                    <ArrowsClockwise size={14} className="text-cyan-300" weight="bold" /> {t.syncBullet1}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-navy-200">
                    <ShieldCheck size={14} className="text-cyan-300" weight="bold" /> {t.syncBullet2}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-navy-200">
                    <Lock size={14} className="text-cyan-300" weight="bold" /> {t.syncBullet3}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-around py-4 text-navy-400 dark:text-slate-500">
                <Monitor size={26} weight="duotone" />
                <ArrowsClockwise size={20} weight="bold" className="animate-spin-slow text-brand-purple" />
                <DeviceMobile size={26} weight="duotone" />
                <ArrowsClockwise size={20} weight="bold" className="animate-spin-slow text-brand-purple" style={{ animationDirection: 'reverse' }} />
                <Globe size={26} weight="duotone" />
              </div>
            </div>
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-cyan">{t.syncLabel}</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy-900 dark:text-white sm:text-4xl">
            {t.syncTitle}
          </h2>
          <p className="mt-4 leading-relaxed text-navy-500 dark:text-slate-400">
            {t.syncDesc}
          </p>
          <div className="mt-6 space-y-4">
            {[
              { icon: Clock, titleKey: 'syncIcon1', descKey: 'syncIcon1Desc' },
              { icon: CheckCircle, titleKey: 'syncIcon2', descKey: 'syncIcon2Desc' },
              { icon: Lightning, titleKey: 'syncIcon3', descKey: 'syncIcon3Desc' },
              { icon: LogoMark, titleKey: 'syncIcon4', descKey: 'syncIcon4Desc' },
            ].map((s) => (
              <div key={s.titleKey} className="flex items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-gradient-soft ring-1 ring-blue-100 dark:ring-blue-900/50">
                  {s.icon === LogoMark ? (
                    <LogoMark size={26} />
                  ) : (
                    <s.icon size={22} weight="duotone" className="text-blue-600 dark:text-blue-400" />
                  )}
                </span>
                <div>
                  <p className="font-bold text-navy-900 dark:text-white">{t[s.titleKey]}</p>
                  <p className="text-sm text-navy-400 dark:text-slate-500">{t[s.descKey]}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------- CTA cuối ----------
function FinalCta() {
  const t = useT()
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <div className="relative overflow-hidden rounded-[2rem] bg-navy-900 px-6 py-14 text-center text-white dark:bg-slate-800 sm:px-12">
        <div className="absolute inset-0 bg-hero-glow dark:bg-hero-glow-dark" aria-hidden="true" />
        <div className="orb animate-glow-pulse h-[300px] w-[300px] bg-blue-500 -top-20 left-1/3" />
        <div className="relative">
          <LogoMark size={52} withRing className="mx-auto animate-bounce-subtle" />
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {t.ctaTagline.split('On Time')[0]}<span className="bg-brand-gradient bg-clip-text text-transparent">On Time.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-navy-200">
            {t.ctaDesc}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/register">
              <Button variant="gradient" size="lg" icon={CaretRight} iconWeight="bold">
                {t.ctaRegister}
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="light" size="lg">
                {t.ctaLogin}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------- Footer ----------
function Footer() {
  const t = useT()
  return (
    <footer id="lien-he" className="border-t border-navy-100 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo size={34} />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-navy-500 dark:text-slate-400">
              {t.footerDesc}
            </p>
            <div className="mt-5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy-300 dark:text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" aria-hidden="true" /> {t.footerPlan}
            </div>
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-navy-400 dark:text-slate-500">{t.footerProduct}</p>
            <ul className="mt-3 space-y-2 text-sm font-medium text-navy-600 dark:text-slate-300">
              <li><a href="#tinh-nang" className="transition hover:text-blue-600 dark:hover:text-blue-400">{t.footerFeatures}</a></li>
              <li><a href="#cach-hoat-dong" className="transition hover:text-blue-600 dark:hover:text-blue-400">{t.footerHowItWorks}</a></li>
              <li><Link to="/register" className="transition hover:text-blue-600 dark:hover:text-blue-400">{t.footerRegister}</Link></li>
              <li><Link to="/login" className="transition hover:text-blue-600 dark:hover:text-blue-400">{t.footerLogin}</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-navy-400 dark:text-slate-500">{t.footerContact}</p>
            <ul className="mt-3 space-y-2 text-sm font-medium text-navy-600 dark:text-slate-300">
              <li>Email: support@mn-qronx.com</li>
              <li>Web: www.mn-qronx.com</li>
              <li className="flex items-center gap-1.5">
                <House size={15} weight="bold" className="text-brand-purple" /> {t.footerProject}
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-navy-100 dark:border-slate-700 pt-6 text-xs text-navy-400 dark:text-slate-500 sm:flex-row">
          <p>{t.footerCopyright}</p>
          <p className="flex items-center gap-1.5">
            <Lock size={13} weight="bold" /> {t.footerSecurity}
          </p>
        </div>
      </div>
    </footer>
  )
}

// ---------- Page ----------
export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-white transition-colors duration-300 dark:bg-slate-900">
      <GuestNav />
      <Hero />
      <Features />
      <HowItWorks />
      <SyncSection />
      <FinalCta />
      <Footer />
    </div>
  )
}
