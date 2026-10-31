import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { setSession } from '../../services/session'
import { useAuth } from '../../context/AuthContext'
import { Logo } from '../../components/Logo'

export default function OAuthCallbackPage() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true

    const params = new URLSearchParams(window.location.search)
    const accessToken = params.get('accessToken')
    const refreshToken = params.get('refreshToken')

    const fail = () => navigate('/login?error=google', { replace: true })

    if (!accessToken || !refreshToken) {
      fail()
      return
    }

    setSession({ accessToken, refreshToken, user: null })
    ;(async () => {
      // Người dùng vừa được Google trả token về — /me hụt một nhịp (đường
      // truyền yếu) không đáng để đá về /login ngay. Thử tối đa 2 lần trước
      // khi chịu lỗi; fetchCurrentUser trả null khi /me xác nhận không hợp lệ.
      let user = null
      for (let attempt = 0; attempt < 2 && !user; attempt += 1) {
        try {
          user = await refresh()
        } catch {
          /* đường truyền chập chờn — thử lại */
        }
        if (!user && attempt === 0) await new Promise((r) => setTimeout(r, 600))
      }
      if (!user) {
        fail()
        return
      }
      // Admin → khu vực quản trị, người dùng thường → app
      navigate(user.role === 'ADMIN' ? '/admin' : '/app', { replace: true })
    })()
  }, [navigate, refresh])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-navy-50 px-6 dark:bg-navy-950">
      <Logo size={48} />
      <div className="mt-8 h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      <p className="mt-5 text-sm font-semibold text-navy-500 dark:text-slate-400">Đang đăng nhập bằng Google…</p>
    </div>
  )
}