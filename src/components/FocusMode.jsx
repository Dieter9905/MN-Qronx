import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Play,
  Pause,
  ArrowCounterClockwise,
  SkipForward,
  Timer,
  Lightning,
  Flame,
  Trophy,
  Coffee,
} from '@phosphor-icons/react'
import { useLanguage } from '../context/LanguageContext'
import { app } from '../i18n/app'

const WORK_DURATION = 25 * 60
const BREAK_DURATION = 5 * 60
const LONG_BREAK_DURATION = 15 * 60
const SESSIONS_BEFORE_LONG = 4

export default function FocusMode({ onClose }) {
  const { lang } = useLanguage()
  const t = app[lang]

  const [mode, setMode] = useState('work') // work | break | longBreak
  const [timeLeft, setTimeLeft] = useState(WORK_DURATION)
  const [isRunning, setIsRunning] = useState(false)
  const [sessions, setSessions] = useState(0)
  const [totalWorkTime, setTotalWorkTime] = useState(0)
  const [completedSessions, setCompletedSessions] = useState(0)
  const [showCelebration, setShowCelebration] = useState(false)
  const intervalRef = useRef(null)

  const totalTime = mode === 'work' ? WORK_DURATION : mode === 'break' ? BREAK_DURATION : LONG_BREAK_DURATION
  const progress = ((totalTime - timeLeft) / totalTime) * 100

  // Timer logic
  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (mode === 'work') setTotalWorkTime((t) => t + 1)
          return prev - 1
        })
      }, 1000)
    } else if (timeLeft === 0) {
      clearInterval(intervalRef.current)
      setIsRunning(false)
      handleSessionComplete()
    }
    return () => clearInterval(intervalRef.current)
  }, [isRunning, timeLeft, mode])

  const handleSessionComplete = useCallback(() => {
    setShowCelebration(true)
    setTimeout(() => setShowCelebration(false), 3000)

    if (mode === 'work') {
      const newSessions = sessions + 1
      setSessions(newSessions)
      setCompletedSessions((p) => p + 1)
      if (newSessions % SESSIONS_BEFORE_LONG === 0) {
        setMode('longBreak')
        setTimeLeft(LONG_BREAK_DURATION)
      } else {
        setMode('break')
        setTimeLeft(BREAK_DURATION)
      }
    } else {
      setMode('work')
      setTimeLeft(WORK_DURATION)
    }
  }, [mode, sessions])

  const toggle = () => setIsRunning((r) => !r)

  const reset = () => {
    setIsRunning(false)
    setMode('work')
    setTimeLeft(WORK_DURATION)
    setSessions(0)
  }

  const skip = () => {
    setIsRunning(false)
    handleSessionComplete()
  }

  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  const formatTotalTime = (s) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  const modeConfig = {
    work: { color: 'from-blue-500 to-purple-600', ring: 'ring-blue-500/30', label: t.focusWork, icon: Lightning },
    break: { color: 'from-emerald-400 to-cyan-500', ring: 'ring-emerald-500/30', label: t.focusBreak, icon: Coffee },
    longBreak: { color: 'from-amber-400 to-orange-500', ring: 'ring-amber-500/30', label: t.focusLongBreak, icon: Coffee },
  }

  const cfg = modeConfig[mode]
  const ModeIcon = cfg.icon

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-navy-900/80 backdrop-blur-md dark:bg-black/80">
      {/* Celebration particles */}
      {showCelebration && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-bounce-subtle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 0.5}s`,
                fontSize: `${16 + Math.random() * 20}px`,
              }}
            >
              {['🎉', '✨', '🔥', '⭐', '💪'][i % 5]}
            </div>
          ))}
        </div>
      )}

      <div className="relative mx-4 w-full max-w-md perspective-1000">
        {/* Background glow */}
        <div
          className={`absolute -inset-8 rounded-full bg-gradient-to-br ${cfg.color} opacity-20 blur-3xl animate-glow-pulse`}
          aria-hidden="true"
        />

        <div className="relative overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-white/20 dark:bg-slate-900 dark:ring-slate-700">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-navy-100 px-6 py-4 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${cfg.color} text-white`}>
                <ModeIcon size={16} weight="bold" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-navy-900 dark:text-white">{t.focusTitle}</h2>
                <p className="text-[11px] text-navy-400 dark:text-slate-500">{cfg.label} · {t.focusRound} {Math.floor(sessions / SESSIONS_BEFORE_LONG) + 1}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-navy-400 transition hover:bg-navy-100 dark:text-slate-500 dark:hover:bg-slate-800"
            >
              ✕
            </button>
          </div>

          {/* Timer Circle */}
          <div className="flex flex-col items-center px-6 py-8">
            <div className="relative h-56 w-56">
              {/* SVG circle */}
              <svg className="h-full w-full -rotate-90" viewBox="0 0 200 200">
                <circle
                  cx="100"
                  cy="100"
                  r="88"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  className="text-navy-100 dark:text-slate-800"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="88"
                  fill="none"
                  strokeWidth="6"
                  strokeLinecap="round"
                  className={`bg-gradient-to-r ${cfg.color}`}
                  stroke="url(#timer-gradient)"
                  strokeDasharray={`${2 * Math.PI * 88}`}
                  strokeDashoffset={`${2 * Math.PI * 88 * (1 - progress / 100)}`}
                  style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
                <defs>
                  <linearGradient id="timer-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={mode === 'work' ? '#3B82F6' : mode === 'break' ? '#34D399' : '#FBBF24'} />
                    <stop offset="100%" stopColor={mode === 'work' ? '#8B5CF6' : mode === 'break' ? '#06B6D4' : '#F97316'} />
                  </linearGradient>
                </defs>
              </svg>

              {/* Center content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-extrabold tracking-tight text-navy-900 dark:text-white font-mono">
                  {formatTime(timeLeft)}
                </span>
                <span className="mt-1 text-xs font-bold uppercase tracking-widest text-navy-400 dark:text-slate-500">
                  {cfg.label}
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={reset}
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-100 text-navy-500 transition-all hover:scale-110 hover:bg-navy-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                title={t.focusReset}
              >
                <ArrowCounterClockwise size={20} weight="bold" />
              </button>
              <button
                onClick={toggle}
                className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${cfg.color} text-white shadow-lg transition-all hover:scale-110 active:scale-95`}
              >
                {isRunning ? <Pause size={28} weight="bold" /> : <Play size={28} weight="bold" className="ml-1" />}
              </button>
              <button
                onClick={skip}
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-100 text-navy-500 transition-all hover:scale-110 hover:bg-navy-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                title={t.focusSkip}
              >
                <SkipForward size={20} weight="bold" />
              </button>
            </div>

            {/* Session dots */}
            <div className="mt-5 flex items-center gap-2">
              {Array.from({ length: SESSIONS_BEFORE_LONG }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${
                    i < sessions % SESSIONS_BEFORE_LONG
                      ? `bg-gradient-to-r ${cfg.color}`
                      : 'bg-navy-200 dark:bg-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="border-t border-navy-100 bg-navy-50/50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-navy-400 dark:text-slate-500">{t.focusStats}</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-lg font-extrabold text-navy-900 dark:text-white">{formatTotalTime(totalWorkTime)}</p>
                <p className="text-[10px] font-semibold text-navy-400 dark:text-slate-500">{t.focusTotalTime}</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-extrabold text-navy-900 dark:text-white">{completedSessions}</p>
                <p className="text-[10px] font-semibold text-navy-400 dark:text-slate-500">{t.focusTotalSessions}</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-extrabold text-navy-900 dark:text-white">🔥 {sessions}</p>
                <p className="text-[10px] font-semibold text-navy-400 dark:text-slate-500">{t.focusStreak}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
