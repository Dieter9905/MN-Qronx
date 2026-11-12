import { useState, useEffect } from 'react'
import { Sparkle, CheckCircle, TrendUp, Wrench, ArrowRight, Rocket } from '@phosphor-icons/react'
import { updates, APP_VERSION } from '../data/updates'
import { useAuth } from '../context/AuthContext'

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

// Config loại thay đổi — da phòng: Acorn (tính năng), Sage đậm (cải thiện),
// Bell (sửa lỗi); nền nhạt token tương ứng, không gradient.
const changeTypeConfig = {
  feature: { icon: Sparkle, color: 'text-room-acorn', bg: 'bg-room-oat/60' },
  improvement: { icon: TrendUp, color: 'text-room-sage', bg: 'bg-room-moss/60' },
  fix: { icon: Wrench, color: 'text-room-bell', bg: 'bg-room-oat/60' },
}

export default function UpdateNotification() {
  const { user } = useAuth()
  const [show, setShow] = useState(false)
  const [newUpdates, setNewUpdates] = useState([])
  const [currentUpdateIndex, setCurrentUpdateIndex] = useState(0)
  const [currentChangeIndex, setCurrentChangeIndex] = useState(0)
  const [showAllChanges, setShowAllChanges] = useState(false)

  useEffect(() => {
    // Khách chưa đăng nhập không cần bảng tin cập nhật sản phẩm nội bộ —
    // landing công khai phải để khung đầu trọn vẹn (phòng mẫu là nhân vật chính).
    if (!user) return undefined
    const updates = getNewUpdates()
    if (updates.length > 0) {
      setNewUpdates(updates)
      // Show after a short delay
      const timer = setTimeout(() => setShow(true), 1500)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [user])

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-room-ink/40 p-4 dark:bg-black/70">
      <div className="relative w-full max-w-lg animate-scale-in">
        {/* Khung giới hạn 90% chiều cao màn hình: đầu + chân (nút bấm) ghim cố định,
            phần nội dung ở giữa tự cuộn — nút "Bỏ qua / Tiếp theo" luôn nhìn thấy. */}
        <div className="flex max-h-[90dvh] flex-col overflow-hidden rounded-3xl bg-room-paper shadow-[0_28px_56px_-28px_rgb(0_0_0/0.40)] ring-1 ring-room-acorn/25">
          {/* Header phẳng: tên bản cập nhật + phiên bản (không gradient) */}
          <div className="relative shrink-0 px-6 pb-4 pt-6">
            <div className="flex items-center gap-2">
              <Rocket size={22} weight="bold" className="text-room-acorn" />
              <span className="text-[13px] font-bold text-room-ink/65">Cập nhật mới</span>
            </div>
            <h2 className="mt-1.5 font-display text-xl font-bold text-room-ink">
              {currentUpdate.title}
            </h2>
            <p className="mt-1 text-sm font-semibold text-room-ink/65">
              Phiên bản {currentUpdate.version} • {currentUpdate.date}
            </p>
          </div>

          {/* Nội dung có thể cuộn khi dài hơn màn hình */}
          <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Highlights */}
          <div className="border-b border-room-acorn/15 px-6 py-4">
            <p className="text-sm font-bold text-room-ink">
              Điểm nổi bật
            </p>
            <ul className="mt-2 space-y-1.5">
              {currentUpdate.highlights.map((highlight, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-room-ink/80">
                  <CheckCircle size={16} weight="fill" className="mt-0.5 shrink-0 text-room-sage" />
                  {highlight}
                </li>
              ))}
            </ul>
          </div>

          {/* Changes */}
          <div className="px-6 py-4">
            <p className="text-sm font-bold text-room-ink">
              Thay đổi chi tiết
            </p>
            <div className="mt-3 space-y-3">
              {visibleChanges.map((change, i) => {
                const config = changeTypeConfig[change.type]
                const Icon = config.icon
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-xl p-3 transition-colors duration-200 hover:bg-room-oat/40"
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.bg}`}>
                      <Icon size={20} weight="fill" className={config.color} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-room-ink">
                        {change.title}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-room-ink/65">
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
                className="mt-3 flex w-full items-center justify-center gap-1 rounded-full bg-room-oat/70 py-2 text-xs font-bold text-room-ink transition hover:bg-room-oat"
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
                    i === currentUpdateIndex ? 'w-6 bg-room-acorn' : 'w-1.5 bg-room-acorn/25'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Actions — ghim đáy, luôn hiện dù nội dung dài */}
          <div className="shrink-0 border-t border-room-acorn/15 px-6 py-4">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 cursor-pointer rounded-full border border-room-acorn/40 py-2.5 text-sm font-bold text-room-ink transition hover:bg-room-oat/60"
              >
                Bỏ qua
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-room-acorn py-2.5 text-sm font-bold text-room-paper shadow-[0_14px_26px_-12px_rgb(0_0_0/0.30)] transition-all hover:brightness-[0.96] active:scale-[0.99]"
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
