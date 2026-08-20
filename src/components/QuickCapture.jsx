import { useState } from 'react'
import { Plus, X, Lightning, CalendarBlank } from '@phosphor-icons/react'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from './common/Toast'
import { createTask } from '../services/taskService'
import { getCategories } from '../services/categoryService'
import { useEffect } from 'react'

export default function QuickCapture({ onClose, onCreated }) {
  const { lang } = useLanguage()
  const t = app_text[lang]
  const toast = useToast()

  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [dueAt, setDueAt] = useState('')
  const [categories, setCategories] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getCategories().then((res) => {
      if (res.success) setCategories(res.data)
    })
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    const res = await createTask({
      title: title.trim(),
      categoryId: categoryId || undefined,
      priority,
      dueAt: dueAt || undefined,
    })
    setSaving(false)
    if (!res.success) {
      toast.error(res.message || t.quickCaptureError)
      return
    }
    toast.success(t.quickCaptureSuccess)
    onCreated?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-navy-900/60 backdrop-blur-sm sm:items-center dark:bg-black/60">
      <div className="relative mx-4 w-full max-w-md animate-slide-up">
        <div className="overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-navy-100 dark:bg-slate-900 dark:ring-slate-700">
          {/* Header */}
          <div className="flex items-center justify-between bg-brand-gradient px-5 py-4">
            <div className="flex items-center gap-2 text-white">
              <Lightning size={18} weight="fill" />
              <span className="font-bold">{t.quickCapture}</span>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/20 hover:text-white"
            >
              <X size={16} weight="bold" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5">
            <div className="space-y-3">
              {/* Title */}
              <div>
                <label className="mb-1 block text-xs font-bold text-navy-500 dark:text-slate-400">{t.quickCaptureTitle}</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t.quickCapturePlaceholder}
                  autoFocus
                  className="w-full rounded-xl border border-navy-200 bg-navy-50/50 px-4 py-2.5 text-sm font-semibold text-navy-900 placeholder-navy-300 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500 dark:focus:border-blue-400"
                />
              </div>

              {/* Category & Priority row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-navy-500 dark:text-slate-400">{t.quickCaptureCategory}</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full rounded-xl border border-navy-200 bg-navy-50/50 px-3 py-2.5 text-sm font-semibold text-navy-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-blue-400"
                  >
                    <option value="">—</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-navy-500 dark:text-slate-400">{t.quickCapturePriority}</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full rounded-xl border border-navy-200 bg-navy-50/50 px-3 py-2.5 text-sm font-semibold text-navy-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-blue-400"
                  >
                    <option value="LOW">🟢 Low</option>
                    <option value="MEDIUM">🟡 Medium</option>
                    <option value="HIGH">🟠 High</option>
                    <option value="URGENT">🔴 Urgent</option>
                  </select>
                </div>
              </div>

              {/* Due date */}
              <div>
                <label className="mb-1 block text-xs font-bold text-navy-500 dark:text-slate-400">{t.quickCaptureDue}</label>
                <input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="w-full rounded-xl border border-navy-200 bg-navy-50/50 px-3 py-2.5 text-sm font-semibold text-navy-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-blue-400"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-navy-200 bg-white py-2.5 text-sm font-bold text-navy-600 transition hover:bg-navy-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                {t.quickCaptureCancel}
              </button>
              <button
                type="submit"
                disabled={!title.trim() || saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-gradient py-2.5 text-sm font-bold text-white shadow-glow-blue transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
              >
                {saving ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <Plus size={16} weight="bold" />
                )}
                {t.quickCaptureSave}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Inline i18n for QuickCapture (subset)
const app_text = {
  vi: {
    quickCapture: 'Tạo nhanh',
    quickCaptureTitle: 'Tiêu đề công việc',
    quickCapturePlaceholder: 'Nhập tên công việc…',
    quickCaptureCategory: 'Danh mục',
    quickCapturePriority: 'Ưu tiên',
    quickCaptureDue: 'Đến hạn',
    quickCaptureSave: 'Lưu',
    quickCaptureCancel: 'Hủy',
    quickCaptureSuccess: 'Đã tạo công việc!',
    quickCaptureError: 'Lỗi khi tạo công việc',
  },
  en: {
    quickCapture: 'Quick Capture',
    quickCaptureTitle: 'Task Title',
    quickCapturePlaceholder: 'Enter task name…',
    quickCaptureCategory: 'Category',
    quickCapturePriority: 'Priority',
    quickCaptureDue: 'Due Date',
    quickCaptureSave: 'Save',
    quickCaptureCancel: 'Cancel',
    quickCaptureSuccess: 'Task created!',
    quickCaptureError: 'Error creating task',
  },
}
