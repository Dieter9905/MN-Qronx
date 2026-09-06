import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { EnvelopeSimple, Lock, Eye, EyeSlash, SignIn, WarningCircle } from '@phosphor-icons/react'
import AuthLayout from '../../components/AuthLayout'
import { Field, Input } from '../../components/common/Inputs'
import Button from '../../components/common/Button'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/common/Toast'

export default function LoginPage() {
  const { login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const locked = Boolean(location.state?.locked)

  const [form, setForm] = useState({ email: '', password: '', remember: true })
  const [showPw, setShowPw] = useState(false)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState(locked ? 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.' : '')

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setErrors((er) => ({ ...er, [k]: undefined }))
    if (serverError) setServerError('')
  }

  const validate = () => {
    const er = {}
    if (!form.email.trim()) er.email = 'Email không được để trống'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) er.email = 'Email không đúng định dạng'
    if (!form.password) er.password = 'Mật khẩu không được để trống'
    setErrors(er)
    return Object.keys(er).length === 0
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    const res = await login({ email: form.email, password: form.password })
    setLoading(false)
    if (!res.success) {
      setServerError(res.message)
      return
    }
    toast.success(`Xin chào, ${res.data.user.fullName}! 👋`)
    const from = location.state?.from
    navigate(res.data.user.role === 'ADMIN' ? '/admin' : from || '/app', { replace: true })
  }

  const fillDemo = (email, password) => {
    setForm({ email, password, remember: true })
    setServerError('')
  }

  return (
    <AuthLayout title="Đăng nhập" subtitle="Chào mừng bạn quay lại MN-Qronx. Hãy tiếp tục quản lý công việc của mình.">
      {serverError && (
        <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-xl bg-rose-50 p-3.5 text-sm font-medium text-rose-700 ring-1 ring-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:ring-rose-800/50">
          <WarningCircle size={18} className="mt-0.5 shrink-0" weight="fill" />
          {serverError}
        </div>
      )}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
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
        <Field label="Mật khẩu" required error={errors.password}>
          {(id) => (
            <div className="relative">
              <Lock size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-300" />
              <Input
                id={id}
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
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
        <div className="flex items-center justify-between text-sm">
          <label className="flex cursor-pointer items-center gap-2 font-medium text-navy-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={form.remember}
              onChange={(e) => setForm((f) => ({ ...f, remember: e.target.checked }))}
              className="h-4 w-4 cursor-pointer rounded border-navy-300 accent-blue-600"
            />
            Ghi nhớ đăng nhập
          </label>
          <Link to="/forgot-password" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
            Quên mật khẩu?
          </Link>
        </div>
        <Button type="submit" variant="gradient" fullWidth size="lg" loading={loading} icon={SignIn}>
          Đăng nhập
        </Button>
      </form>

      <div className="mt-6 rounded-2xl bg-brand-gradient-soft p-4 ring-1 ring-blue-100 dark:ring-blue-900/50">
        <p className="text-xs font-bold uppercase tracking-wider text-navy-500 dark:text-slate-400">Tài khoản dùng thử</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => fillDemo('demo@taskalarm.com', 'User@1234')}
            className="cursor-pointer rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-navy-100 transition hover:ring-blue-300 dark:bg-slate-800 dark:ring-slate-700 dark:hover:ring-blue-500"
          >
            <p className="text-xs font-bold text-navy-800 dark:text-white">Người dùng (demo)</p>
            <p className="mt-0.5 truncate text-[11px] text-navy-400 dark:text-slate-400">demo@taskalarm.com</p>
            <p className="text-[11px] text-navy-400 dark:text-slate-400">Mật khẩu: User@1234</p>
          </button>
          <button
            type="button"
            onClick={() => fillDemo('admin@taskalarm.com', 'Admin@123')}
            className="cursor-pointer rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-navy-100 transition hover:ring-purple-300 dark:bg-slate-800 dark:ring-slate-700 dark:hover:ring-purple-500"
          >
            <p className="text-xs font-bold text-navy-800 dark:text-white">Quản trị viên</p>
            <p className="mt-0.5 truncate text-[11px] text-navy-400 dark:text-slate-400">admin@taskalarm.com</p>
            <p className="text-[11px] text-navy-400 dark:text-slate-400">Mật khẩu: Admin@123</p>
          </button>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-navy-500 dark:text-slate-400">
        Chưa có tài khoản?{' '}
        <Link to="/register" className="font-semibold text-blue-600 hover:underline">
          Đăng ký ngay
        </Link>
      </p>
    </AuthLayout>
  )
}
