import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Bell,
  Clock,
  Plus,
  Trash,
  ListChecks,
  FolderSimple,
  Check,
} from '@phosphor-icons/react'
import { Field, Input, Textarea, Select, SegmentedControl } from '../../components/common/Inputs'
import Button from '../../components/common/Button'
import { createTask, updateTask, getTask } from '../../services/taskService'
import { getCategories, createCategory } from '../../services/categoryService'
import Modal from '../../components/common/Modal'
import { useToast } from '../../components/common/Toast'
import { PageLoader } from '../../components/common/Feedback'
import { useAuth } from '../../context/AuthContext'
import { PRIORITY, REPEAT_TYPE_LIST, WEEKDAYS, PLAN_REMINDER_LIMIT, CATEGORY_COLORS } from '../../lib/constants'
import { ColorPicker } from '../../components/common/Inputs'
import { toDate, addMinutes, setTime } from '../../lib/format'

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

export default function TaskFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const plan = user?.plan || 'FREE'
  const reminderLimit = PLAN_REMINDER_LIMIT[plan] || 5
  const canRepeat = plan === 'PLUS' || plan === 'PRO'

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
    subtasks: [],
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const loadCategories = async () => {
    const res = await getCategories({ isActive: true })
    if (res.success) setCategories(res.data)
  }

  useEffect(() => {
    loadCategories()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        subtasks: t.subtasks.map((s) => ({ id: s.id, content: s.content })),
      })
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
    if (!form.title.trim()) er.title = 'Tiêu đề công việc không được để trống'
    if (!form.dueAt) er.dueAt = 'Vui lòng chọn thời điểm đến hạn'
    const invalidReminder = form.reminders.find((r) => r.remindAt && dueDate && toDate(r.remindAt) > dueDate)
    if (invalidReminder) er.reminders = 'Thời điểm nhắc nhở phải nhỏ hơn hoặc bằng thời hạn công việc'
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

  if (loading) return <PageLoader label="Đang tải biểu mẫu…" />

  const priorityOptions = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((p) => ({
    value: p,
    label: (
      <span className="inline-flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${PRIORITY[p].dot}`} aria-hidden="true" />
        {PRIORITY[p].label}
      </span>
    ),
  }))

  return (
    <div className="mx-auto max-w-3xl animate-fade-in">
      <Link to={isEdit ? `/app/tasks/${id}` : '/app/tasks'} className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-500 transition hover:text-blue-600">
        <ArrowLeft size={16} weight="bold" /> {isEdit ? 'Quay lại chi tiết' : 'Quay lại danh sách'}
      </Link>
      <h1 className="page-title dark:text-white mt-4">{isEdit ? 'Sửa công việc' : 'Tạo công việc mới'}</h1>
      <p className="mt-1 text-sm font-medium text-navy-400 dark:text-slate-500">
        {isEdit ? 'Cập nhật thông tin và nhắc nhở của công việc.' : 'Nhập tiêu đề, thời hạn và nhắc nhở. Chỉ vài bước là xong.'}
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5 pb-10">
        {/* Thông tin cơ bản */}
        <section className="card space-y-4 p-5 sm:p-6">
          <h2 className="font-bold text-navy-900 dark:text-white">Thông tin cơ bản</h2>
          <Field label="Tiêu đề công việc" required error={errors.title}>
            {(fid) => (
              <Input
                id={fid}
                value={form.title}
                onChange={(e) => set('title')(e.target.value)}
                placeholder="Ví dụ: Ôn tập môn Toán – Chương 3"
                invalid={!!errors.title}
                autoFocus={!isEdit}
              />
            )}
          </Field>
          <Field label="Mô tả" hint="Tùy chọn – mô tả chi tiết công việc cần làm">
            {(fid) => (
              <Textarea id={fid} value={form.description} onChange={(e) => set('description')(e.target.value)} placeholder="Mô tả chi tiết công việc…" />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Danh mục">
              <div className="flex gap-2">
                <Select value={form.categoryId} onChange={(e) => set('categoryId')(e.target.value)} className="flex-1">
                  <option value="">Không phân loại</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
                <Button variant="secondary" size="icon" aria-label="Tạo danh mục mới" onClick={() => setCatModalOpen(true)}>
                  <FolderSimple size={18} weight="bold" />
                </Button>
              </div>
            </Field>
            <Field label="Thời điểm đến hạn" required error={errors.dueAt}>
              {(fid) => (
                <Input
                  id={fid}
                  type="datetime-local"
                  value={form.dueAt}
                  onChange={(e) => set('dueAt')(e.target.value)}
                  invalid={!!errors.dueAt}
                />
              )}
            </Field>
          </div>
          <Field label="Mức độ ưu tiên">
            <SegmentedControl options={priorityOptions} value={form.priority} onChange={set('priority')} />
          </Field>
          <Field label="Lặp lại">
            <SegmentedControl
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
                <p className="text-xs font-semibold text-navy-500 dark:text-slate-400">Lặp lại vào những ngày nào trong tuần?</p>
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
                            ? 'bg-brand-gradient text-white shadow-md'
                            : 'bg-navy-50 text-navy-600 ring-1 ring-inset ring-navy-100 hover:bg-blue-50 hover:text-blue-700 hover:ring-blue-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-300'
                        }`}
                      >
                        {day.label}
                      </button>
                    )
                  })}
                </div>
                {!form.repeatDays.length && (
                  <p className="mt-2 text-xs font-medium text-navy-400 dark:text-slate-500">
                    Chưa chọn ngày – sẽ lặp lại vào đúng thứ của ngày đến hạn.
                  </p>
                )}
              </div>
            )}
            {!canRepeat && (
              <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                💡 Công việc lặp lại là tính năng của gói Plus/Pro.{' '}
                <Link to="/app/billing" className="font-bold underline">
                  Nâng cấp ngay
                </Link>
              </p>
            )}
          </Field>
        </section>

        {/* Nhắc nhở */}
        <section className="card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold text-navy-900 dark:text-white">
              <Bell size={19} weight="fill" className="text-amber-500 dark:text-amber-400" />
              Nhắc nhở
              <span className="rounded-full bg-navy-100 px-2 py-0.5 text-xs font-bold text-navy-500 dark:bg-slate-700 dark:text-slate-400">
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
                className="cursor-pointer rounded-full bg-navy-50 px-3.5 py-1.5 text-xs font-bold text-navy-700 ring-1 ring-inset ring-navy-100 transition hover:bg-blue-50 hover:text-blue-700 hover:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400"
              >
                + {p.label}
              </button>
            ))}
          </div>
          {errors.reminders && (
            <p role="alert" className="mt-2 text-xs font-medium text-rose-600">{errors.reminders}</p>
          )}
          {form.reminders.length > 0 && (
            <ul className="mt-4 space-y-2">
              {form.reminders.map((r, i) => (
                <li key={i} className="flex items-center gap-2">                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                      <Clock size={16} weight="bold" />
                    </span>
                  <input
                    type="datetime-local"
                    value={r.remindAt}
                    onChange={(e) => updateReminder(i, e.target.value)}
                    aria-label={`Thời điểm nhắc nhở ${i + 1}`}
                    className="h-11 flex-1 rounded-xl border-0 bg-navy-50 px-3 text-sm text-navy-900 ring-1 ring-inset ring-navy-100 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white dark:ring-slate-600 dark:focus:bg-slate-600"
                  />
                  <button
                    type="button"
                    onClick={() => removeReminder(i)}
                    aria-label="Xóa nhắc nhở"
                    className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-navy-400 transition hover:bg-rose-50 hover:text-rose-500"
                  >
                    <Trash size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {form.reminders.length === 0 && (
            <p className="mt-3 text-xs text-navy-400 dark:text-slate-500">
              Chưa có nhắc nhở – MN-Qronx sẽ không báo thức cho công việc này.
            </p>
          )}
        </section>

        {/* Việc con */}
        <section className="card p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-bold text-navy-900 dark:text-white">
            <ListChecks size={19} weight="fill" className="text-blue-600 dark:text-blue-400" />
            Việc con <span className="text-xs font-medium text-navy-400 dark:text-slate-500">(tùy chọn)</span>
          </h2>
          {form.subtasks.length > 0 && (
            <ul className="mt-3 space-y-2">
              {form.subtasks.map((s, i) => (
                <li key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={s.content}
                    onChange={(e) => updateSubtask(i, e.target.value)}
                    placeholder={`Việc con ${i + 1}`}
                    aria-label={`Việc con ${i + 1}`}
                    className="h-11 flex-1 rounded-xl border-0 bg-navy-50 px-3.5 text-sm text-navy-900 ring-1 ring-inset ring-navy-100 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white dark:ring-slate-600 dark:focus:bg-slate-600"
                  />
                  <button
                    type="button"
                    onClick={() => removeSubtaskRow(i)}
                    aria-label="Xóa việc con"
                    className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-navy-400 transition hover:bg-rose-50 hover:text-rose-500"
                  >
                    <Trash size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button variant="ghost" size="sm" icon={Plus} onClick={addSubtaskRow} className="mt-3">
            Thêm việc con
          </Button>
        </section>

        {/* Hành động */}
        <div className="sticky bottom-20 z-20 flex flex-col-reverse gap-2 rounded-2xl bg-white/95 p-3 shadow-card-hover ring-1 ring-navy-100 backdrop-blur sm:flex-row sm:justify-end lg:bottom-4">
          <Link to={isEdit ? `/app/tasks/${id}` : '/app/tasks'} className="sm:inline-block">
            <Button variant="secondary" fullWidth className="sm:w-auto">Hủy</Button>
          </Link>
          <Button type="submit" variant="gradient" size="lg" loading={saving} icon={Check}>
            {isEdit ? 'Lưu thay đổi' : 'Tạo công việc'}
          </Button>
        </div>
      </form>

      {/* Modal tạo danh mục nhanh */}
      <Modal
        open={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        title="Tạo danh mục mới"
        description="Nhóm công việc theo lĩnh vực: Học tập, Công việc, Cá nhân…"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCatModalOpen(false)}>Hủy</Button>
            <Button variant="gradient" icon={Check} onClick={quickCreateCategory}>Tạo danh mục</Button>
          </>
        }
      >
        <form onSubmit={quickCreateCategory} className="space-y-4">
          <Field label="Tên danh mục" required>
            {(fid) => (
              <Input
                id={fid}
                value={newCat.name}
                onChange={(e) => setNewCat((c) => ({ ...c, name: e.target.value }))}
                placeholder="Ví dụ: Sức khỏe"
                autoFocus
              />
            )}
          </Field>
          <Field label="Màu hiển thị">
            <ColorPicker colors={CATEGORY_COLORS} value={newCat.color} onChange={(color) => setNewCat((c) => ({ ...c, color }))} />
          </Field>
        </form>
      </Modal>
    </div>
  )
}
