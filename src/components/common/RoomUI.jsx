import { useId } from 'react'
import { MagnifyingGlass } from '@phosphor-icons/react'
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
  'w-full rounded-xl bg-room-paper text-room-ink ring-1 ring-inset ring-room-acorn/25 placeholder:text-room-ink/45 ' +
  'transition-all duration-200 hover:ring-room-acorn/45 ' +
  'focus:-translate-y-px focus:ring-2 focus:ring-inset focus:ring-room-acorn focus:outline-none ' +
  'focus:shadow-[0_0_0_4px_rgb(var(--room-acorn)/0.12)] ' +
  'disabled:cursor-not-allowed disabled:bg-room-oat/40 disabled:text-room-ink/60'

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
  // Xác nhận hủy/xoá: Rain trung tính — thế giới phòng không có rose đỏ
  danger:
    'bg-room-rain text-room-ink ring-1 ring-room-rain hover:brightness-[0.97] focus-visible:ring-room-rain',
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
        size === 'lg' ? 'h-12 px-6 text-[15px]' : size === 'sm' ? 'h-9 px-3.5 text-[13px]' : size === 'icon' ? 'h-10 w-10 p-0 text-sm' : 'h-10 px-5 text-sm',
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

// ======================================================================
//  Bìa mở rộng cho ĐỢT 3 (mốc "Công việc"): cùng nguyên tắc — additive,
//  trang navy ngoài mốc này không đổi diện mạo.
// ======================================================================

// ---------- Card giấy phẳng — vỏ section của trang trong phòng ----------
export function RoomCard({ as: Tag = 'section', className = '', children, ...props }) {
  return (
    <Tag className={`rounded-2xl bg-room-paper ring-1 ring-room-acorn/25 ${className}`} {...props}>
      {children}
    </Tag>
  )
}

// ---------- Khung chờ ----------
export function RoomSkeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-2xl bg-room-oat/70 ${className}`} aria-hidden="true" />
}

// ---------- Trạng thái rỗng ----------
export function RoomEmpty({
  icon: Icon = MagnifyingGlass,
  title,
  description,
  action,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-14 text-center ${className}`}>
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-room-oat/60 text-room-ink/65 ring-1 ring-room-acorn/25">
        <Icon size={30} weight="duotone" />
      </div>
      <div>
        <h3 className="font-display font-bold text-room-ink">{title}</h3>
        {description && (
          <p className="mt-1 max-w-sm text-sm font-semibold text-room-ink/60">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

// ---------- Textarea / Select theo da phòng ----------
// Select: mũi tên hằn sẵn màu Acorn — cùng chỗ mũi tên navy của bản cũ.
// (export cho các nơi dùng raw class thay component — giữ một nguồn arrow duy nhất)
export const ROOM_ARROW_URL =
  'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22%238b6f4e%22%20viewBox%3D%220%200%20256%20256%22%3E%3Cpath%20d%3D%22M213.66%2C101.66l-80%2C80a8%2C8%2C0%2C0%2C1-11.32%2C0l-80-80a8%2C8%2C0%2C0%2C1%2C11.32-11.32L128%2C164.69l74.34-74.35a8%2C8%2C0%2C0%2C1%2C11.32%2C11.32Z%22%2F%3E%3C%2Fsvg%3E'

export function RoomTextarea({ invalid, className = '', rows = 3, ...props }) {
  return (
    <textarea
      rows={rows}
      className={`${roomInputBase} px-3.5 py-2.5 text-sm ${invalid ? 'ring-room-rain focus:ring-room-rain' : ''} ${className}`}
      {...props}
    />
  )
}

export function RoomSelect({ invalid, className = '', children, ...props }) {
  return (
    <select
      className={`${roomInputBase} h-11 cursor-pointer appearance-none bg-[url('${ROOM_ARROW_URL}')] bg-[position:right_0.75rem_center] bg-no-repeat pr-10 pl-3.5 text-sm ${invalid ? 'ring-room-rain focus:ring-room-rain' : ''} ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}

// ---------- SegmentedControl — khay Oat, viên chọn là mảnh giấy nổi ----------
export function RoomSegmented({ options, value, onChange, size = 'md', className = '' }) {
  return (
    <div
      role="radiogroup"
      className={`inline-flex flex-wrap gap-1 rounded-xl bg-room-oat/70 p-1 ring-1 ring-room-acorn/15 ${className}`}
    >
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={opt.disabled}
            onClick={() => !opt.disabled && onChange(opt.value)}
            title={opt.disabled ? opt.disabledTitle || 'Cần nâng cấp gói' : undefined}
            className={[
              'rounded-lg font-display font-bold transition-all duration-200 focus-visible:outline-none',
              'focus-visible:ring-2 focus-visible:ring-room-acorn',
              opt.disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:-translate-y-px active:scale-95',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
              selected
                ? 'bg-room-paper text-room-ink shadow-[0_6px_12px_-8px_rgb(0_0_0/0.25)] ring-1 ring-room-acorn/30'
                : 'text-room-ink/65 hover:text-room-ink',
            ].join(' ')}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ---------- Toggle — công tắc dây Acorn ----------
export function RoomToggle({ checked, onChange, label, description, disabled, className = '' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`group flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl p-3 text-left transition-all duration-200 hover:bg-room-oat/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-room-acorn disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      <span>
        <span className="block text-sm font-bold text-room-ink">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs font-semibold text-room-ink/65">{description}</span>
        )}
      </span>
      <span
        aria-hidden="true"
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full ring-1 transition-all duration-300 group-hover:scale-105 ${
          checked ? 'bg-room-acorn ring-room-acorn/40' : 'bg-room-oat ring-room-acorn/20'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-room-paper shadow transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  )
}
