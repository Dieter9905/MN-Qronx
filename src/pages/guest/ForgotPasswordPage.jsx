import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EnvelopeSimple, PaperPlaneTilt, WarningCircle, CheckCircle } from '@phosphor-icons/react'
import AuthLayout from '../../components/AuthLayout'
import { Field, Input } from '../../components/common/Inputs'
import Button from '../../components/common/Button'
import { forgotPassword } from '../../services/authService'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) {
      setError('Email không được để trống')
      return
    }
    setLoading(true)
    const res = await forgotPassword({ email })
    setLoading(false)
    if (!res.success) {
      setError(res.message)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <AuthLayout title="Kiểm tra email của bạn" subtitle="Chúng tôi đã xử lý yêu cầu của bạn.">
        <div className="rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-200">
          <div className="flex items-start gap-3">
            <CheckCircle size={22} className="mt-0.5 shrink-0 text-emerald-600" weight="fill" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">
                Nếu email tồn tại, chúng tôi đã gửi liên kết đặt lại mật khẩu.
              </p>
              <p className="mt-1 text-sm leading-relaxed text-emerald-700">
                Vui lòng kiểm tra hộp thư <strong>{email}</strong> (kể cả thư rác). Liên kết có giá trị trong 30 phút.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-6 space-y-3">
          <Link to="/login">
            <Button variant="gradient" fullWidth>Quay lại đăng nhập</Button>
          </Link>
          <button type="button" onClick={() => setSent(false)} className="btn-link w-full text-center">
            Gửi lại yêu cầu
          </button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Quên mật khẩu?"
      subtitle="Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết để bạn đặt lại mật khẩu."
    >
      {error && (
        <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-xl bg-rose-50 p-3.5 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
          <WarningCircle size={18} className="mt-0.5 shrink-0" weight="fill" />
          {error}
        </div>
      )}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Email" required>
          {(id) => (
            <div className="relative">
              <EnvelopeSimple size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-300" />
              <Input
                id={id}
                type="email"
                autoComplete="email"
                placeholder="ban@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError('')
                }}
                className="pl-10"
              />
            </div>
          )}
        </Field>
        <Button type="submit" variant="gradient" fullWidth size="lg" loading={loading} icon={PaperPlaneTilt}>
          Gửi yêu cầu
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-navy-500">
        Nhớ mật khẩu rồi?{' '}
        <Link to="/login" className="font-semibold text-blue-600 hover:underline">
          Đăng nhập
        </Link>
      </p>
    </AuthLayout>
  )
}
