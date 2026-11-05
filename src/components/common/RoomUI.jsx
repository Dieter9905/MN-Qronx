import { useId } from 'react'
import { Spinner } from './Feedback'

// ======================================================================
//  RoomUI — lớp da "phòng mini-hompy" cho form auth (và sau này là app
//  shell). KHÔNG chứa logic nghiệp vụ: chỉ bọc lại control dùng chung
//  với token room (Porcelain/Acorn/Ink/Rain). Input/Button gốc trong
//  Inputs.jsx / Button.jsx vẫn phục vụ phần app-shell navy cũ.
//  World grammar: field = giấy + ring Acorn/25 + focus dashed Acorn
//  (do .room-world :focus-visible gánh); lỗi = Rain trung tính.
// ======================================================================

// ---------- Field (label + error/hint wrapper) ----------
export function RoomField({ label, required, error, hint, children, className = '' }) {
  const id = useId()
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-[13px] font-bold text-room-ink">
          {label}
          {required && <span className="ml-0.5 text-room-acorn" aria-hidden="true">*</span>}
        </label>
      )}
      {typeof children === 'function' ? children(id) : children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-bold text-room-ink">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs font-semibold text-room-ink/60">{hint}</p>
      ) : null}
    </div>
  )
}

const roomInputBase =
  'w-full rounded-xl bg-room-paper text-room-ink ring-1 ring-inset ring-room-acorn/25 placeholder:text-room-ink/30 ' +
  'transition-all duration-200 hover:ring-room-acorn/45 ' +
  'focus:-translate-y-px focus:ring-2 focus:ring-inset focus:ring-room-acorn focus:outline-none ' +
  'focus:shadow-[0_0_0_4px_rgb(var(--room-acorn)/0.12)] ' +
  'disabled:cursor-not-allowed disabled:bg-room-oat/40 disabled:text-room-ink/40'

export function RoomInput({ invalid, className = '', ...props }) {
  return (
    <input
      className={`${roomInputBase} h-11 px-3.5 text-sm ${invalid ? 'ring-room-rain hover:ring-room-rain focus:ring-room-rain' : ''} ${className}`}
      {...props}
    />
  )
}

// ---------- Button — pill của thế giới phòng ----------
const ROOM_VARIANTS = {
  // CTA chính: Acorn pill + paper weight (giống CTA cửa landing); hover làm đậm Acorn
  primary:
    'bg-room-acorn text-room-paper shadow-[0_14px_26px_-12px_rgb(0_0_0/0.30)] hover:brightness-[0.96] focus-visible:ring-room-acorn',
  // CTA phụ: pill giấy trong, ring Acorn/40, hover đổ Oat
  secondary:
    'text-room-ink ring-1 ring-room-acorn/40 hover:bg-room-oat/60 focus-visible:ring-room-acorn',
}

export function RoomButton({
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
        'inline-flex items-center justify-center gap-2 rounded-full font-display font-bold',
        'cursor-pointer select-none transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
        'disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none',
        'hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]',
        ROOM_VARIANTS[variant],
        size === 'lg' ? 'h-12 px-6 text-[15px]' : size === 'sm' ? 'h-9 px-3.5 text-[13px]' : 'h-10 px-5 text-sm',
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...props}
    >
      {loading ? (
        <>
          <Spinner size="sm" light={variant === 'primary'} />
          <span>{loading === true ? 'Đang xử lý…' : loading}</span>
        </>
      ) : (
        <>
          {Icon && <Icon size={size === 'lg' ? 18 : 16} weight={iconWeight} className="icon-pop" />}
          {children}
        </>
      )}
    </button>
  )
}

// ---------- Dotted leader — đường chấm chia/nối (ngữ pháp dot-divider của thế giới) ----------
export function RoomDots({ className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`h-[3px] flex-1 ${className}`}
      style={{
        backgroundImage: 'radial-gradient(rgb(var(--room-acorn) / 0.65) 1.6px, transparent 1.7px)',
        backgroundSize: '16px 3px',
        backgroundPosition: 'center',
        backgroundRepeat: 'repeat-x',
      }}
    />
  )
}
