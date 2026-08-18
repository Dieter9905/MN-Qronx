import { Link } from 'react-router-dom'
import { Compass } from '@phosphor-icons/react'
import { Logo } from '../components/Logo'
import Button from '../components/common/Button'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-navy-50 px-4 text-center">
      <Logo size={40} />
      <div className="mt-10 flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-gradient-soft ring-1 ring-blue-100">
        <Compass size={40} weight="duotone" className="text-blue-600" />
      </div>
      <h1 className="mt-6 text-6xl font-extrabold tracking-tight text-navy-900">404</h1>
      <p className="mt-2 text-lg font-semibold text-navy-700">Trang bạn tìm không tồn tại</p>
      <p className="mt-1 max-w-md text-sm text-navy-500">
        Có thể liên kết đã sai hoặc trang đã bị di chuyển. Hãy quay về trang chủ để tiếp tục.
      </p>
      <div className="mt-8">
        <Link to="/">
          <Button variant="gradient" size="lg">Về trang chủ</Button>
        </Link>
      </div>
    </div>
  )
}
