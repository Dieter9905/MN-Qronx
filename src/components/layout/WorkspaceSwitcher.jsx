import { Check, GraduationCap, Plus, User, UsersThree } from '@phosphor-icons/react'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useToast } from '../common/Toast'

// ─── Chọn chế độ: Cá nhân / Lớp học / Nhóm làm việc ───────────────────────
// Đây là "nút chọn tài khoản" kiểu OneUni: cùng một tài khoản nhưng đổi chế
// độ làm việc. Chế độ chưa có thì hiện nút "+" để tạo ngay tại chỗ.
function Row({ icon: Icon, label, hint, active, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-full px-2.5 py-1.5 text-left text-[12.5px] font-bold transition disabled:cursor-default',
        active
          ? 'bg-room-paper text-room-ink shadow-[0_2px_8px_rgb(0_0_0/0.08)] ring-1 ring-room-acorn/30'
          : 'text-room-ink/65 hover:bg-room-paper/70 hover:text-room-ink',
      ].join(' ')}
    >
      <Icon size={15} weight={active ? 'bold' : 'regular'} className={active ? 'text-room-acorn' : ''} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint && <span className="shrink-0 text-[10px] font-bold text-room-ink/65">{hint}</span>}
      {active && <Check size={13} weight="bold" className="shrink-0 text-room-acorn" />}
    </button>
  )
}

export default function WorkspaceSwitcher({ onNavigate }) {
  const { personal, classes, teams, activeId, select, createWorkspace } = useWorkspace()
  const toast = useToast()

  const handleCreate = async (type) => {
    const label =
      type === 'STUDENT'
        ? 'Tên lớp học (VD: CNTT K19 — Bách Khoa)'
        : 'Tên nhóm làm việc (VD: Nhóm đồ án 3)'
    const name = window.prompt(label)
    if (!name?.trim()) return
    const res = await createWorkspace(type, name.trim())
    if (res.success) {
      toast.success(res.message || 'Đã tạo không gian mới')
      onNavigate?.()
    } else {
      toast.error(res.message || 'Không tạo được không gian')
    }
  }

  return (
    <div className="mb-3 rounded-2xl bg-room-oat/40 p-1.5 ring-1 ring-room-acorn/15">
      <p className="px-2.5 pb-1 pt-0.5 text-[11px] font-bold text-room-ink/65">
        Chế độ làm việc
      </p>

      <Row
        icon={User}
        label={personal?.workspace?.name || 'Cá nhân'}
        hint="Cá nhân"
        active={activeId === personal?.workspace?.workspaceId}
        onClick={() => {
          if (personal) select(personal.workspace.workspaceId)
          onNavigate?.()
        }}
      />

      {classes.map((c) => (
        <Row
          key={c.workspace.workspaceId}
          icon={GraduationCap}
          label={c.workspace.name}
          hint="Sinh viên"
          active={activeId === c.workspace.workspaceId}
          onClick={() => {
            select(c.workspace.workspaceId)
            onNavigate?.()
          }}
        />
      ))}
      <Row
        icon={Plus}
        label="Thêm lớp học"
        onClick={() => handleCreate('STUDENT')}
      />

      {teams.map((t) => (
        <Row
          key={t.workspace.workspaceId}
          icon={UsersThree}
          label={t.workspace.name}
          hint="Nhóm"
          active={activeId === t.workspace.workspaceId}
          onClick={() => {
            select(t.workspace.workspaceId)
            onNavigate?.()
          }}
        />
      ))}
      <Row icon={Plus} label="Tạo nhóm làm việc" onClick={() => handleCreate('TEAM')} />
    </div>
  )
}
