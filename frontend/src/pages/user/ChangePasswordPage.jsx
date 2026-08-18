import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Lock, Eye, EyeSlash, Key, Check } from '@phosphor-icons/react'
import { Field, Input } from '../../components/common/Inputs'
import Button from '../../components/common/Button'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/common/Toast'
import { db } from '../../lib/db'

export default function ChangePasswordPage() {
  const { user, logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [showPw, setShowPw] = useState(false)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setErrors((er) => ({ ...er, [k]: undefined }))
    if (serverError) setServerError('')
  }

  const save = async () => {
    const er = {}
    if (!form.currentPassword) er.currentPassword = 'Vui lòng nhập mật khẩu hiện tại'
    if (!form.newPassword) er.newPassword = 'Vui lòng nhập mật khẩu mới'
    else if (form.newPassword.length < 6) er.newPassword = 'Mật khẩu mới phải có ít nhất 6 ký tự'
    if (form.confirmPassword !== form.newPassword) er.confirmPassword = 'Xác nhận mật khẩu không khớp'
    setErrors(er)
    if (Object.keys(er).length > 0) return

    setSaving(true)
    const u = db.users.find((x) => x.id === user.id)
    if (!u || u.password !== form.currentPassword) {
      setSaving(false)
      setServerError('Mật khẩu hiện tại không đúng')
      return
    }
    db.saveUsers(db.users.map((x) => (x.id === user.id ? { ...x, password: form.newPassword } : x)))
    setSaving(false)
    toast.success('Đổi mật khẩu thành công. Vui lòng đăng nhập lại với mật khẩu mới.')
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 animate-fade-in">
      <a href="/app/settings" className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-500 transition hover:text-blue-600">
        <ArrowLeft size={16} weight="bold" /> Quay lại cài đặt
      </a>
      <h1 className="page-title">Đổi mật khẩu</h1>

      <div className="card p-6">
        {serverError && (
          <div role="alert" className="mb-4 rounded-xl bg-rose-50 p-3.5 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
            {serverError}
          </div>
        )}
        <div className="space-y-4">
          <Field label="Mật khẩu hiện tại" required error={errors.currentPassword}>
            {(fid) => (
              <div className="relative">
                <Lock size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-300" />
                <Input
                  id={fid}
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.currentPassword}
                  onChange={set('currentPassword')}
                  invalid={!!errors.currentPassword}
                  className="pl-10 pr-11"
                />
              </div>
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mật khẩu mới" required error={errors.newPassword} hint="Tối thiểu 6 ký tự">
              {(fid) => (
                <Input
                  id={fid}
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.newPassword}
                  onChange={set('newPassword')}
                  invalid={!!errors.newPassword}
                />
              )}
            </Field>
            <Field label="Xác nhận mật khẩu mới" required error={errors.confirmPassword}>
              {(fid) => (
                <Input
                  id={fid}
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={set('confirmPassword')}
                  invalid={!!errors.confirmPassword}
                />
              )}
            </Field>
          </div>
          <button
            type="button"
            onClick={() => setShowPw((s) => !s)}
            className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-navy-500 hover:text-blue-600"
          >
            {showPw ? <EyeSlash size={15} /> : <Eye size={15} />}
            {showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          </button>
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="gradient" icon={Key} onClick={save} loading={saving}>
            <Check size={16} className="mr-1" weight="bold" />
            Đổi mật khẩu
          </Button>
        </div>
      </div>
    </div>
  )
}
