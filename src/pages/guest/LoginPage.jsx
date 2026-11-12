import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { EnvelopeSimple, Lock, Eye, EyeSlash, SignIn, WarningCircle, GoogleLogo } from '@phosphor-icons/react'
import AuthLayout from '../../components/AuthLayout'
import { RoomField, RoomInput, RoomButton, RoomDots } from '../../components/common/RoomUI'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/common/Toast'
import { API_BASE_URL } from '../../services/apiClient'
import { useSlowHint, SERVER_WAKE_HINT } from '../../lib/useSlowHint'

const GOOGLE_ERRORS = {
  google_not_configured: 'Đăng nhập Google chưa được cấu hình trên máy chủ. Vui lòng thử lại sau.',
  google_state: 'Phiên đăng nhập Google không hợp lệ. Vui lòng thử lại.',
  google: 'Đăng nhập bằng Google thất bại. Vui lòng thử lại.',
}

export default function LoginPage() {
  const { login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const locked = Boolean(location.state?.locked)
  const googleError = searchParams.get('error')
    ? GOOGLE_ERRORS[searchParams.get('error')] || 'Đăng nhập bằng Google thất bại. Vui lòng thử lại.'
    : ''

  const [form, setForm] = useState({ email: '', password: '', remember: true })
  const [showPw, setShowPw] = useState(false)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState(locked ? 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.' : googleError)
  const slowLogin = useSlowHint(loading)

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

  return (
    <AuthLayout title="Đăng nhập" subtitle="Chào mừng bạn quay lại MN-Qronx. Hãy tiếp tục quản lý công việc của mình.">
      {serverError && (
        <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-2xl bg-room-rain/30 p-3.5 text-sm font-bold text-room-ink ring-1 ring-room-acorn/25">
          <WarningCircle size={18} className="mt-0.5 shrink-0" weight="bold" />
          {serverError}
        </div>
      )}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <RoomField label="Email" required error={errors.email}>
          {(id) => (
            <div className="relative">
              <EnvelopeSimple size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-room-ink/65" />
              <RoomInput
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
        </RoomField>
        <RoomField label="Mật khẩu" required error={errors.password}>
          {(id) => (
            <div className="relative">
              <Lock size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-room-ink/65" />
              <RoomInput
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
                className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-room-ink/65 transition hover:text-room-acorn"
              >
                {showPw ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>
          )}
        </RoomField>
        <div className="flex items-center justify-between text-sm">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 font-bold text-room-ink/80">
            <input
              type="checkbox"
              checked={form.remember}
              onChange={(e) => setForm((f) => ({ ...f, remember: e.target.checked }))}
              className="h-4 w-4 cursor-pointer rounded accent-room-acorn"
            />
            Ghi nhớ đăng nhập
          </label>
          <Link
            to="/forgot-password"
            className="inline-flex min-h-11 items-center rounded-full px-1 font-bold text-room-ink underline decoration-room-acorn/40 decoration-dotted decoration-2 underline-offset-4 transition hover:text-room-acorn"
          >
            Quên mật khẩu?
          </Link>
        </div>
        <RoomButton type="submit" variant="primary" fullWidth size="lg" loading={loading} icon={SignIn}>
          Đăng nhập
        </RoomButton>
        {slowLogin ? (
          <p className="text-center text-xs leading-relaxed font-semibold text-room-ink/60">
            {SERVER_WAKE_HINT}
          </p>
        ) : null}
      </form>

      <div className="mt-6 flex items-center gap-3">
        <RoomDots />
        <span className="text-xs font-bold text-room-ink/60">Hoặc</span>
        <RoomDots />
      </div>
      <div className="mt-4">
        <RoomButton
          type="button"
          variant="secondary"
          fullWidth
          size="lg"
          icon={GoogleLogo}
          onClick={() => {
            window.location.href = `${API_BASE_URL}/auth/google`
          }}
        >
          Tiếp tục với Google
        </RoomButton>
      </div>

      <p className="mt-6 text-center text-sm font-semibold text-room-ink/75">
        Chưa có tài khoản?{' '}
        <Link
          to="/register"
          className="font-bold text-room-ink underline decoration-room-acorn/40 decoration-dotted decoration-2 underline-offset-4 transition hover:text-room-acorn"
        >
          Đăng ký ngay
        </Link>
      </p>
    </AuthLayout>
  )
}
