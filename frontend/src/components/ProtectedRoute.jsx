import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PageLoader } from './common/Feedback'

export function ProtectedRoute({ children }) {
  const { user, initializing } = useAuth()
  const location = useLocation()

  if (initializing) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-navy-50">
        <PageLoader label="Đang khôi phục phiên đăng nhập…" />
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

  if (initializing) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-navy-50">
        <PageLoader label="Đang khôi phục phiên đăng nhập…" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (user.role !== 'ADMIN') return <Navigate to="/app" replace />
  return children
}

export function GuestOnlyRoute({ children }) {
  const { user, initializing } = useAuth()
  if (initializing) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-navy-50">
        <PageLoader label="Đang tải…" />
      </div>
    )
  }
  if (user) return <Navigate to="/app" replace />
  return children
}
