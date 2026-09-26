import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell,
  BellRinging,
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
import { PLAN_NAMES, PLAN_BADGE } from '../../lib/constants'
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
import { Skeleton, EmptyState } from '../../components/common/Feedback'
import Button from '../../components/common/Button'
import { Toggle, SegmentedControl, Select } from '../../components/common/Inputs'
import { ConfirmDialog } from '../../components/common/Modal'
import { ALARM_SOUNDS, DEFAULT_SNOOZE_OPTIONS, PLATFORM } from '../../lib/constants'
import { relativeTime } from '../../lib/format'
import { startAlarmSound, stopAlarmSound } from '../../context/AlarmContext'
import { pushStatus, enablePush, disablePush, syncPushSubscription } from '../../lib/push'

const TABS = [
  { value: 'notifications', label: 'Thông báo' },
  { value: 'devices', label: 'Thiết bị' },
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
  const isPaid = plan === 'PLUS' || plan === 'PRO'

  const loadCustomSounds = async () => {
    const res = await getCustomSounds()
    if (res.success) setCustomSounds(res.data || [])
  }

  const load = async () => {
    const [sRes, dRes] = await Promise.all([getNotificationSettings(), getDevices()])
    if (sRes.success) setSettings(sRes.data)
    if (dRes.success) setDevices(dRes.data)
    setLoading(false)
    loadCustomSounds()
  }

  useEffect(() => {
    load()
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
      <div className="space-y-5">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  const platformIcon = (platform) => (platform === 'WEB' ? Monitor : DeviceMobile)

  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-fade-in">
      <div>
        <h1 className="page-title dark:text-white">Cài đặt</h1>
        <p className="mt-1 text-sm font-medium text-navy-400 dark:text-slate-500">
          Tùy chỉnh cách MN-Qronx nhắc nhở bạn và quản lý thiết bị nhận thông báo
        </p>
      </div>

      <div className="flex rounded-xl bg-white p-1 shadow-card ring-1 ring-navy-100 dark:bg-slate-800 dark:ring-slate-700" role="tablist" aria-label="Cài đặt">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition ${
              tab === t.value ? 'bg-navy-900 text-white dark:bg-blue-600' : 'text-navy-500 hover:text-navy-800 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            {t.value === 'notifications' ? <Bell size={17} weight="bold" /> : <Devices size={17} weight="bold" />}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'notifications' ? (
        <section className="card space-y-2 p-5 sm:p-6 dark:bg-slate-800">
          <div className="flex items-center justify-between gap-3 border-b border-navy-100 pb-4">
            <div>
              <h2 className="flex items-center gap-2 font-bold text-navy-900 dark:text-white">
                <BellRinging size={19} weight="fill" className="text-amber-500 dark:text-amber-400" />
                Cài đặt thông báo
              </h2>
              <p className="mt-0.5 text-xs text-navy-400 dark:text-slate-500">Áp dụng cho mọi báo thức được kích hoạt</p>
            </div>
            {saving && <span className="text-xs font-semibold text-blue-600">Đang lưu…</span>}
          </div>

          <div className="px-1 py-2">
            <label className="mb-1.5 block text-sm font-semibold text-navy-800 dark:text-white">Âm thanh báo thức</label>
            <div className="flex gap-2">
              <Select
                value={settings.alarmSound}
                onChange={(e) => saveSettings({ alarmSound: e.target.value }, 'Đã đổi âm thanh báo thức')}
                aria-label="Âm thanh báo thức"
                className="flex-1"
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
              </Select>
              <Button variant="secondary" icon={Play} onClick={previewSound} aria-label="Nghe thử âm thanh">
                <span className="hidden sm:inline">Nghe thử</span>
              </Button>
            </div>

            {/* Nhập âm thanh MP3 từ máy – Plus/Pro */}
            {isPaid ? (
              <div className="mt-3 space-y-2 rounded-xl bg-navy-50/70 p-3 ring-1 ring-inset ring-navy-100 dark:bg-slate-900/50 dark:ring-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-navy-600 dark:text-slate-300">
                    <MusicNotes size={15} weight="bold" className="text-purple-500" />
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
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={UploadSimple}
                    loading={uploading}
                    disabled={customSounds.length >= 10}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Nhập MP3 từ máy
                  </Button>
                </div>
                {customSounds.length === 0 ? (
                  <p className="text-xs text-navy-400 dark:text-slate-500">
                    Chưa có âm thanh nào – nhập file MP3 (tối đa 3 MB) từ máy để làm chuông báo thức riêng.
                  </p>
                ) : (
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {customSounds.map((s) => (
                      <li key={s.id} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 ring-1 ring-inset ring-navy-100 dark:bg-slate-800 dark:ring-slate-600">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                            settings?.alarmSound === `custom:${s.id}`
                              ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300'
                              : 'bg-navy-100 text-navy-500 dark:bg-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <MusicNotes size={14} weight="bold" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-navy-800 dark:text-slate-200">{s.name}</p>
                          <p className="text-[10px] text-navy-400 dark:text-slate-500">{fmtSize(s.sizeBytes)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => previewCustom(s)}
                          aria-label={`Nghe thử ${s.name}`}
                          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-navy-400 transition hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400"
                        >
                          <Play size={13} weight="fill" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteCustom(s)}
                          aria-label={`Xóa ${s.name}`}
                          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-navy-400 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
                        >
                          <Trash size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50/70 px-3 py-2.5 ring-1 ring-inset ring-amber-200 dark:bg-amber-900/20 dark:ring-amber-800/50">
                <Lock size={15} weight="bold" className="shrink-0 text-amber-500 dark:text-amber-400" />
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  Nhập âm thanh MP3 của riêng bạn là tính năng của gói Plus/Pro.{' '}
                  <Link to="/app/billing" className="font-bold underline">Nâng cấp ngay</Link>
                </p>
              </div>
            )}
          </div>

          <div className="px-1 py-2">
            <label className="mb-1.5 block text-sm font-semibold text-navy-800 dark:text-white">Thời gian hoãn mặc định</label>
            <SegmentedControl
              options={DEFAULT_SNOOZE_OPTIONS.map((m) => ({ value: String(m), label: `${m} phút` }))}
              value={String(settings.defaultSnoozeMinutes)}
              onChange={(v) => saveSettings({ defaultSnoozeMinutes: Number(v) }, `Đã đặt hoãn mặc định ${v} phút`)}
            />
            <p className="mt-1.5 text-xs text-navy-400">Áp dụng khi bạn bấm nút “Hoãn” trên màn hình báo thức.</p>
          </div>

          <div className="px-1 py-2">
            <Toggle
              label="Rung khi báo thức"
              description="Rung thiết bị cùng lúc phát âm thanh (chỉ áp dụng trên Mobile App)"
              checked={settings.vibrationEnabled}
              onChange={(v) => saveSettings({ vibrationEnabled: v }, v ? 'Đã bật rung' : 'Đã tắt rung')}
            />
          </div>

          <div className="px-1 py-2">
            <Toggle
              label="Nhắc khi đóng trình duyệt"
              description="Thông báo đẩy (Web Push): máy chủ gửi tận nơi nên chuông vẫn kêu dù bạn đã đóng tab — bật cho từng máy bạn muốn."
              checked={push.subscribed && push.permission === 'granted'}
              onChange={togglePush}
            />
            {push.supported && push.permission === 'denied' && (
              <p className="mt-1.5 text-xs font-semibold text-rose-500">
                Trình duyệt đang chặn thông báo của trang này — mở cài đặt trình duyệt, cho phép rồi tắt/bật lại.
              </p>
            )}
            {!push.supported && (
              <p className="mt-1.5 text-xs text-navy-400 dark:text-slate-500">
                Trình duyệt này chưa hỗ trợ Web Push — thử Chrome, Edge hoặc Safari.
              </p>
            )}
          </div>
        </section>
      ) : (
        <section className="card p-5 sm:p-6 dark:bg-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-100 pb-4">
            <div>
              <h2 className="flex items-center gap-2 font-bold text-navy-900 dark:text-white">
                <Devices size={19} weight="fill" className="text-purple-500 dark:text-purple-400" />
                Thiết bị nhận thông báo
              </h2>
              <p className="mt-0.5 text-xs text-navy-400 dark:text-slate-500">
                Báo thức sẽ được gửi tới mọi thiết bị đang hoạt động của bạn
              </p>
            </div>
            <Button variant="secondary" size="sm" icon={Plus} onClick={registerDevice}>
              Đăng ký thiết bị này
            </Button>
          </div>

          {devices.length === 0 ? (
            <EmptyState
              icon={Devices}
              title="Chưa có thiết bị nào"
              description="Đăng ký trình duyệt hoặc điện thoại để nhận báo thức đẩy."
              action={
                <Button variant="gradient" size="sm" icon={Plus} onClick={registerDevice}>
                  Đăng ký thiết bị này
                </Button>
              }
            />
          ) : (
            <ul className="mt-4 space-y-2.5">
              {devices.map((d) => {
                const Icon = platformIcon(d.platform)
                return (
                  <li key={d.id} className="flex items-center gap-4 rounded-xl bg-navy-50/70 p-3.5 dark:bg-slate-900/50">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-purple-500 ring-1 ring-navy-100">
                      <Icon size={21} weight="duotone" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-navy-900 dark:text-white">{d.name}</p>
                      <p className="text-xs text-navy-400 dark:text-slate-500">
                        {PLATFORM[d.platform]} · Hoạt động {relativeTime(d.lastSeenAt)}
                      </p>
                    </div>
                    <Button variant="danger-ghost" size="sm" icon={Trash} onClick={() => setConfirmDevice(d)}>
                      Gỡ
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {/* Liên kết tài khoản */}
      <section className="card divide-y divide-navy-100 p-2 dark:divide-slate-700 dark:bg-slate-800">
        <Link to="/app/billing" className="flex items-center gap-3 rounded-xl p-3.5 transition hover:bg-navy-50 dark:hover:bg-slate-700">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
            <Crown size={20} weight="duotone" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-bold text-navy-900 dark:text-white">Gói của bạn</span>
            <span className="block text-xs text-navy-400 dark:text-slate-500">Nâng cấp Plus / Pro để mở rộng giới hạn</span>
          </span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-extrabold ring-1 ring-inset ${PLAN_BADGE[user?.plan || 'FREE']}`}>
            {PLAN_NAMES[user?.plan || 'FREE']}
          </span>
        </Link>
        <Link to="/app/profile" className="flex items-center gap-3 rounded-xl p-3.5 transition hover:bg-navy-50 dark:hover:bg-slate-700">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <UserCircle size={20} weight="duotone" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-bold text-navy-900 dark:text-white">Hồ sơ cá nhân</span>
            <span className="block text-xs text-navy-400 dark:text-slate-500">Cập nhật họ tên, số điện thoại</span>
          </span>
        </Link>
        <Link to="/app/change-password" className="flex items-center gap-3 rounded-xl p-3.5 transition hover:bg-navy-50 dark:hover:bg-slate-700">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
            <Key size={20} weight="duotone" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-bold text-navy-900 dark:text-white">Đổi mật khẩu</span>
            <span className="block text-xs text-navy-400 dark:text-slate-500">Thay đổi mật khẩu đăng nhập</span>
          </span>
        </Link>
      </section>

      <ConfirmDialog
        open={!!confirmDevice}
        onClose={() => setConfirmDevice(null)}
        onConfirm={doRemoveDevice}
        title="Gỡ thiết bị?"
        message={`Thiết bị “${confirmDevice?.name}” sẽ không còn nhận báo thức. Bạn có chắc chắn muốn gỡ?`}
        confirmLabel="Gỡ thiết bị"
        danger
        loading={removing}
      />
    </div>
  )
}
