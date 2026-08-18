import { Spinner } from './Feedback'

const VARIANTS = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-glow-blue focus-visible:ring-blue-400',
  gradient:
    'bg-brand-gradient text-white hover:opacity-95 active:opacity-90 shadow-glow-purple focus-visible:ring-brand-purple',
  secondary:
    'bg-white text-navy-800 ring-1 ring-navy-200 hover:bg-navy-50 hover:ring-navy-300 active:bg-navy-100 focus-visible:ring-navy-400',
  ghost: 'bg-transparent text-navy-700 hover:bg-navy-100/70 active:bg-navy-100 focus-visible:ring-navy-300',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-glow-blue focus-visible:ring-rose-400',
  'danger-ghost': 'bg-rose-50 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100 focus-visible:ring-rose-300',
  'navy': 'bg-navy-900 text-white hover:bg-navy-800 active:bg-navy-700 focus-visible:ring-navy-500',
  'light': 'bg-white/10 text-white ring-1 ring-white/25 backdrop-blur hover:bg-white/20 focus-visible:ring-white/50',
}

const SIZES = {
  xs: 'h-8 px-3 text-xs gap-1.5',
  sm: 'h-9 px-3.5 text-sm gap-1.5',
  md: 'h-10 px-5 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
  icon: 'h-10 w-10 p-0 justify-center',
  'icon-sm': 'h-9 w-9 p-0 justify-center',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  iconWeight = 'bold',
  fullWidth = false,
  className = '',
  children,
  disabled,
  ...props
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-150',
        'cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
        'active:scale-[0.98]',
        VARIANTS[variant],
        SIZES[size],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...props}
    >
      {loading ? (
        <>
          <Spinner size="sm" light={variant.startsWith('primary') || variant.startsWith('gradient') || variant.startsWith('danger') || variant.startsWith('navy')} />
          <span>{loading === true ? 'Đang xử lý…' : loading}</span>
        </>
      ) : (
        <>
          {Icon && <Icon size={size === 'lg' ? 20 : 18} weight={iconWeight} />}
          {children}
        </>
      )}
    </button>
  )
}
