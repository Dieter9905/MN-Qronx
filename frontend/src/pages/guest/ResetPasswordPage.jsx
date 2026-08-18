import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Lock, Eye, EyeSlash, Key, WarningCircle, CheckCircle } from '@phosphor-icons/react'
import AuthLayout from '../../components/AuthLayout'
import { Field, Input } from '../../components/common/Inputs'
import Button from '../../components/common/Button'
import { resetPassword, getResetToken } from '../../services/authService'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || getResetToken()

  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [showPw, setShowPw] = useState(false)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setErrors((er) => ({ ...er, [k]: undefined }))
  }

  if (!token) {
    return (
      <AuthLayout title="Liên kết không hợp lệ" subtitle="Không tìm thấy mã đặt lại mật khẩu.">
        <div className="rounded-2xl bg-rose-50 p-5 ring-1 ring-rose-200">
          <p className="text-sm font-semibold text-rose-700">
            Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu lại.
          </p>
        </div>
        <div className="mt-6">
          <Link to="/forgot-password">
            <Button variant="gradient" fullWidth>Quên mật khẩu</Button>
          </Link>
        </div>
      </AuthLayout>
    )
  }

  const validate = () => {
    const er = {}
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
    const res = await resetPassword({ resetToken: token, ...form })
    setLoading(false)
    if (!res.success) {
      setServerError(res.message)
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <AuthLayout title="Đặt lại mật khẩu thành công" subtitle="Bạn có thể đăng nhập với mật khẩu mới.">
        <div className="rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-200">
          <div className="flex items-start gap-3">
            <CheckCircle size={22} className="mt-0.5 shrink-0 text-emerald-600" weight="fill" />
            <p className="text-sm font-semibold text-emerald-800">
              Mật khẩu của bạn đã được cập nhật. Hãy đăng nhập để tiếp tục.
            </p>
          </div>
        </div>
        <div className="mt-6">
          <Button variant="gradient" fullWidth onClick={() => navigate('/login')}>
            Đi đến đăng nhập
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Đặt lại mật khẩu" subtitle="Tạo mật khẩu mới cho tài khoản của bạn.">
      {serverError && (
        <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-xl bg-rose-50 p-3.5 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
          <WarningCircle size={18} className="mt-0.5 shrink-0" weight="fill" />
          {serverError}
        </div>
      )}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Mật khẩu mới" required error={errors.password} hint="Tối thiểu 6 ký tự">
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
        <Field label="Xác nhận mật khẩu mới" required error={errors.confirmPassword}>
          {(id) => (
            <Input
              id={id}
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu mới"
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              invalid={!!errors.confirmPassword}
            />
          )}
        </Field>
        <Button type="submit" variant="gradient" fullWidth size="lg" loading={loading} icon={Key}>
          Đặt lại mật khẩu
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-navy-500">
        <Link to="/login" className="font-semibold text-blue-600 hover:underline">
          Quay lại đăng nhập
        </Link>
      </p>
    </AuthLayout>
  )
}
