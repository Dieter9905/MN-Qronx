import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Plus, X, Lightning, CalendarBlank, Brain, Clock, Tag, Repeat, CheckCircle, Sparkle, ListChecks, Crown, Lock } from '@phosphor-icons/react'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from './common/Toast'
import { useAuth } from '../context/AuthContext'
import { createTask } from '../services/taskService'
import { getCategories } from '../services/categoryService'
import { parseNaturalLanguageTasks, suggestTaskBreakdown, fetchAIParseTasks } from '../services/aiService'

const PRIORITY_DOT = { LOW: 'bg-slate-400', MEDIUM: 'bg-blue-500', HIGH: 'bg-amber-500', URGENT: 'bg-rose-500' }
const PRIORITY_LABEL = { LOW: 'Thấp', MEDIUM: 'Trung bình', HIGH: 'Cao', URGENT: 'Khẩn cấp' }

export default function QuickCapture({ onClose, onCreated }) {
  const { lang } = useLanguage()
  const t = app_text[lang]
  const toast = useToast()
  const { user } = useAuth()
  const isPro = user?.plan === 'PRO'

  const [mode, setMode] = useState(isPro ? 'ai' : 'form') // 'ai' (Pro only) or 'form'
  const [inputText, setInputText] = useState('')
  const [parsedTasks, setParsedTasks] = useState([])
  const [parsing, setParsing] = useState(false)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [suggestedSubtasks, setSuggestedSubtasks] = useState([])

  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [dueAt, setDueAt] = useState('')
  const [repeatType, setRepeatType] = useState('NONE')
  const [categories, setCategories] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getCategories().then((res) => {
      if (res.success) setCategories(res.data)
    })
  }, [])

  // Nhận danh sách công việc từ AI → map categoryName sang categoryId + đồng bộ form khi 1 việc
  const applyParsedTasks = useCallback(
    (tasks) => {
      const normalized = tasks.map((tk) => {
        let categoryId = tk.categoryId ? String(tk.categoryId) : null
        if (!categoryId && tk.categoryName) {
          const found = categories.find((c) => c.name.toLowerCase().includes(String(tk.categoryName).toLowerCase()))
          if (found) categoryId = String(found.id)
        }
        return { ...tk, categoryId }
      })
      setParsedTasks(normalized)
      if (normalized.length === 1) {
        const first = normalized[0]
        setTitle(first.title)
        setPriority(first.priority || 'MEDIUM')
        setDueAt(first.dueAt || '')
        setRepeatType(first.repeatType || 'NONE')
        if (first.categoryId) setCategoryId(first.categoryId)
      }
    },
    [categories]
  )

  // Parse input text when it changes — AI THẬT (9Router) qua backend, fallback parser cục bộ
  useEffect(() => {
    if (mode === 'ai' && inputText.trim()) {
      const timer = setTimeout(async () => {
        setParsing(true)
        try {
          const aiTasks = await fetchAIParseTasks(inputText)
          if (aiTasks.length) {
            applyParsedTasks(aiTasks)
            setParsing(false)
            return
          }
        } catch {
          // Lỗi mạng / chưa cấu hình AI / hết thời gian → dùng parser cục bộ
        }
        const result = parseNaturalLanguageTasks(inputText, categories)
        if (result.success) applyParsedTasks(result.tasks)
        else setParsedTasks([])
        setParsing(false)
      }, 600)
      return () => clearTimeout(timer)
    } else {
      setParsedTasks([])
      setParsing(false)
    }
  }, [inputText, mode, categories, applyParsedTasks])

  const handleSuggestBreakdown = useCallback(() => {
    if (title) {
      const subtasks = suggestTaskBreakdown(title)
      setSuggestedSubtasks(subtasks)
      setShowBreakdown(true)
    }
  }, [title])

  const handleSubmit = async (e) => {
    e.preventDefault()

    // ── AI mode: tạo NHIỀU công việc cùng lúc ──
    if (mode === 'ai') {
      if (!parsedTasks.length) {
        toast.error('AI chưa nhận diện được công việc nào – thử lại với cách viết khác')
        return
      }
      setSaving(true)
      let created = 0
      let firstErr = ''
      for (const tk of parsedTasks) {
        const res = await createTask({
          title: tk.title,
          description: tk.description || '',
          categoryId: tk.categoryId || undefined,
          priority: tk.priority || 'MEDIUM',
          dueAt: tk.dueAt || undefined,
          repeatType: tk.repeatType || 'NONE',
          repeatDays: tk.repeatDays || [],
          reminders: tk.reminders || [],
          subtasks: parsedTasks.length === 1 ? suggestedSubtasks : [],
        })
        if (res.success) created += 1
        else if (!firstErr) firstErr = res.message
      }
      setSaving(false)
      if (!created) {
        toast.error(firstErr || t.quickCaptureError)
        return
      }
      toast.success(created > 1 ? `Đã tạo ${created} công việc` : t.quickCaptureSuccess)
      onCreated?.()
      onClose()
      return
    }

    // ── Form mode: tạo 1 công việc ──
    if (!title.trim()) return
    setSaving(true)
    // dueAt từ input datetime-local là giờ địa phương KHÔNG kèm múi giờ
    // (vd "2026-09-10T14:30") → phải chuyển sang ISO (UTC) trước khi gửi,
    // nếu không server (chạy theo UTC) sẽ hiểu lệch 7 giờ so với giờ VN.
    const dueAtIso = dueAt ? new Date(dueAt).toISOString() : undefined
    if (dueAtIso && new Date(dueAtIso) <= new Date()) {
      setSaving(false)
      toast.error('Thời điểm đến hạn phải lớn hơn thời điểm hiện tại')
      return
    }
    const res = await createTask({
      title: title.trim(),
      description: '',
      categoryId: categoryId || undefined,
      priority,
      dueAt: dueAtIso,
      repeatType,
      reminders: [],
      subtasks: [],
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

  const formatDateTime = (isoString) => {
    if (!isoString) return ''
    const date = new Date(isoString)
    return date.toLocaleString('vi-VN', {
      weekday: 'long',
      day: 'numeric',
      month: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const priorityOptions = [
    { value: 'LOW', label: '🟢 Low', color: 'text-emerald-600' },
    { value: 'MEDIUM', label: '🟡 Medium', color: 'text-amber-600' },
    { value: 'HIGH', label: '🟠 High', color: 'text-orange-600' },
    { value: 'URGENT', label: '🔴 Urgent', color: 'text-rose-600' },
  ]

  const repeatOptions = [
    { value: 'NONE', label: 'Không lặp' },
    { value: 'DAILY', label: 'Hàng ngày' },
    { value: 'WEEKLY', label: 'Hàng tuần' },
    { value: 'MONTHLY', label: 'Hàng tháng' },
  ]

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-navy-900/60 backdrop-blur-sm sm:items-center dark:bg-black/60">
      <div className="relative mx-4 w-full max-w-lg animate-slide-up">
        <div className="overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-navy-100 dark:bg-slate-900 dark:ring-slate-700">
          {/* Header */}
          <div className="flex items-center justify-between bg-brand-gradient px-5 py-4">
            <div className="flex items-center gap-2 text-white">
              <Lightning size={18} weight="fill" />
              <span className="font-bold">{t.quickCapture}</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Mode toggle */}
              <div className="flex rounded-lg bg-white/20 p-0.5">
                <button
                  type="button"
                  onClick={() => isPro && setMode('ai')}
                  disabled={!isPro}
                  title={isPro ? '' : 'Trợ lý AI chỉ dành cho gói Pro'}
                  className={`flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition ${
                    mode === 'ai' ? 'bg-white text-blue-600' : 'text-white/80 hover:text-white'
                  } ${!isPro ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  {isPro ? <Brain size={14} weight="bold" /> : <Lock size={14} weight="bold" />}
                  AI
                </button>
                <button
                  type="button"
                  onClick={() => setMode('form')}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition ${
                    mode === 'form' ? 'bg-white text-blue-600' : 'text-white/80 hover:text-white'
                  }`}
                >                    <Sparkle size={14} weight="bold" />
                  Form
                </button>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/20 hover:text-white"
              >
                <X size={16} weight="bold" />
              </button>
            </div>
          </div>

          {/* Chưa phải Pro → mời nâng cấp để mở AI */}
          {!isPro && (
            <div className="p-5">
              <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 p-5 text-center text-white shadow-glow-purple">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
                  <Crown size={24} weight="fill" />
                </span>
                <p className="mt-3 text-base font-extrabold">Tạo công việc bằng AI – chỉ dành cho Pro</p>
                <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-violet-100">
                  Nhập bằng lời tự nhiên, AI tự hiểu thời hạn, ưu tiên, nhắc nhở và gợi ý các bước thực hiện.
                </p>
                <Link to="/app/billing" onClick={onClose} className="mt-4 inline-block">
                  <button
                    type="button"
                    className="cursor-pointer rounded-xl bg-white px-5 py-2.5 text-sm font-extrabold text-violet-700 shadow-md transition hover:scale-[1.03] active:scale-95"
                  >
                    Nâng cấp lên Pro
                  </button>
                </Link>
              </div>
            </div>
          )}

          {/* AI Input Mode */}
          {mode === 'ai' && isPro && (
            <div className="p-5">
              {/* Natural language input */}
              <div className="relative">
                <div className="absolute left-3 top-3 text-blue-500">
                  <Brain size={20} weight="bold" />
                </div>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={t.aiPlaceholder}
                  rows={3}
                  autoFocus
                  onKeyDown={(e) => {
                    // Ctrl/Cmd + Enter → tạo ngay
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSubmit(e)
                  }}
                  className="w-full rounded-xl border border-navy-200 bg-navy-50/50 pl-10 pr-4 py-3 text-sm font-semibold text-navy-900 placeholder-navy-300 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500 dark:focus:border-blue-400"
                />
              </div>

              {/* Đang phân tích */}
              {parsing && parsedTasks.length === 0 && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-blue-50/50 p-3 text-sm font-semibold text-blue-600 ring-1 ring-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:ring-blue-800/50">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-500" />
                  AI đang phân tích…
                </div>
              )}

              {/* Parsed preview — hỗ trợ nhiều công việc */}
              {parsedTasks.length > 0 && (
                <div className="mt-4 rounded-xl bg-blue-50/50 p-4 ring-1 ring-blue-100 dark:bg-blue-900/20 dark:ring-blue-800/50">
                  <div className="flex items-center gap-2 text-sm font-bold text-blue-700 dark:text-blue-400">
                    <Sparkle size={16} weight="fill" />
                    {t.aiParsed}
                    {parsedTasks.length > 1 && (
                      <span className="rounded-full bg-blue-600/10 px-2 py-0.5 text-[11px] font-extrabold text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
                        {parsedTasks.length} công việc
                      </span>
                    )}
                  </div>

                  <ul className="mt-3 space-y-2">
                    {parsedTasks.map((tk, i) => (
                      <li key={i} className="rounded-xl bg-white p-3 ring-1 ring-blue-100 dark:bg-slate-800 dark:ring-slate-700">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-navy-900 dark:text-white">📌 {tk.title}</p>
                          {tk.dueAt && (
                            <span className="shrink-0 text-xs font-bold text-blue-600 dark:text-blue-400">
                              📅 {formatDateTime(tk.dueAt)}
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-navy-500 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[tk.priority] || 'bg-blue-500'}`} aria-hidden="true" />
                            {PRIORITY_LABEL[tk.priority] || tk.priority}
                          </span>
                          {tk.reminders?.length > 0 && <span>🔔 {tk.reminders.length} nhắc nhở</span>}
                          {tk.repeatType !== 'NONE' && (
                            <span>🔄 {repeatOptions.find((r) => r.value === tk.repeatType)?.label}</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>

                  {/* Suggest breakdown button — chỉ khi 1 công việc */}
                  {parsedTasks.length === 1 && (
                    <button
                      type="button"
                      onClick={handleSuggestBreakdown}
                      className="mt-3 flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-blue-600 shadow-sm ring-1 ring-blue-200 transition hover:bg-blue-50 dark:bg-slate-800 dark:text-blue-400 dark:ring-blue-700"
                    >
                      <ListChecks size={14} weight="bold" />
                      {t.aiSuggestBreakdown}
                    </button>
                  )}
                </div>
              )}

              {/* Suggested subtasks */}
              {showBreakdown && suggestedSubtasks.length > 0 && (
                <div className="mt-3 rounded-xl bg-emerald-50/50 p-3 ring-1 ring-emerald-100 dark:bg-emerald-900/20 dark:ring-emerald-800/50">
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle size={16} weight="fill" />
                    {t.aiSuggestedSteps}
                  </div>
                  <ul className="mt-2 space-y-1">
                    {suggestedSubtasks.map((sub, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-navy-700 dark:text-slate-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {sub.content}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Form Input Mode */}
          {mode === 'form' && (
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
                      {priorityOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
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

                {/* Repeat */}
                <div>
                  <label className="mb-1 block text-xs font-bold text-navy-500 dark:text-slate-400">Lặp lại</label>
                  <select
                    value={repeatType}
                    onChange={(e) => setRepeatType(e.target.value)}
                    className="w-full rounded-xl border border-navy-200 bg-navy-50/50 px-3 py-2.5 text-sm font-semibold text-navy-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-blue-400"
                  >
                    {repeatOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
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
          )}

          {/* AI Mode Submit */}
          {mode === 'ai' && isPro && (
            <div className="border-t border-navy-100 px-5 py-4 dark:border-slate-700">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-navy-200 bg-white py-2.5 text-sm font-bold text-navy-600 transition hover:bg-navy-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {t.quickCaptureCancel}
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!inputText.trim() || saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-gradient py-2.5 text-sm font-bold text-white shadow-glow-blue transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                >
                  {saving ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <Brain size={16} weight="bold" />
                  )}
                  {t.aiCreateTask}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Inline i18n for QuickCapture
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
    aiPlaceholder: 'VD: "Sáng 7h tập gym. Chiều 2h họp team. Tối 8h đọc sách. Nhắc trước 10 phút mỗi cái" – AI tạo nhiều công việc cùng lúc',
    aiParsed: 'AI đã phân tích:',
    aiSuggestBreakdown: 'Gợi ý các bước thực hiện',
    aiSuggestedSteps: 'Các bước gợi ý:',
    aiCreateTask: 'Tạo bằng AI',
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
    aiPlaceholder: 'e.g. "Gym at 7am. Team meeting at 2pm. Read at 8pm. Remind 10 min before each" – AI creates multiple tasks',
    aiParsed: 'AI parsed:',
    aiSuggestBreakdown: 'Suggest steps',
    aiSuggestedSteps: 'Suggested steps:',
    aiCreateTask: 'Create with AI',
  },
}
