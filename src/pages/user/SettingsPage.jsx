import { useEffect, useState } from 'react'
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
} from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import { PLAN_NAMES, PLAN_BADGE } from '../../lib/constants'
import { getNotificationSettings, updateNotificationSettings } from '../../services/notificationService'
import { getDevices, registerCurrentDevice, removeDevice } from '../../services/deviceService'
import { useToast } from '../../components/common/Toast'
import { Skeleton, EmptyState } from '../../components/common/Feedback'
import Button from '../../components/common/Button'
import { Toggle, SegmentedControl, Select } from '../../components/common/Inputs'
import { ConfirmDialog } from '../../components/common/Modal'
import { ALARM_SOUNDS, DEFAULT_SNOOZE_OPTIONS, PLATFORM } from '../../lib/constants'
import { relativeTime } from '../../lib/format'
import { startAlarmSound, stopAlarmSound } from '../../context/AlarmContext'

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

  const load = async () => {
    const [sRes, dRes] = await Promise.all([getNotificationSettings(), getDevices()])
    if (sRes.success) setSettings(sRes.data)
    if (dRes.success) setDevices(dRes.data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

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
    setTimeout(() => startAlarmSound(), 100)
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
              </Select>
              <Button variant="secondary" icon={Play} onClick={previewSound} aria-label="Nghe thử âm thanh">
                <span className="hidden sm:inline">Nghe thử</span>
              </Button>
            </div>
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
