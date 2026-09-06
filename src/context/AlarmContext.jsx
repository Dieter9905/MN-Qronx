import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getDueReminders, snoozeReminder, dismissReminder, triggerDemoAlarm } from '../services/reminderService'
import { getNotificationSettings } from '../services/notificationService'
import { useAuth } from './AuthContext'

const AlarmContext = createContext(null)

// Phát âm thanh báo thức bằng Web Audio API (không cần file asset)
let audioCtx = null

function ensureAudioCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (AC) audioCtx = new AC()
  }
  return audioCtx
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

export function startAlarmSound() {
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

export function stopAlarmSound() {
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
    startAlarmSound()
    // Tự dừng âm thanh nếu không ai thao tác (an toàn demo)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setAlarm((cur) => {
        if (cur) stopAlarmSound()
        return cur
      })
    }, 5 * 60 * 1000)
  }, [settings])

  // Polling dự phòng: kiểm tra reminder đến hạn mỗi 20s + khi mở app
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
    const interval = setInterval(check, 20000)
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
