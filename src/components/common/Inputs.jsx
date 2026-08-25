import { useId } from 'react'
import { Check } from '@phosphor-icons/react'

// ---------- Field (label + error wrapper) ----------
export function Field({ label, required, error, hint, children, className = '' }) {
  const id = useId()
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-navy-800 dark:text-slate-200">
          {label}
          {required && <span className="ml-0.5 text-rose-500" aria-hidden="true">*</span>}
        </label>
      )}
      {typeof children === 'function' ? children(id) : children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 flex items-center gap-1 text-xs font-medium text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-navy-400 dark:text-slate-500">{hint}</p>
      ) : null}
    </div>
  )
}

const inputBase =
  'w-full rounded-xl border-0 bg-white text-navy-900 shadow-sm ring-1 ring-inset ring-navy-200 placeholder:text-navy-300 ' +
  'dark:bg-slate-800 dark:text-white dark:ring-slate-600 dark:placeholder:text-slate-500 ' +
  'transition focus:ring-2 focus:ring-inset focus:ring-blue-500 focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-navy-50 disabled:text-navy-400 dark:disabled:bg-slate-700 dark:disabled:text-slate-500'

export function Input({ invalid, className = '', ...props }) {
  return (
    <input
      className={`${inputBase} h-11 px-3.5 text-sm ${invalid ? 'ring-rose-300 focus:ring-rose-500' : ''} ${className}`}
      {...props}
    />
  )
}

export function Textarea({ invalid, className = '', rows = 3, ...props }) {
  return (
    <textarea
      rows={rows}
      className={`${inputBase} px-3.5 py-2.5 text-sm ${invalid ? 'ring-rose-300 focus:ring-rose-500' : ''} ${className}`}
      {...props}
    />
  )
}

export function Select({ invalid, className = '', children, ...props }) {
  return (
    <select
      className={`${inputBase} h-11 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22%23475569%22%20viewBox%3D%220%200%20256%20256%22%3E%3Cpath%20d%3D%22M213.66%2C101.66l-80%2C80a8%2C8%2C0%2C0%2C1-11.32%2C0l-80-80a8%2C8%2C0%2C0%2C1%2C11.32-11.32L128%2C164.69l74.34-74.35a8%2C8%2C0%2C0%2C1%2C11.32%2C11.32Z%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_0.75rem_center] bg-no-repeat pr-10 pl-3.5 text-sm ${invalid ? 'ring-rose-300 focus:ring-rose-500' : ''} ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}

// ---------- Toggle (Switch) ----------
export function Toggle({ checked, onChange, label, description, disabled, className = '' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`group flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl p-3 text-left transition hover:bg-navy-50 dark:hover:bg-slate-700/50 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      <span>
        <span className="block text-sm font-semibold text-navy-800 dark:text-slate-200">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-navy-400 dark:text-slate-500">{description}</span>}
      </span>
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
          checked ? 'bg-blue-600' : 'bg-navy-200'
        }`}
        aria-hidden="true"
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  )
}

// ---------- SegmentedControl ----------
export function SegmentedControl({ options, value, onChange, size = 'md', className = '' }) {
  return (
    <div
      role="radiogroup"
      className={`inline-flex flex-wrap gap-1 rounded-xl bg-navy-100/80 p-1 dark:bg-slate-700/80 ${className}`}
    >
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={[
              'cursor-pointer rounded-lg font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
              selected
                ? 'bg-white text-navy-900 shadow-sm dark:bg-slate-600 dark:text-white'
                : 'text-navy-500 hover:text-navy-800 dark:text-slate-400 dark:hover:text-white',
            ].join(' ')}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ---------- ColorPicker (danh mục) ----------
export function ColorPicker({ colors, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label || 'Chọn màu'} className="flex flex-wrap gap-2">
      {colors.map((color) => {
        const selected = value === color
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`Màu ${color}`}
            onClick={() => onChange(color)}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            style={{ backgroundColor: color }}
          >
            {selected && (
              <Check size={18} weight="bold" className="text-white" aria-hidden="true" />
            )}
          </button>
        )
      })}
    </div>
  )
}
