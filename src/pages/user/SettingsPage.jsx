import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell,
  BellRinging,
  CalendarBlank,
  Copy,
  ArrowClockwise,
  DownloadSimple,
  Devices,
  Play,
  UserCircle,
  Key,
  Plus,
  Trash,
  Monitor,
  DeviceMobile,
  Crown,
  UploadSimple,
  MusicNotes,
  Lock,
} from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import { PLAN_NAMES, PLAN_BADGE, isProPlan, isPaidPlan } from '../../lib/constants'
import {
  getNotificationSettings,
  updateNotificationSettings,
  getCustomSounds,
  importCustomSound,
  deleteCustomSound,
  getCustomSoundUrl,
} from '../../services/notificationService'
import { getDevices, registerCurrentDevice, removeDevice } from '../../services/deviceService'
import { useToast } from '../../components/common/Toast'
import { RoomButton, RoomCard, RoomEmpty, RoomSegmented, RoomSelect, RoomSkeleton, RoomToggle } from '../../components/common/RoomUI'
import { ConfirmDialog } from '../../components/common/Modal'
import { ALARM_SOUNDS, DEFAULT_SNOOZE_OPTIONS, PLATFORM } from '../../lib/constants'
import { relativeTime } from '../../lib/format'
import { startAlarmSound, stopAlarmSound } from '../../context/AlarmContext'
import { pushStatus, enablePush, disablePush, syncPushSubscription } from '../../lib/push'
import { setWeeklyReport, sendTestWeeklyReport } from '../../services/authService'
import { EnvelopeSimple } from '@phosphor-icons/react'
import { getMyIcsUrl, rotateIcsUrl } from '../../services/calendarService'

const TABS = [
  { value: 'notifications', label: 'Thông báo', Icon: Bell },
  { value: 'devices', label: 'Thiết bị', Icon: Devices },
  { value: 'calendar', label: 'Lịch', Icon: CalendarBlank },
]

