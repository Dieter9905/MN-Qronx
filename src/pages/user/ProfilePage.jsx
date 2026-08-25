import { useState } from 'react'
import { ArrowLeft, UserCircle, EnvelopeSimple, Phone, Check } from '@phosphor-icons/react'
import { Field, Input } from '../../components/common/Inputs'
import Button from '../../components/common/Button'
import Avatar from '../../components/common/Avatar'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/common/Toast'
import { formatDate } from '../../lib/format'
import { db } from '../../lib/db'

export default function ProfilePage() {
  const { user, refresh } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    phoneNumber: user?.phoneNumber || '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const er = {}
    if (!form.fullName.trim()) er.fullName = 'Họ tên không được để trống'
    if (form.phoneNumber && !/^[0-9\s+()\-.]{6,15}$/.test(form.phoneNumber.trim())) {
      er.phoneNumber = 'Số điện thoại không hợp lệ'
    }
    setErrors(er)
    if (Object.keys(er).length > 0) return

    setSaving(true)
    // Mô phỏng PUT /api/v1/me
    const users = db.users.map((u) =>
      u.id === user.id ? { ...u, fullName: form.fullName.trim(), phoneNumber: form.phoneNumber.trim() } : u
    )
    db.saveUsers(users)
    refresh()
    setSaving(false)
    toast.success('Đã cập nhật hồ sơ')
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 animate-fade-in">
      <a href="/app/settings" className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-500 transition hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400">
        <ArrowLeft size={16} weight="bold" /> Quay lại cài đặt
      </a>
      <h1 className="page-title dark:text-white">Hồ sơ cá nhân</h1>

      <div className="card p-6">
        <div className="flex flex-col items-center gap-4 border-b border-navy-100 pb-6 dark:border-slate-700 sm:flex-row sm:items-center">
          <Avatar name={form.fullName || user?.fullName} size="xl" />
          <div className="text-center sm:text-left">
            <p className="text-lg font-extrabold text-navy-900 dark:text-white">{user?.fullName}</p>
            <p className="text-sm text-navy-400 dark:text-slate-400">{user?.email}</p>
            <p className="mt-1 text-xs text-navy-400 dark:text-slate-500">
              Thành viên từ {formatDate(user?.createdAt)} · Vai trò: {user?.role === 'ADMIN' ? 'Quản trị viên' : 'Người dùng'}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <Field label="Họ tên" required error={errors.fullName}>
            {(fid) => (
              <div className="relative">
                <UserCircle size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-300" />
                <Input
                  id={fid}
                  value={form.fullName}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, fullName: e.target.value }))
                    setErrors((er) => ({ ...er, fullName: undefined }))
                  }}
                  invalid={!!errors.fullName}
                  className="pl-10"
                />
              </div>
            )}
          </Field>
          <Field label="Email" hint="Email không thể thay đổi – dùng để đăng nhập và khôi phục mật khẩu">
            {(fid) => (
              <div className="relative">
                <EnvelopeSimple size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-300" />
                <Input id={fid} value={user?.email} disabled className="pl-10" />
              </div>
            )}
          </Field>
          <Field label="Số điện thoại" error={errors.phoneNumber}>
            {(fid) => (
              <div className="relative">
                <Phone size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-300" />
                <Input
                  id={fid}
                  type="tel"
                  value={form.phoneNumber}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, phoneNumber: e.target.value }))
                    setErrors((er) => ({ ...er, phoneNumber: undefined }))
                  }}
                  placeholder="0901 234 567"
                  invalid={!!errors.phoneNumber}
                  className="pl-10"
                />
              </div>
            )}
          </Field>
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="gradient" icon={Check} onClick={save} loading={saving}>
            Lưu thay đổi
          </Button>
        </div>
      </div>
    </div>
  )
}
