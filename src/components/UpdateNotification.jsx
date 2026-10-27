import { useState, useEffect } from 'react'
import { Sparkle, CheckCircle, TrendUp, Wrench, ArrowRight, Rocket } from '@phosphor-icons/react'
import { updates, APP_VERSION } from '../data/updates'

const STORAGE_KEY = 'mnq:lastSeenVersion'

function getLastSeenVersion() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function setLastSeenVersion(version) {
  try {
    localStorage.setItem(STORAGE_KEY, version)
  } catch {
    // ignore
  }
}

function getNewUpdates() {
  const lastSeen = getLastSeenVersion()
  if (!lastSeen) {
    // First time - show latest update
    return updates.slice(0, 1)
  }
  return updates.filter((u) => u.version > lastSeen)
}

const changeTypeConfig = {
  feature: { icon: Sparkle, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30' },
  improvement: { icon: TrendUp, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
  fix: { icon: Wrench, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30' },
}

export default function UpdateNotification() {
  const [show, setShow] = useState(false)
  const [newUpdates, setNewUpdates] = useState([])
  const [currentUpdateIndex, setCurrentUpdateIndex] = useState(0)
  const [currentChangeIndex, setCurrentChangeIndex] = useState(0)
  const [showAllChanges, setShowAllChanges] = useState(false)

  useEffect(() => {
    const updates = getNewUpdates()
    if (updates.length > 0) {
      setNewUpdates(updates)
      // Show after a short delay
      const timer = setTimeout(() => setShow(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleClose = () => {
    setShow(false)
    setLastSeenVersion(APP_VERSION)
  }

  const handleNext = () => {
    const current = newUpdates[currentUpdateIndex]
    if (!showAllChanges && currentChangeIndex < current.changes.length - 1) {
      setCurrentChangeIndex((i) => i + 1)
    } else if (currentUpdateIndex < newUpdates.length - 1) {
      setCurrentUpdateIndex((i) => i + 1)
      setCurrentChangeIndex(0)
      setShowAllChanges(false)
    } else {
      handleClose()
    }
  }

  const handleShowAll = () => {
    setShowAllChanges(true)
  }

  if (!show || newUpdates.length === 0) return null

  const currentUpdate = newUpdates[currentUpdateIndex]
  const visibleChanges = showAllChanges
    ? currentUpdate.changes
    : currentUpdate.changes.slice(0, currentChangeIndex + 1)
  const isLastChange = showAllChanges || currentChangeIndex >= currentUpdate.changes.length - 1
  const isLastUpdate = currentUpdateIndex >= newUpdates.length - 1

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-900/60 p-4 backdrop-blur-sm dark:bg-black/70">
      <div className="relative w-full max-w-lg animate-scale-in">
        {/* Khung giới hạn 90% chiều cao màn hình: đầu + chân (nút bấm) ghim cố định,
            phần nội dung ở giữa tự cuộn — nút "Bỏ qua / Tiếp theo" luôn nhìn thấy. */}
        <div className="flex max-h-[90dvh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-navy-100 dark:bg-slate-900 dark:ring-slate-700">
          {/* Header with gradient */}
          <div className="relative shrink-0 overflow-hidden bg-brand-gradient px-6 py-6">
            {/* Decorative circles */}
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
            <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/10" />
            
            <div className="relative">
              <div className="flex items-center gap-2">
                <Rocket size={24} weight="fill" className="text-white" />
                <span className="text-sm font-bold text-white/80">Cập nhật mới</span>
              </div>
              <h2 className="mt-2 text-2xl font-extrabold text-white">
                {currentUpdate.title}
              </h2>
              <p className="mt-1 text-sm text-white/80">
                Phiên bản {currentUpdate.version} • {currentUpdate.date}
              </p>
            </div>
          </div>

          {/* Nội dung có thể cuộn khi dài hơn màn hình */}
          <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Highlights */}
          <div className="border-b border-navy-100 px-6 py-4 dark:border-slate-700">
            <p className="text-xs font-bold uppercase tracking-wider text-navy-400 dark:text-slate-500">
              Điểm nổi bật
            </p>
            <ul className="mt-2 space-y-1.5">
              {currentUpdate.highlights.map((highlight, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-navy-700 dark:text-slate-300">
                  <CheckCircle size={16} weight="fill" className="mt-0.5 shrink-0 text-emerald-500" />
                  {highlight}
                </li>
              ))}
            </ul>
          </div>

          {/* Changes */}
          <div className="px-6 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-navy-400 dark:text-slate-500">
              Thay đổi chi tiết
            </p>
            <div className="mt-3 space-y-3">
              {visibleChanges.map((change, i) => {
                const config = changeTypeConfig[change.type]
                const Icon = config.icon
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-xl p-3 transition-all duration-300 animate-slide-up"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.bg}`}>
                      <Icon size={20} weight="fill" className={config.color} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-navy-900 dark:text-white">
                        {change.icon} {change.title}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-navy-500 dark:text-slate-400">
                        {change.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Show all button */}
            {!showAllChanges && currentUpdate.changes.length > currentChangeIndex + 1 && (
              <button
                type="button"
                onClick={handleShowAll}
                className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg bg-navy-50 py-2 text-xs font-bold text-navy-600 transition hover:bg-navy-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Xem tất cả {currentUpdate.changes.length} thay đổi
                <ArrowRight size={14} weight="bold" />
              </button>
            )}
          </div>
          </div>

          {/* Progress dots */}
          {newUpdates.length > 1 && (
            <div className="flex shrink-0 items-center justify-center gap-1.5 pb-2">
              {newUpdates.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === currentUpdateIndex ? 'w-6 bg-blue-500' : 'w-1.5 bg-navy-200 dark:bg-slate-600'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Actions — ghim đáy, luôn hiện dù nội dung dài */}
          <div className="shrink-0 border-t border-navy-100 px-6 py-4 dark:border-slate-700">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-xl border border-navy-200 bg-white py-2.5 text-sm font-bold text-navy-600 transition hover:bg-navy-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Bỏ qua
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-gradient py-2.5 text-sm font-bold text-white shadow-glow-blue transition-all hover:scale-[1.02] active:scale-95"
              >
                {isLastChange && isLastUpdate ? (
                  'Đã hiểu!'
                ) : (
                  <>
                    Tiếp theo
                    <ArrowRight size={16} weight="bold" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
