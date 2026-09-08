import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  User,
  EnvelopeSimple,
  Lock,
  Eye,
  EyeSlash,
  UserCirclePlus,
  WarningCircle,
  GoogleLogo,
  Gift,
  ShieldCheck,
} from '@phosphor-icons/react'
import AuthLayout from '../../components/AuthLayout'
import { Field, Input } from '../../components/common/Inputs'
import Button from '../../components/common/Button'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/common/Toast'
import { API_BASE_URL } from '../../services/apiClient'
import { sendVerificationCode } from '../../services/authService'

const RESEND_SECONDS = 60

export default function RegisterPage() {
  const { register } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const invitedCode = searchParams.get('invite') || ''

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    inviteCode: invitedCode,
    verificationCode: '',
  })
  const [showPw, setShowPw] = useState(false)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [sendingCode, setSendingCode] = useState(false)
  const [devCode, setDevCode] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setErrors((er) => ({ ...er, [k]: undefined }))
    if (serverError) setServerError('')
  }

  // Đếm ngược để gửi lại mã
  useEffect(() => {
    if (resendIn <= 0) return undefined
    const t = setInterval(() => setResendIn((s) => s - 1), 1000)
    return () => clearInterval(t)
  }, [resendIn])

  const validateEmail = () => {
    if (!form.email.trim()) return 'Email không được để trống'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Email không đúng định dạng'
    return ''
  }

  const onSendCode = async () => {
    const emailErr = validateEmail()
    if (emailErr) {
      setErrors({ email: emailErr })
      return
    }
    setSendingCode(true)
    setServerError('')
    const res = await sendVerificationCode(form.email.trim())
    setSendingCode(false)
    if (!res.success) {
      setServerError(res.message)
      return
    }
    setDevCode(res.data?.devCode || '')
    setResendIn(RESEND_SECONDS)
    toast.success(res.message || 'Đã gửi mã xác nhận!')
  }

  const validate = () => {
    const er = {}
    if (!form.verificationCode.trim()) er.verificationCode = 'Nhập mã xác nhận đã gửi đến email'
    else if (!/^\d{6}$/.test(form.verificationCode.trim())) er.verificationCode = 'Mã xác nhận gồm 6 chữ số'
    if (!form.fullName.trim()) er.fullName = 'Họ tên không được để trống'
    else if (form.fullName.trim().length < 3) er.fullName = 'Họ tên quá ngắn'
    if (!form.password) er.password = 'Mật khẩu không được để trống'
    else if (form.password.length < 6) er.password = 'Mật khẩu phải có ít nhất 6 ký tự'
    if (form.inviteCode && !/^[A-Za-z0-9]{4,16}$/.test(form.inviteCode.trim())) er.inviteCode = 'Mã giới thiệu không hợp lệ'
    if (form.confirmPassword !== form.password) er.confirmPassword = 'Xác nhận mật khẩu không khớp'
    setErrors(er)
    return Object.keys(er).length === 0
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    const res = await register({ ...form, verificationCode: form.verificationCode.trim() })
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
        <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-xl bg-rose-50 p-3.5 text-sm font-medium text-rose-700 ring-1 ring-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:ring-rose-800/50">
          <WarningCircle size={18} className="mt-0.5 shrink-0" weight="fill" />
          {serverError}
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {/* Email + nút gửi mã */}
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
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
          <div className="sm:pt-6">
            {resendIn > 0 ? (
              <Button type="button" variant="secondary" size="md" fullWidth disabled>
                Gửi lại sau {resendIn}s
              </Button>
            ) : (
              <Button type="button" variant="secondary" size="md" fullWidth loading={sendingCode} icon={EnvelopeSimple} onClick={onSendCode}>
                Gửi mã xác nhận
              </Button>
            )}
          </div>
        </div>

        {devCode && (
          <div className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:ring-amber-800/50">
            💡 Môi trường test (chưa cấu hình SMTP): mã của bạn là <b className="tracking-widest">{devCode}</b>
          </div>
        )}

        <Field label="Mã xác nhận" required error={errors.verificationCode} hint="Nhập mã 6 chữ số đã gửi đến email của bạn">
          {(id) => (
            <div className="relative">
              <ShieldCheck size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-300" />
              <Input
                id={id}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="••••••"
                maxLength={6}
                value={form.verificationCode}
                onChange={set('verificationCode')}
                invalid={!!errors.verificationCode}
                className="pl-10 font-mono text-lg tracking-[0.5em]"
              />
            </div>
          )}
        </Field>

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

        <Field label="Mã giới thiệu (tùy chọn)" error={errors.inviteCode} hint="Nhập mã bạn bè gửi để cả hai nhận thưởng">
          {(id) => (
            <div className="relative">
              <Gift size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-300" />
              <Input
                id={id}
                autoComplete="off"
                placeholder="VD: ABC123"
                value={form.inviteCode}
                onChange={set('inviteCode')}
                invalid={!!errors.inviteCode}
                className="pl-10 uppercase"
              />
            </div>
          )}
        </Field>

        <Button type="submit" variant="gradient" fullWidth size="lg" loading={loading} icon={UserCirclePlus}>
          Đăng ký
        </Button>
      </form>

      <div className="mt-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-navy-100 dark:bg-slate-700" />
        <span className="text-xs font-bold uppercase tracking-wider text-navy-300 dark:text-slate-500">Hoặc</span>
        <span className="h-px flex-1 bg-navy-100 dark:bg-slate-700" />
      </div>
      <div className="mt-4">
        <Button
          type="button"
          variant="secondary"
          fullWidth
          size="lg"
          icon={GoogleLogo}
          onClick={() => {
            window.location.href = `${API_BASE_URL}/auth/google`
          }}
        >
          Đăng ký bằng Google
        </Button>
      </div>

      <p className="mt-6 text-center text-sm text-navy-500 dark:text-slate-400">
        Đã có tài khoản?{' '}
        <Link to="/login" className="font-semibold text-blue-600 hover:underline">
          Đăng nhập
        </Link>
      </p>
    </AuthLayout>
  )
}