import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PageLoader } from './common/Feedback'
import { useSlowHint, SERVER_WAKE_HINT } from '../lib/useSlowHint'

export function ProtectedRoute({ children }) {
  const { user, initializing } = useAuth()
  const location = useLocation()
  const slow = useSlowHint(initializing)

  if (initializing) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-navy-50 dark:bg-slate-900">
        <PageLoader
          label="Đang khôi phục phiên đăng nhập…"
          hint={slow ? SERVER_WAKE_HINT : ''}
        />
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  if (!user.isActive) {
    return <Navigate to="/login" state={{ locked: true }} replace />
  }
  return children
}

export function AdminRoute({ children }) {
  const { user, initializing } = useAuth()
  const location = useLocation()
  const slow = useSlowHint(initializing)

  if (initializing) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-navy-50 dark:bg-slate-900">
        <PageLoader
          label="Đang khôi phục phiên đăng nhập…"
          hint={slow ? SERVER_WAKE_HINT : ''}
        />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (user.role !== 'ADMIN') return <Navigate to="/app" replace />
  return children
}

export function GuestOnlyRoute({ children }) {
  const { user, initializing } = useAuth()
  const slow = useSlowHint(initializing)
  if (initializing) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-navy-50 dark:bg-slate-900">
        <PageLoader label="Đang tải…" hint={slow ? SERVER_WAKE_HINT : ''} />
      </div>
    )
  }
  if (user) return <Navigate to="/app" replace />
  return children
}
