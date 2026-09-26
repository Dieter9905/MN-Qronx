import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getDueReminders, snoozeReminder, dismissReminder, triggerDemoAlarm } from '../services/reminderService'
import { getNotificationSettings, getCustomSoundUrl } from '../services/notificationService'
import { useAuth } from './AuthContext'

const AlarmContext = createContext(null)

// ── Phát âm thanh báo thức ────────────────────────────────
// - Âm thanh tùy chỉnh (custom:<id>) → phát đúng file MP3 người dùng import
// - Các âm thanh mặc định → nhạc chuông Web Audio API (không cần file asset)
let audioCtx = null
let audioEl = null
let lastSoundCode = null

function ensureAudioCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (AC) audioCtx = new AC()
  }
  return audioCtx
}

function stopCustomAudio() {
  if (audioEl) {
    try {
      audioEl.pause()
      audioEl.currentTime = 0
    } catch {
      /* noop */
    }
  }
}

function beep(ctx, when, freq, duration) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  osc.connect(gain)
  gain.connect(ctx.destination)
  const t0 = ctx.currentTime + when
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.start(t0)
  osc.stop(t0 + duration + 0.05)
}

function playBeeps() {
  const ctx = ensureAudioCtx()
  if (!ctx) return
  if (ctx.state === 'suspended') ctx.resume()
  // Chuỗi "ring ring – pause" lặp lại
  beep(ctx, 0, 880, 0.45)
  beep(ctx, 0.55, 880, 0.45)
  beep(ctx, 1.25, 1046, 0.45)
  beep(ctx, 1.8, 1046, 0.45)
  beep(ctx, 2.6, 1318, 0.6)
  beep(ctx, 3.5, 1046, 0.9)
}

/**
 * Bắt đầu phát âm thanh báo thức.
 * @param {string} [code] Mã âm thanh đang chọn (custom:<id> hoặc preset).
 *                        Không truyền → phát lại âm thanh gần nhất đã reo.
 */
export async function startAlarmSound(code) {
  if (code !== undefined) lastSoundCode = code
  stopCustomAudio()
  const soundCode = lastSoundCode

  // Âm thanh do người dùng import → phát file MP3
  if (typeof soundCode === 'string' && soundCode.startsWith('custom:')) {
    const id = soundCode.slice('custom:'.length)
    try {
      const url = await getCustomSoundUrl(id)
      if (!audioEl) {
        audioEl = new Audio()
        audioEl.loop = true
      }
      audioEl.src = url
      audioEl.volume = 1
      await audioEl.play().catch(() => {
        /* trình duyệt chặn autoplay → thử lại qua tương tác */
      })
      return
    } catch {
      // Không tải được file (xóa/đổi thiết bị) → đổ chuông mặc định
    }
  }

  playBeeps()
}

export function stopAlarmSound() {
  stopCustomAudio()
  if (audioCtx) {
    try {
      audioCtx.close()
    } catch {
      /* noop */
    }
    audioCtx = null
  }
}

export function AlarmProvider({ children }) {
  const { user } = useAuth()
  const [alarm, setAlarm] = useState(null)
  const [demoLoading, setDemoLoading] = useState(false)
  const [settings, setSettings] = useState(null)
  const timerRef = useRef(null)

  // Tải cài đặt thông báo (defaultSnoozeMinutes) khi có user
  useEffect(() => {
    if (!user) {
      setSettings(null)
      return undefined
    }
    let cancelled = false
    getNotificationSettings()
      .then((res) => {
        if (!cancelled && res.success) setSettings(res.data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user])

  const fire = useCallback((reminder) => {
    const minutes = settings?.defaultSnoozeMinutes ?? reminder?.snoozeMinutes ?? 10
    setAlarm((current) => (current ? current : { ...reminder, snoozeMinutes: minutes }))
    startAlarmSound(settings?.alarmSound)
    // Tự dừng âm thanh nếu không ai thao tác (an toàn demo)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setAlarm((cur) => {
        if (cur) stopAlarmSound()
        return cur
      })
    }, 5 * 60 * 1000)
  }, [settings])

  // Polling dự phòng: kiểm tra reminder đến hạn mỗi 60s + khi mở app.
  // Trước đây 20s ⇒ mỗi tab mở gọi API ~4.300 lần/ngày (tốn pin, dữ liệu di động
  // và cả giờ chạy của web service gói free). Nhịp 60s trùng với cron nhắc nhở
  // phía máy chủ (reminderScheduler chạy mỗi phút) nên báo thức vẫn đúng phút.
  useEffect(() => {
    if (!user) return undefined
    let cancelled = false
    const check = async () => {
      try {
        const res = await getDueReminders()
        if (cancelled) return
        if (res.success && res.data.length > 0) {
          fire(res.data[0])
        }
      } catch {
        /* phiên hết hạn – bỏ qua */
      }
    }
    check()
    const interval = setInterval(check, 60000)
    return () => {
      cancelled = true
      clearInterval(interval)
      if (timerRef.current) clearTimeout(timerRef.current)
      stopAlarmSound()
    }
  }, [user, fire])

  const snooze = useCallback(async () => {
    if (!alarm) return null
    const minutes = alarm.snoozeMinutes ?? settings?.defaultSnoozeMinutes ?? 10
    stopAlarmSound()
    setAlarm(null)
    // Alarm demo chỉ là mô phỏng local → không gọi API
    if (alarm.demo) {
      return { success: true, message: `Đã hoãn nhắc nhở ${minutes} phút`, data: null }
    }
    const res = await snoozeReminder(alarm.id, { snoozeMinutes: minutes })
    return res
  }, [alarm, settings])

  const dismiss = useCallback(async () => {
    if (!alarm) return null
    stopAlarmSound()
    setAlarm(null)
    if (alarm.demo) {
      return { success: true, message: 'Đã tắt nhắc nhở', data: null }
    }
    const res = await dismissReminder(alarm.id)
    return res
  }, [alarm])

  const triggerDemo = useCallback(
    async (taskId) => {
      setDemoLoading(true)
      try {
        const res = await triggerDemoAlarm(taskId)
        if (res.success) fire(res.data)
        return res
      } finally {
        setDemoLoading(false)
      }
    },
    [fire]
  )

  const value = useMemo(
    () => ({ alarm, snooze, dismiss, triggerDemo, demoLoading }),
    [alarm, snooze, dismiss, triggerDemo, demoLoading]
  )

  return <AlarmContext.Provider value={value}>{children}</AlarmContext.Provider>
}

export function useAlarm() {
  const ctx = useContext(AlarmContext)
  if (!ctx) throw new Error('useAlarm phải dùng bên trong AlarmProvider')
  return ctx
}
