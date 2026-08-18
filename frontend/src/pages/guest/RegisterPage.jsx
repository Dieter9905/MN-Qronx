import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  User,
  EnvelopeSimple,
  Lock,
  Eye,
  EyeSlash,
  UserCirclePlus,
  WarningCircle,
} from '@phosphor-icons/react'
import AuthLayout from '../../components/AuthLayout'
import { Field, Input } from '../../components/common/Inputs'
import Button from '../../components/common/Button'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/common/Toast'

export default function RegisterPage() {
  const { register } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' })
  const [showPw, setShowPw] = useState(false)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setErrors((er) => ({ ...er, [k]: undefined }))
    if (serverError) setServerError('')
  }

  const validate = () => {
    const er = {}
    if (!form.fullName.trim()) er.fullName = 'Họ tên không được để trống'
    else if (form.fullName.trim().length < 3) er.fullName = 'Họ tên quá ngắn'
    if (!form.email.trim()) er.email = 'Email không được để trống'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) er.email = 'Email không đúng định dạng'
    if (!form.password) er.password = 'Mật khẩu không được để trống'
    else if (form.password.length < 6) er.password = 'Mật khẩu phải có ít nhất 6 ký tự'
    if (form.confirmPassword !== form.password) er.confirmPassword = 'Xác nhận mật khẩu không khớp'
    setErrors(er)
    return Object.keys(er).length === 0
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    const res = await register(form)
    setLoading(false)
    if (!res.success) {
      if (res.errors) setErrors(res.errors)
      setServerError(res.message)
      return
    }
    toast.success('Đăng ký thành công! Vui lòng đăng nhập để bắt đầu.')
    navigate('/login', { replace: true })
  }

  return (
    <AuthLayout
      title="Tạo tài khoản"
      subtitle="Bắt đầu quản lý thời gian và công việc đúng hạn với MN-Qronx – miễn phí."
    >
      {serverError && (
        <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-xl bg-rose-50 p-3.5 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
          <WarningCircle size={18} className="mt-0.5 shrink-0" weight="fill" />
          {serverError}
        </div>
      )}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Họ tên" required error={errors.fullName}>
          {(id) => (
            <div className="relative">
              <User size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-300" />
              <Input
                id={id}
                autoComplete="name"
                placeholder="Nguyễn Văn A"
                value={form.fullName}
                onChange={set('fullName')}
                invalid={!!errors.fullName}
                className="pl-10"
              />
            </div>
          )}
        </Field>
        <Field label="Email" required error={errors.email}>
          {(id) => (
            <div className="relative">
              <EnvelopeSimple size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-300" />
              <Input
                id={id}
                type="email"
                autoComplete="email"
                placeholder="ban@example.com"
                value={form.email}
                onChange={set('email')}
                invalid={!!errors.email}
                className="pl-10"
              />
            </div>
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mật khẩu" required error={errors.password} hint="Tối thiểu 6 ký tự">
            {(id) => (
              <div className="relative">
                <Lock size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-300" />
                <Input
                  id={id}
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={set('password')}
                  invalid={!!errors.password}
                  className="pl-10 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1 text-navy-400 hover:text-navy-700"
                >
                  {showPw ? <EyeSlash size={18} /> : <Eye size={18} />}
                </button>
              </div>
            )}
          </Field>
          <Field label="Xác nhận mật khẩu" required error={errors.confirmPassword}>
            {(id) => (
              <Input
                id={id}
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Nhập lại mật khẩu"
                value={form.confirmPassword}
                onChange={set('confirmPassword')}
                invalid={!!errors.confirmPassword}
              />
            )}
          </Field>
        </div>
        <Button type="submit" variant="gradient" fullWidth size="lg" loading={loading} icon={UserCirclePlus}>
          Đăng ký
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-navy-500">
        Đã có tài khoản?{' '}
        <Link to="/login" className="font-semibold text-blue-600 hover:underline">
          Đăng nhập
        </Link>
      </p>
    </AuthLayout>
  )
}
