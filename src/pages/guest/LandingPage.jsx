import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ListChecks,
  BellRinging,
  ArrowsClockwise,
  Clock,
  CheckCircle,
  Lightning,
  CaretRight,
  DeviceMobile,
  Monitor,
  Globe,
  Plus,
  House,
  UserCirclePlus,
  Bell,
  Fire,
  ShieldCheck,
  Lock,
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
import { EXTENSION_STORE_URL } from '../../lib/constants'
import { DESKTOP_DOWNLOAD_URL } from '../../lib/constants'

// ---------- Helper ----------
function useT() {
  const { lang } = useLanguage()
  return landing[lang]
}

// ---------- Scroll reveal hook ----------
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

// ---------- Mouse tilt hook ----------
function useMouseTilt(ref, { maxTilt = 8, scale = 1.02 } = {}) {
  const rafRef = useRef(null)
  const handleMove = useCallback((e) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width
      const y = (e.clientY - rect.top) / rect.height
      const tiltX = (0.5 - y) * maxTilt
      const tiltY = (x - 0.5) * maxTilt
      el.style.transform = `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(${scale})`
    })
  }, [ref, maxTilt, scale])
  const handleLeave = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const el = ref.current
    if (el) el.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)'
  }, [ref])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.addEventListener('mousemove', handleMove)
    el.addEventListener('mouseleave', handleLeave)
    return () => {
      el.removeEventListener('mousemove', handleMove)
      el.removeEventListener('mouseleave', handleLeave)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [ref, handleMove, handleLeave])
}

// ---------- Parallax hook ----------
function useParallax(speed = 0.3) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let ticking = false
    const handleScroll = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(() => {
          const rect = el.getBoundingClientRect()
          const offset = (rect.top - window.innerHeight / 2) * speed
          el.style.transform = `translateY(${offset}px)`
          ticking = false
        })
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [speed])
  return ref
}

// ---------- ThemeToggle ----------
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      onClick={toggleTheme}
      className="group relative flex h-9 w-9 items-center justify-center rounded-xl bg-navy-100/70 text-navy-600 transition-all duration-300 hover:scale-110 hover:bg-navy-200 hover:shadow-glow-blue dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
      aria-label={theme === 'light' ? 'Chế độ tối' : 'Chế độ sáng'}
    >
      <span className="transition-transform duration-300 group-hover:rotate-180">
        {theme === 'light' ? <Moon size={18} weight="bold" /> : <Sun size={18} weight="bold" />}
      </span>
    </button>
  )
}

