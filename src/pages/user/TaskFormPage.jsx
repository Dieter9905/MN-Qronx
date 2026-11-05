import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Bell,
  BellRinging,
  Clock,
  Plus,
  Trash,
  ListChecks,
  FolderSimple,
  Check,
  Alarm,
  LockSimple,
  CircleNotch,
} from '@phosphor-icons/react'
import { createTask, updateTask, getTask } from '../../services/taskService'
import { getCategories, createCategory } from '../../services/categoryService'
import { getMembers } from '../../services/workspaceService'
import { useWorkspace } from '../../context/WorkspaceContext'
import Modal from '../../components/common/Modal'
import { useToast } from '../../components/common/Toast'
import { useAuth } from '../../context/AuthContext'
import {
  PRIORITY,
  REPEAT_TYPE_LIST,
  WEEKDAYS,
  PLAN_REMINDER_LIMIT,
  CATEGORY_COLORS,
  NAG_INTERVALS,
  isProPlan,
  isPaidPlan,
} from '../../lib/constants'
import { ColorPicker } from '../../components/common/Inputs'
import {
  RoomField,
  RoomInput,
  RoomSegmented,
  RoomSelect,
  RoomTextarea,
  RoomButton,
  RoomCard,
} from '../../components/common/RoomUI'
import { toDate, addMinutes } from '../../lib/format'

