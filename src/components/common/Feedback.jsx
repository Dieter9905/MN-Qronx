import { CircleNotch, WarningCircle, MagnifyingGlass } from '@phosphor-icons/react'

export function Spinner({ size = 'md', light = false, className = '' }) {
  const px = size === 'sm' ? 16 : size === 'lg' ? 28 : 22
  return (
    <span role="status" aria-label="Đang tải">
      <CircleNotch
        size={px}
        className={`animate-spin ${light ? 'text-white' : 'text-blue-600'} ${className}`}
        weight="bold"
      />
    </span>
  )
}

export function PageLoader({ label = 'Đang tải dữ liệu…', hint = '' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-navy-400">
      <Spinner size="lg" />
      <p className="text-sm font-medium">{label}</p>
      {hint ? (
        <p className="max-w-xs text-center text-xs leading-relaxed text-navy-400 dark:text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export function Skeleton({ className = '' }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-navy-100/70 dark:bg-slate-700/70 ${className}`}
      aria-hidden="true"
    />
  )
}

export function EmptyState({
  icon: Icon = MagnifyingGlass,
  title = 'Không có dữ liệu',
  description,
  action,
  className = '',
  // Minh hoạ riêng (vẽ sẵn JSX) — bỏ qua icon mặc định nếu cung cấp
  illustration,
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-14 text-center ${className}`}>
      {illustration || (
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-navy-50 text-navy-300 ring-1 ring-navy-100 dark:bg-slate-800 dark:text-slate-500 dark:ring-slate-700">
          <Icon size={30} weight="duotone" />
        </div>
      )}
      <div>
        <h3 className="font-bold text-navy-800 dark:text-white">{title}</h3>
        {description && <p className="mt-1 max-w-sm text-sm text-navy-500 dark:text-slate-400">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function ErrorNotice({ message, onRetry, className = '' }) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl bg-rose-50 p-4 ring-1 ring-rose-200 dark:bg-rose-900/20 dark:ring-rose-800/50 ${className}`}
    >
      <WarningCircle size={20} className="mt-0.5 shrink-0 text-rose-600" weight="fill" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-rose-800">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1.5 cursor-pointer text-sm font-semibold text-rose-700 underline underline-offset-2 hover:text-rose-800"
          >
            Thử lại
          </button>
        )}
      </div>
    </div>
  )
}
