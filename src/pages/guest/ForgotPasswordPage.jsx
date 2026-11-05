import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EnvelopeSimple, PaperPlaneTilt, WarningCircle, CheckCircle } from '@phosphor-icons/react'
import AuthLayout from '../../components/AuthLayout'
import { RoomField, RoomInput, RoomButton } from '../../components/common/RoomUI'
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
        <div className="rounded-2xl bg-room-sage/45 p-5 ring-1 ring-room-acorn/25">
          <div className="flex items-start gap-3">
            <CheckCircle size={22} className="mt-0.5 shrink-0 text-room-acorn" weight="bold" />
            <div>
              <p className="text-sm font-bold text-room-ink">
                Nếu email tồn tại, chúng tôi đã gửi liên kết đặt lại mật khẩu.
              </p>
              <p className="mt-1 text-sm leading-relaxed text-room-ink/70">
                Vui lòng kiểm tra hộp thư <strong>{email}</strong> (kể cả thư rác). Liên kết có giá trị trong 1 giờ.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-6 space-y-3">
          <Link to="/login">
            <RoomButton variant="primary" fullWidth>Quay lại đăng nhập</RoomButton>
          </Link>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="mx-auto block w-full cursor-pointer text-center text-sm font-bold text-room-ink/80 underline decoration-room-acorn/40 decoration-dotted decoration-2 underline-offset-4 transition hover:text-room-acorn"
          >
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
        <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-2xl bg-room-rain/30 p-3.5 text-sm font-bold text-room-ink ring-1 ring-room-acorn/25">
          <WarningCircle size={18} className="mt-0.5 shrink-0" weight="bold" />
          {error}
        </div>
      )}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <RoomField label="Email" required>
          {(id) => (
            <div className="relative">
              <EnvelopeSimple size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-room-ink/35" />
              <RoomInput
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
        </RoomField>
        <RoomButton type="submit" variant="primary" fullWidth size="lg" loading={loading} icon={PaperPlaneTilt}>
          Gửi yêu cầu
        </RoomButton>
      </form>
      <p className="mt-6 text-center text-sm font-semibold text-room-ink/75">
        Nhớ mật khẩu rồi?{' '}
        <Link
          to="/login"
          className="font-bold text-room-ink underline decoration-room-acorn/40 decoration-dotted decoration-2 underline-offset-4 transition hover:text-room-acorn"
        >
          Đăng nhập
        </Link>
      </p>
    </AuthLayout>
  )
}