export default function SettingsPage() {
  const toast = useToast()
  const { user } = useAuth()
  const [tab, setTab] = useState('notifications')
  const [settings, setSettings] = useState(null)
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmDevice, setConfirmDevice] = useState(null)
  const [removing, setRemoving] = useState(false)
  const [customSounds, setCustomSounds] = useState([])
  const [uploading, setUploading] = useState(false)
  // Web Push: bật lên thì nhắc nhở vẫn kêu khi người dùng đóng trình duyệt
  const [push, setPush] = useState({ supported: false, permission: 'default', subscribed: false })
  const [pushBusy, setPushBusy] = useState(false)
  // URL lịch .ics để dán vào Google Calendar / Outlook
  const [icsUrl, setIcsUrl] = useState('')
  const [icsBusy, setIcsBusy] = useState(false)
  // Báo cáo tuần qua email (gói Pro). Mặc định bật — khách phải tự tắt được, nếu
  // không thì thư tuần thành thư rác trong mắt họ.
  const isPro = isProPlan(user?.plan)
  const [weeklyReport, setWeeklyReportOn] = useState(user?.weeklyReportEnabled !== false)
  const [weeklyReportBusy, setWeeklyReportBusy] = useState(false)

  const [testMailBusy, setTestMailBusy] = useState(false)
  const [testMailPreview, setTestMailPreview] = useState(null)

  const onSendTestWeeklyReport = async () => {
    setTestMailBusy(true)
    const res = await sendTestWeeklyReport()
    setTestMailBusy(false)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    // Máy chủ có thể chưa gửi được (hạn mức thư, mạng) nhưng vẫn trả NỘI DUNG thư —
    // hiện ra để khách đọc được thư thay vì chỉ thấy báo lỗi trống.
    setTestMailPreview(res.data)
    if (res.data?.sent) toast.success(res.message)
    else toast.error(res.message)
  }

  const saveWeeklyReport = async (enabled) => {
    setWeeklyReportBusy(true)
    try {
      const res = await setWeeklyReport(enabled)
      if (!res.success) {
        toast.error(res.message)
        return
      }
      setWeeklyReportOn(res.data.weeklyReportEnabled)
      toast.success(res.data.weeklyReportEnabled ? 'Đã bật báo cáo tuần qua email' : 'Đã tắt báo cáo tuần qua email')
    } catch {
      toast.error('Không kết nối được máy chủ. Thử lại sau ít phút.')
    } finally {
      setWeeklyReportBusy(false)
    }
  }

  useEffect(() => {
    let alive = true
    pushStatus().then((s) => {
      if (alive) setPush(s)
    })
    // Đã cho quyền rồi thì tự đăng ký lại subscription (endpoint có thể đã đổi
    // từ lần mở trước) để máy chủ không gửi vào địa chỉ cũ.
    syncPushSubscription()
      .then(() => pushStatus())
      .then((s) => {
        if (alive) setPush(s)
      })
    return () => {
      alive = false
    }
  }, [])

  const togglePush = async (next) => {
    if (pushBusy) return
    setPushBusy(true)
    const res = next ? await enablePush() : await disablePush()
    setPush(await pushStatus())
    setPushBusy(false)
    if (res.success) toast.success(res.message)
    else toast.error(res.message)
  }
  const fileInputRef = useRef(null)
  const plan = user?.plan || 'FREE'
  const isPaid = isPaidPlan(plan)

  const loadCustomSounds = async () => {
    const res = await getCustomSounds()
    if (res.success) setCustomSounds(res.data || [])
  }

  const load = async () => {
    const [sRes, dRes, iRes] = await Promise.all([
      getNotificationSettings(),
      getDevices(),
      getMyIcsUrl().catch(() => null),
    ])
    if (sRes.success) setSettings(sRes.data)
    if (dRes.success) setDevices(dRes.data)
    if (iRes?.success) setIcsUrl(iRes.data?.url || '')
    setLoading(false)
    loadCustomSounds()
  }

  useEffect(() => {
    load()
    // load đọc các getter động nên chỉ chạy đúng một lần khi vào trang SETTINGS
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fmtSize = (bytes) => {
    if (!bytes) return ''
    return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  // Chọn tệp MP3 từ máy → upload lên server
  const onPickFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!isPaid) {
      toast.error('Nhập âm thanh MP3 chỉ dành cho gói Plus/Pro')
      return
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error('Tệp âm thanh tối đa 3 MB')
      return
    }
    if (!/^audio\//.test(file.type) && !/\.(mp3|wav|ogg|m4a|aac|mp4)$/i.test(file.name)) {
      toast.error('Vui lòng chọn tệp âm thanh (MP3, WAV, OGG…)')
      return
    }
    setUploading(true)
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('Không đọc được tệp'))
        reader.readAsDataURL(file)
      })
      const dataBase64 = dataUrl.split(',')[1] || ''
      const res = await importCustomSound({
        name: file.name,
        mimeType: file.type || 'audio/mpeg',
        dataBase64,
      })
      if (!res.success) {
        toast.error(res.message || 'Không thể tải âm thanh lên')
        return
      }
      await loadCustomSounds()
      await saveSettings({ alarmSound: `custom:${res.data.id}` })
      toast.success(`Đã thêm “${res.data.name}” làm âm thanh báo thức 🎵`)
    } catch (err) {
      toast.error(err.message || 'Lỗi khi đọc tệp')
    } finally {
      setUploading(false)
    }
  }

  const previewCustom = async (sound) => {
    stopAlarmSound()
    const url = await getCustomSoundUrl(sound.id)
    const el = new Audio(url)
    el.volume = 1
    el.play().catch(() => {})
    setTimeout(() => {
      try {
        el.pause()
      } catch {
        /* noop */
      }
    }, 3000)
  }

  const onDeleteCustom = async (sound) => {
    const res = await deleteCustomSound(sound.id)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    await loadCustomSounds()
    // Đang dùng âm thanh này → quay về chuông mặc định
    if (settings?.alarmSound === `custom:${sound.id}`) {
      await saveSettings({ alarmSound: 'classic' })
      toast.success('Đã xóa âm thanh (báo thức quay về mặc định)')
    } else {
      toast.success('Đã xóa âm thanh')
    }
  }

  const saveSettings = async (patch, message) => {
    setSaving(true)
    const res = await updateNotificationSettings(patch)
    setSaving(false)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    setSettings(res.data)
    if (message) toast.success(message)
  }

  const previewSound = () => {
    stopAlarmSound()
    setTimeout(() => startAlarmSound(settings?.alarmSound), 100)
    setTimeout(() => stopAlarmSound(), 4200)
  }

  const registerDevice = async () => {
    const res = await registerCurrentDevice()
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success('Đã đăng ký thiết bị hiện tại')
    load()
  }

  const doRemoveDevice = async () => {
    if (!confirmDevice) return
    setRemoving(true)
    const res = await removeDevice(confirmDevice.id)
    setRemoving(false)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success('Đã gỡ thiết bị')
    setConfirmDevice(null)
    load()
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="space-y-2">
          <RoomSkeleton className="h-8 w-56" />
          <RoomSkeleton className="h-5 w-96" />
        </div>
        <RoomSkeleton className="h-11" />
        <RoomSkeleton className="h-96" />
      </div>
    )
  }

  const platformIcon = (platform) => (platform === 'WEB' ? Monitor : DeviceMobile)

  const copyIcsUrl = async () => {
    try {
      await navigator.clipboard.writeText(icsUrl)
      toast.success('Đã copy link lịch')
    } catch {
      toast.error('Không copy được, bạn chép tay giúp mình nhé')
    }
  }

  const doRotateIcs = async () => {
    setIcsBusy(true)
    const res = await rotateIcsUrl()
    setIcsBusy(false)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    setIcsUrl(res.data?.url || '')
    toast.success('Đã tạo khoá mới — link cũ đã ngừng hoạt động. Nhớ thêm lại link mới vào app lịch nhé!')
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-room-ink">Cài đặt</h1>
        <p className="mt-1 text-sm font-semibold text-room-ink/50">
          Tùy chỉnh cách MN-Qronx nhắc nhở bạn và quản lý thiết bị nhận thông báo
        </p>
      </div>

      <div
        className="flex gap-1 rounded-xl bg-room-oat/70 p-1 ring-1 ring-room-acorn/15"
        role="tablist"
        aria-label="Cài đặt"
      >
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 font-display text-sm font-bold transition ${
              tab === t.value
                ? 'bg-room-paper text-room-ink shadow-[0_6px_12px_-8px_rgb(0_0_0/0.25)] ring-1 ring-room-acorn/30'
                : 'text-room-ink/55 hover:text-room-ink'
            }`}
          >
            {t.Icon && <t.Icon size={17} weight="duotone" />}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'notifications' && (
        <RoomCard className="space-y-2 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 border-b border-room-acorn/15 pb-4">
            <div>
              <h2 className="flex items-center gap-2 font-display font-bold text-room-ink">
                <BellRinging size={19} weight="duotone" className="text-room-bell" />
                Cài đặt thông báo
              </h2>
              <p className="mt-0.5 text-xs font-semibold text-room-ink/45">Áp dụng cho mọi báo thức được kích hoạt</p>
            </div>
            {saving && <span className="text-xs font-semibold text-room-ink/45">Đang lưu…</span>}
          </div>

          <div className="px-1 py-2">
            <label className="mb-1.5 block text-sm font-bold text-room-ink">Âm thanh báo thức</label>
            <div className="flex gap-2">
              <RoomSelect
                value={settings.alarmSound}
                onChange={(e) => saveSettings({ alarmSound: e.target.value }, 'Đã đổi âm thanh báo thức')}
                aria-label="Âm thanh báo thức"
                className="h-10 flex-1"
              >
                {ALARM_SOUNDS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
                {customSounds.length > 0 && (
                  <optgroup label="Âm thanh của tôi">
                    {customSounds.map((s) => (
                      <option key={`custom:${s.id}`} value={`custom:${s.id}`}>{s.name}</option>
                    ))}
                  </optgroup>
                )}
              </RoomSelect>
              <RoomButton variant="secondary" icon={Play} onClick={previewSound} aria-label="Nghe thử âm thanh">
                <span className="hidden sm:inline">Nghe thử</span>
              </RoomButton>
            </div>

            {/* Nhập âm thanh MP3 từ máy – Plus/Pro */}
            {isPaid ? (
              <div className="mt-3 space-y-2 rounded-xl bg-room-oat/40 p-3 ring-1 ring-inset ring-room-acorn/15">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-room-ink/70">
                    <MusicNotes size={15} weight="bold" className="text-room-bell" />
                    Âm thanh riêng của bạn ({customSounds.length}/10)
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac"
                    className="hidden"
                    onChange={onPickFile}
                    aria-label="Chọn tệp âm thanh từ máy"
                  />
                  <RoomButton
                    variant="secondary"
                    size="sm"
                    icon={UploadSimple}
                    loading={uploading}
                    disabled={customSounds.length >= 10}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Nhập MP3 từ máy
                  </RoomButton>
                </div>
                {customSounds.length === 0 ? (
                  <p className="text-xs font-semibold text-room-ink/50">
                    Chưa có âm thanh nào – nhập file MP3 (tối đa 3 MB) từ máy để làm chuông báo thức riêng.
                  </p>
                ) : (
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {customSounds.map((s) => (
                      <li key={s.id} className="flex items-center gap-2 rounded-lg bg-room-paper px-2.5 py-2 ring-1 ring-inset ring-room-acorn/20">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                            settings?.alarmSound === `custom:${s.id}`
                              ? 'bg-room-bell/25 text-room-bell ring-1 ring-inset ring-room-bell/40'
                              : 'bg-room-oat/70 text-room-ink/45'
                          }`}
                        >
                          <MusicNotes size={14} weight="bold" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-room-ink/90">{s.name}</p>
                          <p className="text-[10px] font-semibold text-room-ink/35">{fmtSize(s.sizeBytes)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => previewCustom(s)}
                          aria-label={`Nghe thử ${s.name}`}
                          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-room-ink/40 transition hover:bg-room-oat/75 hover:text-room-ink"
                        >
                          <Play size={13} weight="fill" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteCustom(s)}
                          aria-label={`Xóa ${s.name}`}
                          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-room-ink/40 transition hover:bg-room-rain/40 hover:text-room-ink"
                        >
                          <Trash size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-room-bell/20 px-3 py-2.5 ring-1 ring-inset ring-room-bell/40">
                <Lock size={15} weight="bold" className="shrink-0 text-room-bell" />
                <p className="text-xs font-bold text-room-ink/80">
                  Nhập âm thanh MP3 của riêng bạn là tính năng của gói Plus/Pro.{' '}
                  <Link to="/app/billing" className="font-bold underline">Nâng cấp ngay</Link>
                </p>
              </div>
            )}
          </div>

          <div className="px-1 py-2">
            <label className="mb-1.5 block text-sm font-bold text-room-ink">Thời gian hoãn mặc định</label>
            <RoomSegmented
              options={DEFAULT_SNOOZE_OPTIONS.map((m) => ({ value: String(m), label: `${m} phút` }))}
              value={String(settings.defaultSnoozeMinutes)}
              onChange={(v) => saveSettings({ defaultSnoozeMinutes: Number(v) }, `Đã đặt hoãn mặc định ${v} phút`)}
            />
            <p className="mt-1.5 text-xs font-semibold text-room-ink/45">Áp dụng khi bạn bấm nút “Hoãn” trên màn hình báo thức.</p>
          </div>

          <div className="px-1 py-2">
            <RoomToggle
              label="Rung khi báo thức"
              description="Rung thiết bị cùng lúc phát âm thanh (chỉ áp dụng trên Mobile App)"
              checked={settings.vibrationEnabled}
              onChange={(v) => saveSettings({ vibrationEnabled: v }, v ? 'Đã bật rung' : 'Đã tắt rung')}
            />
          </div>

          <div className="px-1 py-2">
            <RoomToggle
              label="Nhắc khi đóng trình duyệt"
              description="Thông báo đẩy (Web Push): máy chủ gửi tận nơi nên chuông vẫn kêu dù bạn đã đóng tab — bật cho từng máy bạn muốn."
              checked={push.subscribed && push.permission === 'granted'}
              onChange={togglePush}
            />
            {push.supported && push.permission === 'denied' && (
              <p className="mt-1.5 rounded-xl bg-room-rain/30 px-3 py-2 text-xs font-bold text-room-ink">
                Trình duyệt đang chặn thông báo của trang này — mở cài đặt trình duyệt, cho phép rồi tắt/bật lại.
              </p>
            )}
            {!push.supported && (
              <p className="mt-1.5 text-xs font-semibold text-room-ink/45">
                Trình duyệt này chưa hỗ trợ Web Push — thử Chrome, Edge hoặc Safari.
              </p>
            )}
          </div>

          {/* Báo cáo tuần qua email — quyền lợi gói Pro */}
          <div className="px-1 py-2">
            <RoomToggle
              label="Báo cáo tuần qua email"
              description="Sáng thứ 2 hằng tuần, MN-Qronx gửi email tóm tắt: tuần rồi bạn xong bao nhiêu việc, đúng hạn bao nhiêu, việc nào đang quá hạn, và tuần này có gì chờ. Không cần mở app vẫn biết tình hình."
              checked={weeklyReport && isPro}
              disabled={!isPro || weeklyReportBusy}
              onChange={saveWeeklyReport}
            />
            {!isPro ? (
              <p className="mt-1.5 text-xs font-bold text-room-ink/60">
                Báo cáo tuần là quyền lợi của gói Pro.{' '}
                <Link to="/app/billing" className="underline">
                  Nâng cấp Pro
                </Link>{' '}
                để nhận thư mỗi sáng thứ 2.
              </p>
            ) : (
              <>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <RoomButton
                    variant="secondary"
                    size="sm"
                    icon={EnvelopeSimple}
                    onClick={onSendTestWeeklyReport}
                    loading={testMailBusy}
                    disabled={weeklyReportBusy}
                  >
                    Gửi thử cho tôi ngay
                  </RoomButton>
                  <span className="text-xs font-semibold text-room-ink/45">
                    Thư thật chỉ đi mỗi sáng thứ 2 — bấm đây để xem trước nội dung.
                  </span>
                </div>
                {testMailPreview && (
                  <div className="mt-2 rounded-xl bg-room-oat/45 p-3 ring-1 ring-inset ring-room-acorn/15">
                    <p className="text-xs font-bold text-room-ink/85">
                      {testMailPreview.sent
                        ? `Đã gửi tới ${testMailPreview.email}`
                        : 'Máy chủ chưa gửi được email — nội dung thư ở dưới là thư sẽ gửi:'}
                    </p>
                    {testMailPreview.subject && (
                      <p className="mt-1 text-xs font-semibold text-room-ink/60">
                        Tiêu đề: “{testMailPreview.subject}”
                      </p>
                    )}
                    {testMailPreview.preview && (
                      <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-room-paper p-2.5 text-[11px] font-semibold leading-relaxed text-room-ink/70 ring-1 ring-inset ring-room-acorn/20">
                        {testMailPreview.preview}
                      </pre>
                    )}
                  </div>
                )}
              </>
            )}
            {isPro && (
              <p className="mt-1.5 text-xs font-semibold text-room-ink/45">
                Cũng có thể xem ngay trong app ở mục “Báo cáo năng suất”.
              </p>
            )}
          </div>
        </RoomCard>
      )}

      {tab === 'devices' && (
        <RoomCard className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-room-acorn/15 pb-4">
            <div>
              <h2 className="flex items-center gap-2 font-display font-bold text-room-ink">
                <Devices size={19} weight="duotone" className="text-room-acorn" />
                Thiết bị nhận thông báo
              </h2>
              <p className="mt-0.5 text-xs font-semibold text-room-ink/45">
                Báo thức sẽ được gửi tới mọi thiết bị đang hoạt động của bạn
              </p>
            </div>
            <RoomButton variant="secondary" size="sm" icon={Plus} onClick={registerDevice}>
              Đăng ký thiết bị này
            </RoomButton>
          </div>

          {devices.length === 0 ? (
            <RoomEmpty
              icon={Devices}
              title="Chưa có thiết bị nào"
              description="Đăng ký trình duyệt hoặc điện thoại để nhận báo thức đẩy."
              action={
                <RoomButton size="sm" icon={Plus} onClick={registerDevice}>
                  Đăng ký thiết bị này
                </RoomButton>
              }
            />
          ) : (
            <ul className="mt-4 space-y-2.5">
              {devices.map((d) => {
                const Icon = platformIcon(d.platform)
                return (
                  <li key={d.id} className="flex items-center gap-4 rounded-xl bg-room-oat/40 p-3.5 ring-1 ring-inset ring-room-acorn/10">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-room-paper text-room-acorn ring-1 ring-inset ring-room-acorn/20">
                      <Icon size={21} weight="duotone" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-room-ink">{d.name}</p>
                      <p className="text-xs font-semibold text-room-ink/45">
                        {PLATFORM[d.platform]} · Hoạt động {relativeTime(d.lastSeenAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmDevice(d)}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 font-display text-[13px] font-bold text-room-ink/55 ring-1 ring-room-acorn/25 transition hover:bg-room-rain/40 hover:text-room-ink"
                    >
                      <Trash size={14} weight="bold" />
                      Gỡ
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </RoomCard>
      )}

      {tab === 'calendar' && (
        <RoomCard className="space-y-4 p-5 sm:p-6">
          <div className="border-b border-room-acorn/15 pb-4">
            <h2 className="flex items-center gap-2 font-display font-bold text-room-ink">
              <CalendarBlank size={19} weight="duotone" className="text-room-acorn" />
              Đồng bộ lịch (.ics)
            </h2>
            <p className="mt-0.5 text-xs font-semibold text-room-ink/45">
              Dán link vào Google Calendar hoặc Outlook một lần — việc của bạn tự xuất hiện ở đó và app lịch tự làm mới.
            </p>
          </div>

          <div className="px-1 py-1">
            <label className="mb-1.5 block text-sm font-bold text-room-ink">Link lịch của bạn</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={icsUrl}
                onFocus={(e) => e.target.select()}
                placeholder="Đang tạo link…"
                aria-label="Link lịch .ics"
                className="h-11 min-w-0 flex-1 truncate rounded-xl bg-room-oat/40 px-3.5 font-mono text-xs font-semibold text-room-ink/80 ring-1 ring-inset ring-room-acorn/20 outline-none transition focus:ring-2 focus:ring-room-acorn"
              />
              <RoomButton variant="secondary" icon={Copy} onClick={copyIcsUrl} disabled={!icsUrl}>
                Copy
              </RoomButton>
            </div>
            <p className="mt-1.5 text-xs font-semibold text-room-ink/50">
              Google Calendar: <b>Cài đặt → Thêm lịch → Từ URL</b>. Outlook: <b>Thêm lịch → Đăng ký từ web</b>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-1">
            <a
              href={`${icsUrl}${icsUrl ? '.ics' : ''}`}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex cursor-pointer items-center gap-2 rounded-full bg-room-acorn px-4 py-2 font-display text-sm font-bold text-room-paper shadow-[0_14px_26px_-12px_rgb(0_0_0/0.30)] transition hover:brightness-[0.96] ${!icsUrl ? 'pointer-events-none opacity-50' : ''}`}
            >
              <DownloadSimple size={16} weight="bold" />
              Tải tệp .ics
            </a>
            <RoomButton variant="secondary" icon={ArrowClockwise} loading={icsBusy} disabled={!icsUrl} onClick={doRotateIcs}>
              Tạo lại khoá
            </RoomButton>
          </div>

          <div className="rounded-xl bg-room-rain/30 px-3 py-2.5 ring-1 ring-inset ring-room-rain">
            <p className="text-xs font-bold text-room-ink/80">
              Ai có link này cũng xem được việc của bạn — đừng chia sẻ công khai. Nghi link bị lộ thì bấm “Tạo lại khoá”, link cũ ngừng hoạt động ngay.
            </p>
          </div>
        </RoomCard>
      )}

      {/* Liên kết tài khoản */}
      <RoomCard className="divide-y divide-room-acorn/15 p-2">
        <Link to="/app/billing" className="flex items-center gap-3 rounded-xl p-3.5 transition hover:bg-room-oat/60">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-room-bell/25 text-room-bell ring-1 ring-inset ring-room-bell/40">
            <Crown size={20} weight="duotone" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-bold text-room-ink">Gói của bạn</span>
            <span className="block text-xs font-semibold text-room-ink/45">Nâng cấp Plus / Pro để mở rộng giới hạn</span>
          </span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-extrabold ring-1 ring-inset ${PLAN_BADGE[user?.plan || 'FREE']}`}>
            {PLAN_NAMES[user?.plan || 'FREE']}
          </span>
        </Link>
        <Link to="/app/profile" className="flex items-center gap-3 rounded-xl p-3.5 transition hover:bg-room-oat/60">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-room-oat/60 text-room-acorn ring-1 ring-inset ring-room-acorn/25">
            <UserCircle size={20} weight="duotone" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-bold text-room-ink">Hồ sơ cá nhân</span>
            <span className="block text-xs font-semibold text-room-ink/45">Cập nhật họ tên, số điện thoại</span>
          </span>
        </Link>
        <Link to="/app/change-password" className="flex items-center gap-3 rounded-xl p-3.5 transition hover:bg-room-oat/60">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-room-rain/40 text-room-ink/55 ring-1 ring-inset ring-room-rain">
            <Key size={20} weight="duotone" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-bold text-room-ink">Đổi mật khẩu</span>
            <span className="block text-xs font-semibold text-room-ink/45">Thay đổi mật khẩu đăng nhập</span>
          </span>
        </Link>
      </RoomCard>

      <ConfirmDialog
        open={!!confirmDevice}
        onClose={() => setConfirmDevice(null)}
        onConfirm={doRemoveDevice}
        title="Gỡ thiết bị?"
        message={`Thiết bị “${confirmDevice?.name}” sẽ không còn nhận báo thức. Bạn có chắc chắn muốn gỡ?`}
        confirmLabel="Gỡ thiết bị"
        danger
        loading={removing}
        skin="room"
      />
    </div>
  )
}
