import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getDueReminders, snoozeReminder, dismissReminder, triggerDemoAlarm } from '../services/reminderService'
import { completeTask } from '../services/taskService'
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

  /**
   * Hoãn nhắc nhở. Nhận số phút khách chọn NGAY TRÊN MÀN HÌNH CHUÔNG; không truyền
   * gì thì dùng mặc định của khách (Cài đặt → Hoãn mặc định).
   */
  const snooze = useCallback(async (minutesOverride) => {
    if (!alarm) return null
    const minutes = Number(minutesOverride) > 0
      ? Number(minutesOverride)
      : alarm.snoozeMinutes ?? settings?.defaultSnoozeMinutes ?? 10
    stopAlarmSound()
    setAlarm(null)
    // Alarm demo chỉ là mô phỏng local → không gọi API
    if (alarm.demo) {
      return { success: true, message: `Đã hoãn nhắc nhở ${minutes} phút`, data: null }
    }
    const res = await snoozeReminder(alarm.id, { snoozeMinutes: minutes })
    return res
  }, [alarm, settings])

  /**
   * "Đã xong việc" — hành động chính tại chỗ, vì việc làm xong đúng lúc chuông kêu
   * là kết thúc tự nhiên nhất của cả vòng nhắc nhở.
   *
   * Thứ tự quan trọng: gọi máy chủ TRƯỚC, chỉ tắt chuông khi việc đã thật sự được
   * đánh dấu xong. Nếu tắt chuông trước rồi API lỗi thì khách tưởng việc đã xong
   * trong khi nó vẫn nằm trong danh sách — đúng loại im lặng tệ nhất.
   *
   * Việc hoàn thành cũng huỷ MỌI nhắc nhở của việc đó ở phía máy chủ, nên chuông
   * thôi kêu (kể cả "nhắc dai") mà không cần gọi thêm đường tắt nhắc nhở nào.
   */
  const complete = useCallback(async () => {
    if (!alarm?.task?.id) return null
    // Chuông demo chỉ là mô phỏng, nên KHÔNG được đụng vào dữ liệu thật. Bấm
    // "Đã xong việc" ở đây mà gọi máy chủ thì việc khách chỉ định xem thử bị
    // đánh dấu xong thật, và hoàn thành việc còn huỷ MỌI nhắc nhở của nó — khách
    // bấm nút "thử" rồi mất luôn nhắc nhở thật của mình. snooze và dismiss đã
    // chặn theo cách này từ trước; complete là chỗ còn sót.
    if (alarm.demo) {
      stopAlarmSound()
      setAlarm(null)
      return {
        success: true,
        message: 'Chế độ thử: đã tắt chuông, việc thật vẫn còn nguyên',
        data: null,
      }
    }
    const res = await completeTask(alarm.task.id)
    if (!res.success) return res
    stopAlarmSound()
    setAlarm(null)
    return res
  }, [alarm])

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
    () => ({ alarm, snooze, complete, dismiss, triggerDemo, demoLoading }),
    [alarm, snooze, complete, dismiss, triggerDemo, demoLoading]
  )

  return <AlarmContext.Provider value={value}>{children}</AlarmContext.Provider>
}

export function useAlarm() {
  const ctx = useContext(AlarmContext)
  if (!ctx) throw new Error('useAlarm phải dùng bên trong AlarmProvider')
  return ctx
}