function toLocalInputValue(date) {
  if (!date) return ''
  const d = toDate(date)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const PRESET_REMINDERS = [
  { label: 'Đúng giờ', offset: 0 },
  { label: 'Trước 10 phút', offset: -10 },
  { label: 'Trước 30 phút', offset: -30 },
  { label: 'Trước 1 giờ', offset: -60 },
]

// Viên chip nhỏ không nhấn được (đếm số, nhãn PRO) — thẻ giấy nổi trên khay Oat
const countChipCls =
  'rounded-full bg-room-oat/70 px-2 py-0.5 text-xs font-bold text-room-ink/60'
const proChipCls =
  'rounded-full bg-room-oat/70 px-2 py-0.5 text-[11px] font-bold text-room-ink/70 ring-1 ring-room-acorn/30'

export default function TaskFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const plan = user?.plan || 'FREE'
  const reminderLimit = PLAN_REMINDER_LIMIT[plan] || 5
  const canRepeat = isPaidPlan(plan)
  // "Nhắc dai" chỉ gói Pro — đây là điểm khác biệt rõ nhất của Pro (xem docs/billing.md)
  const canNag = isProPlan(plan)

  // Chế độ Nhóm: việc tạo ra có thể giao ngay cho một thành viên khác
  const { active } = useWorkspace()
  const teamWorkspace = active?.workspace?.type === 'TEAM' ? active.workspace : null
  const [teamMembers, setTeamMembers] = useState([])

  const [loading, setLoading] = useState(isEdit)
  const [categories, setCategories] = useState([])
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [newCat, setNewCat] = useState({ name: '', color: CATEGORY_COLORS[0] })

  const [form, setForm] = useState({
    title: '',
    description: '',
    categoryId: '',
    priority: 'MEDIUM',
    dueAt: '',
    repeatType: 'NONE',
    repeatDays: [],
    reminders: [],
    nagEveryMinutes: null,
    subtasks: [],
    assigneeId: '',
  })
  const [origDueAt, setOrigDueAt] = useState(null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const loadCategories = async () => {
    const res = await getCategories({ isActive: true })
    if (res.success) setCategories(res.data)
  }

  useEffect(() => {
    loadCategories()

  }, [])

  // Thành viên nhóm để chọn người phụ trách — chỉ tải khi đúng chế độ Nhóm
  useEffect(() => {
    if (!teamWorkspace) {
      setTeamMembers([])
      return
    }
    ;(async () => {
      const res = await getMembers(teamWorkspace.workspaceId)
      if (res.success) setTeamMembers(res.data?.members || [])
    })()
  }, [teamWorkspace])

  useEffect(() => {
    if (!isEdit) return
    ;(async () => {
      const res = await getTask(id)
      if (!res.success) {
        toast.error(res.message)
        navigate('/app/tasks', { replace: true })
        return
      }
      const t = res.data
      setForm({
        title: t.title,
        description: t.description || '',
        categoryId: t.categoryId ? String(t.categoryId) : '',
        priority: t.priority,
        dueAt: toLocalInputValue(t.dueAt),
        repeatType: t.repeatType,
        repeatDays: Array.isArray(t.repeatDays) ? t.repeatDays : [],
        reminders: t.reminders
          .filter((r) => r.status === 'SCHEDULED')
          .map((r) => ({ id: r.id, remindAt: toLocalInputValue(r.remindAt) })),
        nagEveryMinutes: t.nagEveryMinutes ?? null,
        subtasks: t.subtasks.map((s) => ({ id: s.id, content: s.content })),
      })
      setOrigDueAt(t.dueAt)
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const dueDate = useMemo(() => (form.dueAt ? toDate(form.dueAt) : null), [form.dueAt])

  const set = (k) => (v) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((er) => ({ ...er, [k]: undefined }))
  }

  // Ngày ISO 8601 (1=Thứ 2 … 7=CN) của một ngày
  const weekdayIso = (d) => (d.getDay() === 0 ? 7 : d.getDay())

  // Chuyển loại lặp: sang Hằng tuần → mặc định chọn đúng thứ của ngày đến hạn
  const changeRepeatType = (val) => {
    setForm((f) => {
      let repeatDays = Array.isArray(f.repeatDays) ? f.repeatDays : []
      if (val === 'WEEKLY') {
        const due = f.dueAt ? toDate(f.dueAt) : null
        if (!repeatDays.length && due) repeatDays = [weekdayIso(due)]
      } else {
        repeatDays = []
      }
      return { ...f, repeatType: val, repeatDays }
    })
    setErrors((er) => ({ ...er, repeatType: undefined }))
  }

  const toggleWeekday = (day) => {
    setForm((f) => {
      const has = f.repeatDays.includes(day)
      const repeatDays = has ? f.repeatDays.filter((x) => x !== day) : [...f.repeatDays, day]
      return { ...f, repeatDays }
    })
  }

  const addPresetReminder = (offset) => {
    if (!dueDate) {
      toast.error('Vui lòng chọn thời điểm đến hạn trước')
      return
    }
    if (form.reminders.length >= reminderLimit) {
      toast.error(
        reminderLimit <= 2
          ? `Gói Miễn phí chỉ được tối đa ${reminderLimit} nhắc nhở mỗi công việc. Nâng cấp Plus/Pro để thêm nhiều hơn.`
          : `Mỗi công việc chỉ được có tối đa ${reminderLimit} nhắc nhở`
      )
      return
    }
    const remindAt = addMinutes(dueDate, offset)
    if (remindAt > dueDate) {
      toast.error('Thời điểm nhắc nhở phải trước hoặc bằng thời hạn')
      return
    }
    setForm((f) => ({
      ...f,
      reminders: [...f.reminders, { id: null, remindAt: toLocalInputValue(remindAt) }],
    }))
  }

  const updateReminder = (i, value) => {
    setForm((f) => {
      const reminders = f.reminders.map((r, idx) => (idx === i ? { ...r, remindAt: value } : r))
      return { ...f, reminders }
    })
  }

  const removeReminder = (i) => {
    setForm((f) => ({ ...f, reminders: f.reminders.filter((_, idx) => idx !== i) }))
  }

  const addSubtaskRow = () => {
    setForm((f) => ({ ...f, subtasks: [...f.subtasks, { id: null, content: '' }] }))
  }

  const updateSubtask = (i, value) => {
    setForm((f) => ({
      ...f,
      subtasks: f.subtasks.map((s, idx) => (idx === i ? { ...s, content: value } : s)),
    }))
  }

  const removeSubtaskRow = (i) => {
    setForm((f) => ({ ...f, subtasks: f.subtasks.filter((_, idx) => idx !== i) }))
  }

  const validate = () => {
    const er = {}
    const now = new Date()
    if (!form.title.trim()) er.title = 'Tiêu đề công việc không được để trống'
    if (!form.dueAt) er.dueAt = 'Vui lòng chọn thời điểm đến hạn'
    if (form.dueAt && toDate(form.dueAt) <= now) {
      // Tạo mới: luôn chặn thời hạn ở quá khứ.
      // Sửa: chỉ chặn khi người dùng thực sự đổi sang thời điểm quá khứ
      // (vẫn cho lưu công việc quá hạn mà không đụng thời hạn cũ).
      const changed = origDueAt && toDate(form.dueAt).getTime() !== toDate(origDueAt).getTime()
      if (!isEdit || changed) er.dueAt = 'Thời điểm đến hạn phải lớn hơn thời điểm hiện tại'
    }
    const invalidReminder = form.reminders.find((r) => r.remindAt && dueDate && toDate(r.remindAt) > dueDate)
    if (invalidReminder) er.reminders = 'Thời điểm nhắc nhở phải nhỏ hơn hoặc bằng thời hạn công việc'
    const pastReminder = form.reminders.find((r) => r.remindAt && toDate(r.remindAt) <= now)
    if (pastReminder) er.reminders = 'Thời điểm nhắc nhở phải lớn hơn thời điểm hiện tại'
    setErrors(er)
    return Object.keys(er).length === 0
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    const payload = {
      title: form.title,
      description: form.description,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      priority: form.priority,
      dueAt: new Date(form.dueAt).toISOString(),
      repeatType: form.repeatType,
      repeatDays:
        form.repeatType === 'WEEKLY'
          ? form.repeatDays.length
            ? form.repeatDays
            : dueDate
              ? [weekdayIso(dueDate)]
              : []
          : [],
      reminders: form.reminders.filter((r) => r.remindAt).map((r) => ({ id: r.id, remindAt: new Date(r.remindAt).toISOString() })),
      nagEveryMinutes: canNag ? form.nagEveryMinutes : null,
      // Giao việc cho thành viên nhóm (chỉ gửi khi đang ở chế độ Nhóm)
      assigneeId: !isEdit && form.assigneeId ? Number(form.assigneeId) : undefined,
      subtasks: form.subtasks.filter((s) => s.content.trim()).map((s) => ({ id: s.id, content: s.content.trim() })),
    }
    const res = isEdit ? await updateTask(id, payload) : await createTask(payload)
    setSaving(false)
    if (!res.success) {
      if (res.errors) setErrors(res.errors)
      toast.error(res.message)
      return
    }
    toast.success(res.message)
    navigate(`/app/tasks/${res.data.id}`, { replace: true })
  }

  const quickCreateCategory = async (e) => {
    e.preventDefault()
    if (!newCat.name.trim()) {
      toast.error('Vui lòng nhập tên danh mục')
      return
    }
    const res = await createCategory({ categoryName: newCat.name, colorCode: newCat.color })
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success('Đã tạo danh mục')
    setForm((f) => ({ ...f, categoryId: String(res.data.id) }))
    setNewCat({ name: '', color: CATEGORY_COLORS[0] })
    setCatModalOpen(false)
    loadCategories()
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <span role="status" aria-label="Đang tải">
          <CircleNotch size={28} className="animate-spin text-room-acorn" weight="bold" />
        </span>
        <p className="text-sm font-semibold text-room-ink/60">Đang tải biểu mẫu…</p>
      </div>
    )
  }

  const priorityOptions = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((p) => ({
    value: p,
    label: (
      <span className="inline-flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${PRIORITY[p].dot}`} aria-hidden="true" />
        {PRIORITY[p].label}
      </span>
    ),
  }))

  // Chips lùi sẵn của nhắc nhở + vien chọn Nhắc dai — cùng một da pill Oat
  const chipInactiveCls =
    'cursor-pointer rounded-full bg-room-oat/45 px-3.5 py-1.5 text-xs font-bold text-room-ink/80 ring-1 ring-inset ring-room-acorn/20 transition hover:bg-room-oat/75'
  const chipActiveCls =
    'cursor-pointer rounded-full bg-room-acorn px-3.5 py-1.5 text-xs font-bold text-room-paper ring-1 ring-inset ring-room-acorn/40 transition'

  return (
    <div className="mx-auto max-w-3xl animate-fade-in">
      <Link to={isEdit ? `/app/tasks/${id}` : '/app/tasks'} className="inline-flex items-center gap-1.5 text-sm font-bold text-room-ink/60 transition hover:text-room-acorn">
        <ArrowLeft size={16} weight="bold" /> {isEdit ? 'Quay lại chi tiết' : 'Quay lại danh sách'}
      </Link>
      <h1 className="mt-4 font-display text-2xl font-bold text-room-ink">{isEdit ? 'Sửa công việc' : 'Tạo công việc mới'}</h1>
      <p className="mt-1 text-sm font-semibold text-room-ink/55">
        {isEdit ? 'Cập nhật thông tin và nhắc nhở của công việc.' : 'Nhập tiêu đề, thời hạn và nhắc nhở. Chỉ vài bước là xong.'}
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5 pb-10">
        {/* Thông tin cơ bản */}
        <RoomCard className="space-y-4 p-5 sm:p-6">
          <h2 className="font-display font-bold text-room-ink">Thông tin cơ bản</h2>
          <RoomField label="Tiêu đề công việc" required error={errors.title}>
            {(fid) => (
              <RoomInput
                id={fid}
                value={form.title}
                onChange={(e) => set('title')(e.target.value)}
                placeholder="Ví dụ: Ôn tập môn Toán – Chương 3"
                invalid={!!errors.title}
                autoFocus={!isEdit}
              />
            )}
          </RoomField>
          <RoomField label="Mô tả" hint="Tùy chọn – mô tả chi tiết công việc cần làm">
            {(fid) => (
              <RoomTextarea id={fid} value={form.description} onChange={(e) => set('description')(e.target.value)} placeholder="Mô tả chi tiết công việc…" />
            )}
          </RoomField>
          <div className="grid gap-4 sm:grid-cols-2">
            <RoomField label="Danh mục">
              <div className="flex gap-2">
                <RoomSelect value={form.categoryId} onChange={(e) => set('categoryId')(e.target.value)} className="flex-1">
                  <option value="">Không phân loại</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </RoomSelect>
                <RoomButton variant="secondary" size="icon" aria-label="Tạo danh mục mới" onClick={() => setCatModalOpen(true)}>
                  <FolderSimple size={18} weight="bold" />
                </RoomButton>
              </div>
            </RoomField>
            <RoomField label="Thời điểm đến hạn" required error={errors.dueAt}>
              {(fid) => (
                <RoomInput
                  id={fid}
                  type="datetime-local"
                  value={form.dueAt}
                  onChange={(e) => set('dueAt')(e.target.value)}
                  invalid={!!errors.dueAt}
                />
              )}
            </RoomField>
          </div>
          <RoomField label="Mức độ ưu tiên">
            <RoomSegmented options={priorityOptions} value={form.priority} onChange={set('priority')} />
          </RoomField>

          {/* Giao việc chỉ có nghĩa trong chế độ Nhóm (có đồng đội cùng không gian) */}
          {teamWorkspace && !isEdit && (
            <RoomField
              label={`Người phụ trách (nhóm ${teamWorkspace.name})`}
              hint="Để trống nếu bạn tự làm. Người được giao nhận chuông nhắc và thấy việc ở trang Việc được giao."
            >
              <RoomSelect value={form.assigneeId} onChange={(e) => set('assigneeId')(e.target.value)}>
                <option value="">Tôi tự làm việc này</option>
                {teamMembers
                  .filter((m) => Number(m.user.userId) !== Number(user?.id ?? user?.userId))
                  .map((m) => (
                    <option key={m.workspaceMemberId} value={m.user.userId}>
                      {m.user.fullName} ({m.openTasks} việc đang mở)
                    </option>
                  ))}
              </RoomSelect>
            </RoomField>
          )}
          <RoomField label="Lặp lại">
            <RoomSegmented
              options={REPEAT_TYPE_LIST.map((r) =>
                canRepeat || r.value === 'NONE'
                  ? { value: r.value, label: r.label }
                  : { value: r.value, label: r.label, disabled: true, disabledTitle: 'Chỉ dành cho gói Plus/Pro' }
              )}
              value={form.repeatType}
              onChange={changeRepeatType}
            />
            {form.repeatType === 'WEEKLY' && canRepeat && (
              <div className="mt-3">
                <p className="text-xs font-bold text-room-ink/60">Lặp lại vào những ngày nào trong tuần?</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((day) => {
                    const active = form.repeatDays.includes(day.value)
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleWeekday(day.value)}
                        aria-pressed={active}
                        aria-label={day.long}
                        title={day.long}
                        className={`flex h-10 w-12 cursor-pointer items-center justify-center rounded-xl text-sm font-bold transition ${
                          active
                            ? 'bg-room-acorn text-room-paper ring-1 ring-inset ring-room-acorn/40'
                            : 'bg-room-oat/45 text-room-ink/80 ring-1 ring-inset ring-room-acorn/20 hover:bg-room-oat/75'
                        }`}
                      >
                        {day.label}
                      </button>
                    )
                  })}
                </div>
                {!form.repeatDays.length && (
                  <p className="mt-2 text-xs font-semibold text-room-ink/50">
                    Chưa chọn ngày – sẽ lặp lại vào đúng thứ của ngày đến hạn.
                  </p>
                )}
              </div>
            )}
            {!canRepeat && (
              <p className="mt-2 inline-flex flex-wrap items-center gap-1.5 text-xs font-bold text-room-ink/65">
                <BellRinging size={14} weight="bold" className="text-room-bell" />
                Công việc lặp lại là tính năng của gói Plus/Pro.{' '}
                <Link to="/app/billing" className="font-bold underline">
                  Nâng cấp ngay
                </Link>
              </p>
            )}
          </RoomField>
        </RoomCard>

        {/* Nhắc nhở */}
        <RoomCard className="p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display font-bold text-room-ink">
              <Bell size={19} weight="fill" className="text-room-bell" />
              Nhắc nhở
              <span className={countChipCls}>
                {form.reminders.length}/{reminderLimit}
              </span>
            </h2>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESET_REMINDERS.map((p) => (
              <button
                key={p.offset}
                type="button"
                onClick={() => addPresetReminder(p.offset)}
                disabled={form.reminders.length >= reminderLimit}
                className={`${chipInactiveCls} disabled:cursor-not-allowed disabled:opacity-40`}
              >
                + {p.label}
              </button>
            ))}
          </div>
          {errors.reminders && (
            <p role="alert" className="mt-2 text-xs font-bold text-room-ink">{errors.reminders}</p>
          )}
          {form.reminders.length > 0 && (
            <ul className="mt-4 space-y-2">
              {form.reminders.map((r, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Clock size={16} weight="bold" className="shrink-0 text-room-bell" />
                  <RoomInput
                    type="datetime-local"
                    value={r.remindAt}
                    onChange={(e) => updateReminder(i, e.target.value)}
                    aria-label={`Thời điểm nhắc nhở ${i + 1}`}
                    className="h-11 flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeReminder(i)}
                    aria-label="Xóa nhắc nhở"
                    className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-room-ink/35 transition hover:bg-room-oat/70 hover:text-room-acorn"
                  >
                    <Trash size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {form.reminders.length === 0 && (
            <p className="mt-3 text-xs font-semibold text-room-ink/50">
              Chưa có nhắc nhở – MN-Qronx sẽ không báo thức cho công việc này.
            </p>
          )}
        </RoomCard>

        {/* Nhắc dai (gói Pro) */}
        <RoomCard className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex items-center gap-2 font-display font-bold text-room-ink">
              <Alarm size={19} weight="fill" className="text-room-bell" />
              Nhắc dai tới khi xong
            </h2>
            <span className={proChipCls}>
              PRO
            </span>
          </div>
          <p className="mt-2 text-xs font-semibold text-room-ink/55">
            Việc chưa xong thì chuông tự kêu lại (tối đa 10 lần). Bấm “Xong” là thôi nhắc —
            dành cho việc không được phép quên.
          </p>

          {canNag ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => set('nagEveryMinutes')(null)}
                className={form.nagEveryMinutes === null ? chipActiveCls : chipInactiveCls}
              >
                Tắt
              </button>
              {NAG_INTERVALS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => set('nagEveryMinutes')(o.value)}
                  className={form.nagEveryMinutes === o.value ? chipActiveCls : chipInactiveCls}
                >
                  {o.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-xl bg-room-oat/45 p-3 ring-1 ring-inset ring-room-acorn/15">
              <p className="flex items-start gap-2 text-xs font-semibold text-room-ink/70">
                <LockSimple size={15} className="mt-0.5 shrink-0" />
                <span>
                  Gói hiện tại chỉ nhắc một lần. Nâng cấp Pro để chuông nhắc lại tới khi bạn
                  xác nhận xong.{' '}
                  <Link to="/app/billing" className="font-bold underline">
                    Nâng cấp Pro
                  </Link>
                </span>
              </p>
            </div>
          )}
        </RoomCard>

        {/* Việc con */}
        <RoomCard className="p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-display font-bold text-room-ink">
            <ListChecks size={19} weight="fill" className="text-room-acorn" />
            Việc con <span className="text-xs font-semibold text-room-ink/50">(tùy chọn)</span>
          </h2>
          {form.subtasks.length > 0 && (
            <ul className="mt-3 space-y-2">
              {form.subtasks.map((s, i) => (
                <li key={i} className="flex items-center gap-2">
                  <RoomInput
                    type="text"
                    value={s.content}
                    onChange={(e) => updateSubtask(i, e.target.value)}
                    placeholder={`Việc con ${i + 1}`}
                    aria-label={`Việc con ${i + 1}`}
                    className="h-11 flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeSubtaskRow(i)}
                    aria-label="Xóa việc con"
                    className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-room-ink/35 transition hover:bg-room-oat/70 hover:text-room-acorn"
                  >
                    <Trash size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <RoomButton variant="secondary" size="sm" icon={Plus} onClick={addSubtaskRow} className="mt-3">
            Thêm việc con
          </RoomButton>
        </RoomCard>

        {/* Hành động */}
        <div className="sticky bottom-20 z-20 flex flex-col-reverse gap-2 rounded-2xl bg-room-paper p-3 ring-1 ring-room-acorn/25 shadow-[0_18px_30px_-20px_rgb(0_0_0/0.35)] sm:flex-row sm:justify-end lg:bottom-4">
          <Link to={isEdit ? `/app/tasks/${id}` : '/app/tasks'} className="sm:inline-block">
            <RoomButton variant="secondary" fullWidth className="sm:w-auto">Hủy</RoomButton>
          </Link>
          <RoomButton type="submit" size="lg" loading={saving} icon={Check}>
            {isEdit ? 'Lưu thay đổi' : 'Tạo công việc'}
          </RoomButton>
        </div>
      </form>

      {/* Modal tạo danh mục nhanh */}
      <Modal
        open={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        title="Tạo danh mục mới"
        description="Nhóm công việc theo lĩnh vực: Học tập, Công việc, Cá nhân…"
        size="sm"
        skin="room"
        footer={
          <>
            <RoomButton variant="secondary" onClick={() => setCatModalOpen(false)}>Hủy</RoomButton>
            <RoomButton icon={Check} onClick={quickCreateCategory}>Tạo danh mục</RoomButton>
          </>
        }
      >
        <form onSubmit={quickCreateCategory} className="space-y-4">
          <RoomField label="Tên danh mục" required>
            {(fid) => (
              <RoomInput
                id={fid}
                value={newCat.name}
                onChange={(e) => setNewCat((c) => ({ ...c, name: e.target.value }))}
                placeholder="Ví dụ: Sức khỏe"
                autoFocus
              />
            )}
          </RoomField>
          <RoomField label="Màu hiển thị">
            <ColorPicker colors={CATEGORY_COLORS} value={newCat.color} onChange={(color) => setNewCat((c) => ({ ...c, color }))} />
          </RoomField>
        </form>
      </Modal>
    </div>
  )
}