// ---------- LangToggle ----------
function LangToggle() {
  const { lang, toggleLang } = useLanguage()
  return (
    <button
      onClick={toggleLang}
      className="flex h-9 items-center gap-1 rounded-xl bg-navy-100/70 px-3 text-xs font-bold text-navy-600 transition-all duration-300 hover:scale-110 hover:bg-navy-200 hover:shadow-glow-blue dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
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
    <header className="sticky top-0 z-40 border-b border-navy-100/60 bg-white/80 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" aria-label="MN-Qronx – Trang chủ">
          <Logo size={34} />
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-semibold text-navy-600 dark:text-slate-300 md:flex" aria-label="Điều hướng">
          {[
            { href: '#tinh-nang', label: t.navFeatures },
            { href: '#cach-hoat-dong', label: t.navHowItWorks },
            { href: '#gioi-thieu', label: t.navAbout },
            { href: '#lien-he', label: t.navContact },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="relative py-1 transition-colors hover:text-blue-600 dark:hover:text-blue-400 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-brand-gradient after:transition-all after:duration-300 hover:after:w-full"
            >
              {item.label}
            </a>
          ))}
            <Link
              to="/pricing"
              className="relative py-1 transition-colors hover:text-blue-600 dark:hover:text-blue-400 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-brand-gradient after:transition-all after:duration-300 hover:after:w-full"
            >
              Bảng giá
            </Link>
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
  const heroCardRef = useRef(null)
  const heroSectionRef = useRef(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  useMouseTilt(heroCardRef, { maxTilt: 12, scale: 1.03 })

  useEffect(() => {
    const handleMouseMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2
      const y = (e.clientY / window.innerHeight - 0.5) * 2
      setMousePos({ x, y })
    }
    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <section ref={heroSectionRef} className="relative overflow-hidden bg-gradient-to-b from-navy-50 via-white to-blue-50 text-navy-900 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 dark:text-white">
      {/* Animated orbs with parallax */}
      <div
        className="orb animate-glow-pulse h-[600px] w-[600px] bg-blue-500 -top-48 -left-48"
        style={{ transform: `translate(${mousePos.x * -20}px, ${mousePos.y * -20}px)` }}
      />
      <div
        className="orb animate-glow-pulse h-[500px] w-[500px] bg-purple-500 -bottom-40 -right-40"
        style={{ animationDelay: '1.5s', transform: `translate(${mousePos.x * 15}px, ${mousePos.y * 15}px)` }}
      />
      <div
        className="orb animate-glow-pulse h-[300px] w-[300px] bg-cyan-400 top-1/3 left-1/2"
        style={{ animationDelay: '3s', transform: `translate(${mousePos.x * -10}px, ${mousePos.y * 10}px)` }}
      />
      <div className="absolute inset-0 bg-hero-glow dark:bg-hero-glow-dark" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" aria-hidden="true" />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03]" aria-hidden="true"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:pb-28 lg:pt-24">
        <div className="animate-slide-up">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 shadow-sm ring-1 ring-inset ring-navy-200 backdrop-blur-sm dark:bg-white/10 dark:text-cyan-300 dark:shadow-none dark:ring-white/15">
            <Lightning size={14} weight="fill" className="animate-pulse" />
            {t.heroBadge}
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-[1.12] tracking-tight sm:text-5xl lg:text-[3.4rem]">
            {t.heroTitle1}
            <br />
            <span className="bg-brand-gradient bg-clip-text text-transparent text-shimmer">{t.heroTitle2}</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-navy-600 dark:text-navy-200">
            {t.heroDesc}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/register">
              <Button variant="gradient" size="lg" icon={CaretRight} iconWeight="bold" className="glow-ring">
                {t.heroCta}
              </Button>
            </Link>
            <a href="#tinh-nang">
              <Button variant="light" size="lg">
                {t.heroCtaSecondary}
              </Button>
            </a>
            <a href={DESKTOP_DOWNLOAD_URL} download>
              <Button variant="light" size="lg" icon={Monitor}>
                {t.heroDesktopCta}
              </Button>
            </a>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold text-navy-600 dark:text-navy-300">
            {[
              { icon: CheckCircle, text: t.heroFreeTrial },
              { icon: CheckCircle, text: t.heroSync },
              { icon: CheckCircle, text: t.heroNoCard },
            ].map((item, i) => (
              <span key={i} className="flex items-center gap-1.5 transition-colors hover:text-blue-600 dark:hover:text-cyan-300">
                <item.icon size={16} weight="fill" className="text-cyan-500 dark:text-cyan-400" /> {item.text}
              </span>
            ))}
          </div>
        </div>

        {/* Hero visual – 3D tilt card */}
        <div className="relative mx-auto w-full max-w-md animate-slide-up" style={{ animationDelay: '120ms' }}>
          <HeroVisual cardRef={heroCardRef} mousePos={mousePos} />
        </div>
      </div>
    </section>
  )
}

function HeroVisual({ cardRef, mousePos }) {
  const t = useT()
  const tasks = [
    { time: '09:00', title: t.heroTask1, color: '#8B5CF6', tag: t.heroTag1 },
    { time: '14:30', title: t.heroTask2, color: '#2563EB', tag: t.heroTag2 },
    { time: '19:00', title: t.heroTask3, color: '#06B6D4', tag: t.heroTag3 },
  ]
  return (
    <div className="relative">
      {/* Background glow with parallax */}
      <div
        className="absolute -inset-8 rounded-[2.5rem] bg-brand-gradient opacity-20 blur-3xl animate-glow-pulse"
        aria-hidden="true"
        style={{ transform: `translate(${mousePos.x * 10}px, ${mousePos.y * 10}px)` }}
      />
      <div ref={cardRef} className="relative mouse-tilt rounded-3xl bg-white/95 p-4 shadow-2xl ring-1 ring-white/40 dark:bg-slate-800/95 dark:ring-slate-600/40">
        {/* Thanh trình duyệt */}
        <div className="flex items-center gap-2 px-1 pb-3">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400 transition-transform hover:scale-125" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400 transition-transform hover:scale-125" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 transition-transform hover:scale-125" />
          <span className="ml-2 flex-1 rounded-md bg-navy-50 px-3 py-1 text-[11px] font-medium text-navy-400 dark:bg-slate-700 dark:text-slate-400">
            app.mn-qronx.id.vn
          </span>
        </div>
        {/* Dashboard mini */}
        <div className="rounded-2xl bg-navy-50/70 p-4 dark:bg-slate-900/70">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-navy-900 dark:text-white">{t.heroGreeting}</p>
              <p className="text-xs text-navy-400 dark:text-slate-500">{t.heroDate}</p>
            </div>
            <span className="rounded-full bg-brand-gradient px-3 py-1 text-[11px] font-bold text-white shadow-glow-blue">
              5 · 3 ✅
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { n: '5', l: t.heroTasks, c: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
              { n: '3', l: t.heroDone, c: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
              { n: '2', l: t.heroRemaining, c: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
            ].map((s) => (
              <div key={s.l} className={`rounded-xl ${s.bg} p-2.5 text-center transition-transform hover:scale-105`}>
                <p className={`text-lg font-extrabold ${s.c}`}>{s.n}</p>
                <p className="text-[10px] font-semibold text-navy-400 dark:text-slate-500">{s.l}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-navy-400 dark:text-slate-500">{t.heroSchedule}</p>
          <ul className="mt-2 space-y-1.5">
            {tasks.map((task, i) => (
              <li
                key={task.title}
                className="flex items-center gap-2.5 rounded-xl bg-white p-2.5 shadow-sm transition-all duration-300 hover:translate-x-1 hover:shadow-md dark:bg-slate-800"
              >
                <span
                  className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg text-[9px] font-bold"
                  style={{ backgroundColor: `${task.color}1a`, color: task.color }}
                >
                  <Clock size={11} weight="bold" />
                  {task.time}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-navy-800 dark:text-white">{task.title}</span>
                  <span className="block text-[10px] text-navy-400 dark:text-slate-500">{task.tag}</span>
                </span>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: task.color }} aria-hidden="true" />
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Card báo thức nổi – 3D float */}
      <div
        className="absolute -right-4 -top-6 flex items-center gap-3 rounded-2xl bg-white p-3 text-navy-900 shadow-xl ring-1 ring-navy-200 transition-all duration-300 hover:scale-105 dark:bg-slate-800 dark:text-white dark:shadow-glow-purple dark:ring-white/20"
        style={{
          animation: 'floatVaried 7s ease-in-out infinite',
          animationDelay: '300ms',
        }}
      >
        <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient shadow-glow-blue">
          <Bell size={18} weight="fill" />
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-ping rounded-full bg-rose-400" />
        </span>
        <span>
          <span className="block text-xs font-bold">{t.heroAlarmTitle}</span>
          <span className="block text-[10px] text-navy-500 dark:text-navy-300">{t.heroAlarmSnooze}</span>
        </span>
      </div>

      {/* Floating accent dots */}
      <div className="absolute -bottom-4 -left-6 h-3 w-3 rounded-full bg-cyan-400/60 animate-pulse" />
      <div className="absolute -top-2 left-1/4 h-2 w-2 rounded-full bg-purple-400/60 animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute bottom-1/4 -right-8 h-4 w-4 rounded-full bg-blue-400/40 animate-pulse" style={{ animationDelay: '2s' }} />
    </div>
  )
}

// ---------- Tính năng ----------
const FEATURES = [
  { icon: ListChecks, color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30', titleKey: 'f1Title', descKey: 'f1Desc', gradient: 'from-blue-500 to-blue-600' },
  { icon: BellRinging, color: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/30', titleKey: 'f2Title', descKey: 'f2Desc', gradient: 'from-purple-500 to-purple-600' },
  { icon: ArrowsClockwise, color: 'text-cyan-600 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-900/30', titleKey: 'f3Title', descKey: 'f3Desc', gradient: 'from-cyan-500 to-cyan-600' },
  { icon: Clock, color: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30', titleKey: 'f4Title', descKey: 'f4Desc', gradient: 'from-amber-500 to-amber-600' },
  { icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30', titleKey: 'f5Title', descKey: 'f5Desc', gradient: 'from-emerald-500 to-emerald-600' },
  { icon: Fire, color: 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-900/30', titleKey: 'f6Title', descKey: 'f6Desc', gradient: 'from-rose-500 to-rose-600' },
]

function Features() {
  const t = useT()
  const sectionRef = useScrollReveal()
  return (
    <section id="tinh-nang" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
      <div ref={sectionRef} className="reveal mx-auto max-w-2xl text-center">
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
          <FeatureCard key={f.titleKey} feature={f} index={i} t={t} />
        ))}
      </div>
    </section>
  )
}

function FeatureCard({ feature: f, index: i, t }) {
  const cardRef = useRef(null)
  const revealRef = useScrollReveal()

  useMouseTilt(cardRef, { maxTilt: 8, scale: 1.03 })

  return (
    <article
      ref={(el) => {
        cardRef.current = el
        revealRef.current = el
      }}
      className="reveal card card-3d depth-shadow group p-6"
      style={{ transitionDelay: `${i * 0.08}s` }}
    >
      <div className={`relative flex h-12 w-12 items-center justify-center rounded-xl ${f.color} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
        <f.icon size={24} weight="duotone" />
      </div>
      <h3 className="mt-4 text-lg font-bold text-navy-900 transition-colors duration-300 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400">{t[f.titleKey]}</h3>
      <p className="mt-2 text-sm leading-relaxed text-navy-500 dark:text-slate-400">{t[f.descKey]}</p>
    </article>
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
  const sectionRef = useScrollReveal()
  const parallaxRef = useParallax(0.05)

  return (
    <section id="cach-hoat-dong" className="relative overflow-hidden bg-white py-20 dark:bg-slate-900 lg:py-28">
      <div className="absolute inset-0 bg-brand-gradient-soft dark:opacity-50" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div ref={sectionRef} className="reveal mx-auto max-w-2xl text-center">
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
            <StepCard key={s.titleKey} step={s} index={i} t={t} />
          ))}
        </div>

        {/* Màn hình báo thức demo – 3D perspective */}
        <div ref={parallaxRef} className="mt-16 perspective-1200">
          <div className="overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-navy-100 dark:bg-slate-800 dark:ring-slate-700" style={{ transformStyle: 'preserve-3d' }}>
            <div className="grid items-center gap-8 p-8 sm:p-12 lg:grid-cols-2">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-500 ring-1 ring-inset ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30">
                  <BellRinging size={13} weight="fill" className="animate-alarm-bell" /> {t.alarmLabel}
                </span>
                <h3 className="mt-4 text-2xl font-extrabold text-navy-900 dark:text-white sm:text-3xl">
                  {t.alarmTitle} <span className="bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent dark:from-cyan-300 dark:to-blue-300">{t.alarmTitle2}</span>
                </h3>
                <p className="mt-3 leading-relaxed text-navy-600 dark:text-navy-200">
                  {t.alarmDesc}
                </p>
                <ul className="mt-5 space-y-2 text-sm text-navy-600 dark:text-navy-200">
                  {[t.alarmList1, t.alarmList2, t.alarmList3].map((item) => (
                    <li key={item} className="flex items-start gap-2 transition-colors hover:text-blue-600 dark:hover:text-cyan-300">
                      <CheckCircle size={17} weight="fill" className="mt-0.5 shrink-0 text-cyan-500 dark:text-cyan-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              {/* Mô phỏng điện thoại – 3D float */}
              <div className="relative mx-auto w-full max-w-[260px]">
                <div className="float-varied rounded-[2.2rem] bg-navy-950 p-2.5 shadow-2xl ring-1 ring-white/10 dark:bg-slate-950">
                  <div className="relative overflow-hidden rounded-[1.7rem] bg-alarm-gradient px-5 pb-6 pt-10">
                    <div className="mx-auto h-1 w-16 rounded-full bg-white/25" />
                    <div className="mt-8 flex flex-col items-center text-center">
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20 transition-transform hover:scale-110">
                        <BellRinging size={26} weight="fill" className="animate-alarm-bell text-cyan-300" />
                      </span>
                      <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.25em] text-white/50">{t.alarmTime}</p>
                      <p className="mt-2 text-base font-extrabold leading-snug text-white">{t.alarmTask}</p>
                      <span className="mt-3 rounded-full bg-purple-400/20 px-2.5 py-0.5 text-[10px] font-bold text-purple-200 ring-1 ring-inset ring-purple-400/30">
                        {t.alarmTag}
                      </span>
                    </div>
                    <div className="mt-8 grid grid-cols-2 gap-2">
                      <span className="flex h-11 items-center justify-center rounded-xl bg-white/15 text-xs font-bold text-white ring-1 ring-white/20 transition-all hover:bg-white/25 hover:scale-105">
                        {t.alarmSnooze}
                      </span>
                      <span className="flex h-11 items-center justify-center rounded-xl bg-white text-xs font-extrabold text-navy-900 transition-all hover:scale-105 shadow-glow-blue">
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

function StepCard({ step: s, index: i, t }) {
  const cardRef = useRef(null)
  const revealRef = useScrollReveal()

  useMouseTilt(cardRef, { maxTilt: 6, scale: 1.02 })

  return (
    <div
      ref={(el) => {
        cardRef.current = el
        revealRef.current = el
      }}
      className="reveal card card-3d depth-shadow relative p-6"
      style={{ transitionDelay: `${i * 0.1}s` }}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow-blue transition-transform duration-300 group-hover:scale-110">
          <s.icon size={22} weight="bold" />
        </span>
        <span className="text-3xl font-extrabold text-navy-300 dark:text-slate-700">{String(i + 1).padStart(2, '0')}</span>
      </div>
      <h3 className="mt-4 font-bold text-navy-900 dark:text-white">{t[s.titleKey]}</h3>
      <p className="mt-2 text-sm leading-relaxed text-navy-500 dark:text-slate-400">{t[s.descKey]}</p>
    </div>
  )
}

// ---------- Đồng bộ + Giới thiệu ----------
function SyncSection() {
  const t = useT()
  const leftRef = useScrollReveal()
  const rightRef = useScrollReveal()
  const syncCardRef = useRef(null)

  useMouseTilt(syncCardRef, { maxTilt: 6, scale: 1.02 })

  return (
    <section id="gioi-thieu" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div ref={leftRef} className="reveal-left order-2 lg:order-1">
          <div className="relative mx-auto max-w-sm perspective-1000">
            <div className="absolute -inset-4 rounded-[2.5rem] bg-brand-gradient opacity-15 blur-2xl" aria-hidden="true" />
            <div ref={syncCardRef} className="relative mouse-tilt rounded-3xl bg-white p-4 depth-shadow ring-1 ring-navy-100 dark:bg-slate-800 dark:ring-slate-700">
              <div className="rounded-2xl bg-white p-5 text-navy-900 shadow-lg ring-1 ring-navy-100 dark:bg-slate-950 dark:text-white dark:shadow-none dark:ring-0">
                <Logo size={30} tagline />
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-navy-600 transition-colors hover:text-blue-600 dark:text-navy-200 dark:hover:text-cyan-300">
                    <ArrowsClockwise size={14} className="text-cyan-600 dark:text-cyan-300" weight="bold" /> {t.syncBullet1}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-navy-600 transition-colors hover:text-blue-600 dark:text-navy-200 dark:hover:text-cyan-300">
                    <ShieldCheck size={14} className="text-cyan-600 dark:text-cyan-300" weight="bold" /> {t.syncBullet2}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-navy-600 transition-colors hover:text-blue-600 dark:text-navy-200 dark:hover:text-cyan-300">
                    <Lock size={14} className="text-cyan-600 dark:text-cyan-300" weight="bold" /> {t.syncBullet3}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-around py-4 text-navy-400 dark:text-slate-500">
                <Monitor size={26} weight="duotone" className="transition-transform hover:scale-110 hover:text-blue-500" />
                <ArrowsClockwise size={20} weight="bold" className="animate-spin-slow text-brand-purple" />
                <DeviceMobile size={26} weight="duotone" className="transition-transform hover:scale-110 hover:text-blue-500" />
                <ArrowsClockwise size={20} weight="bold" className="animate-spin-slow text-brand-purple" style={{ animationDirection: 'reverse' }} />
                <Globe size={26} weight="duotone" className="transition-transform hover:scale-110 hover:text-blue-500" />
              </div>
            </div>
          </div>
        </div>
        <div ref={rightRef} className="reveal-right order-1 lg:order-2">
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
              <div key={s.titleKey} className="group flex items-center gap-4 rounded-xl p-2 transition-all duration-300 hover:bg-navy-50/50 dark:hover:bg-slate-800/50">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-gradient-soft ring-1 ring-blue-100 transition-all duration-300 group-hover:scale-110 group-hover:shadow-glow-blue dark:ring-blue-900/50">
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
  const sectionRef = useScrollReveal()
  const ctaCardRef = useRef(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  useMouseTilt(ctaCardRef, { maxTilt: 4, scale: 1.01 })

  useEffect(() => {
    const el = ctaCardRef.current
    if (!el) return
    const handleMouseMove = (e) => {
      const rect = el.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width
      const y = (e.clientY - rect.top) / rect.height
      setMousePos({ x, y })
    }
    el.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => el.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <div ref={sectionRef} className="reveal-scale relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-50 via-white to-violet-50 px-6 py-14 text-center text-navy-900 ring-1 ring-navy-100 dark:from-slate-800 dark:via-slate-800 dark:to-slate-800 dark:text-white dark:ring-slate-700 sm:px-12">
        <div className="absolute inset-0 bg-hero-glow dark:bg-hero-glow-dark" aria-hidden="true" />
        <div
          className="orb animate-glow-pulse h-[300px] w-[300px] bg-blue-500 -top-20 left-1/3"
          style={{ transform: `translate(${(mousePos.x - 0.5) * -30}px, ${(mousePos.y - 0.5) * -30}px)` }}
        />
        <div
          className="orb animate-glow-pulse h-[200px] w-[200px] bg-purple-500 top-1/2 right-1/4"
          style={{ animationDelay: '1.5s', transform: `translate(${(mousePos.x - 0.5) * 20}px, ${(mousePos.y - 0.5) * 20}px)` }}
        />
        <div ref={ctaCardRef} className="relative mouse-tilt">
          <LogoMark size={52} withRing className="mx-auto animate-bounce-subtle" />
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {t.ctaTagline.split('On Time')[0]}<span className="bg-brand-gradient bg-clip-text text-transparent">On Time.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-navy-600 dark:text-navy-200">
            {t.ctaDesc}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/register">
              <Button variant="gradient" size="lg" icon={CaretRight} iconWeight="bold" className="glow-ring">
                {t.ctaRegister}
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="light" size="lg">
                {t.ctaLogin}
              </Button>
            </Link>
            {EXTENSION_STORE_URL ? (
              <a href={EXTENSION_STORE_URL} target="_blank" rel="noreferrer">
                <Button variant="light" size="lg" icon={Lightning} iconWeight="bold">
                  Cài tiện ích Chrome miễn phí
                </Button>
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------- Footer ----------
function Footer() {
  const t = useT()
  const footerRef = useScrollReveal()

  return (
    <footer id="lien-he" className="border-t border-navy-100 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div ref={footerRef} className="reveal mx-auto max-w-6xl px-4 py-12 sm:px-6">
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
              <li><a href="#tinh-nang" className="transition-colors hover:text-blue-600 dark:hover:text-blue-400">{t.footerFeatures}</a></li>
              <li><a href="#cach-hoat-dong" className="transition-colors hover:text-blue-600 dark:hover:text-blue-400">{t.footerHowItWorks}</a></li>
              <li><Link to="/register" className="transition-colors hover:text-blue-600 dark:hover:text-blue-400">{t.footerRegister}</Link></li>
              <li><Link to="/login" className="transition-colors hover:text-blue-600 dark:hover:text-blue-400">{t.footerLogin}</Link></li>
              <li><Link to="/pricing" className="transition-colors hover:text-blue-600 dark:hover:text-blue-400">Bảng giá</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-navy-400 dark:text-slate-500">{t.footerContact}</p>
            <ul className="mt-3 space-y-2 text-sm font-medium text-navy-600 dark:text-slate-300">
              <li>Email: support@mn-qronx.id.vn</li>
              <li>Web: www.mn-qronx.id.vn</li>
              <li className="flex items-center gap-1.5 transition-colors hover:text-blue-600 dark:hover:text-blue-400">
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
