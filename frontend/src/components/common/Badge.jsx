import { WarningCircle } from '@phosphor-icons/react'
import { TASK_STATUS, OVERDUE_STATUS, PRIORITY, NOTIFICATION_ACTION } from '../../lib/constants'

export default function Badge({ children, className = '', icon: Icon, ...props }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${className}`}
      {...props}
    >
      {Icon && <Icon size={12} weight="bold" />}
      {children}
    </span>
  )
}

export function StatusBadge({ status, className = '' }) {
  if (status === 'OVERDUE') {
    const s = OVERDUE_STATUS
    return (
      <Badge className={`${s.badge} ${className}`} icon={WarningCircle}>
        {s.label}
      </Badge>
    )
  }
  const s = TASK_STATUS[status]
  if (!s) return null
  return <Badge className={`${s.badge} ${className}`}>{s.label}</Badge>
}

export function PriorityBadge({ priority, className = '' }) {
  const p = PRIORITY[priority]
  if (!p) return null
  return (
    <Badge className={`${p.badge} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} aria-hidden="true" />
      {p.label}
    </Badge>
  )
}

export function CategoryBadge({ category, className = '' }) {
  if (!category) {
    return <Badge className="bg-slate-100 text-slate-500 ring-slate-200">Không phân loại</Badge>
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${className}`}
      style={{
        backgroundColor: `${category.color}14`,
        color: category.color,
        borderColor: `${category.color}33`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: category.color }} aria-hidden="true" />
      {category.name}
    </span>
  )
}

export function ActionBadge({ action }) {
  const a = NOTIFICATION_ACTION[action]
  if (!a) return null
  return <Badge className={a.badge}>{a.label}</Badge>
}
