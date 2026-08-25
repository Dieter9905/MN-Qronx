import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Lightning, CalendarBlank, Brain, Clock, Tag, Repeat, CheckCircle, Sparkle, ListChecks } from '@phosphor-icons/react'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from './common/Toast'
import { createTask } from '../services/taskService'
import { getCategories } from '../services/categoryService'
import { parseNaturalLanguage, suggestTaskBreakdown } from '../services/aiService'

export default function QuickCapture({ onClose, onCreated }) {
  const { lang } = useLanguage()
  const t = app_text[lang]
  const toast = useToast()

  const [mode, setMode] = useState('ai') // 'ai' or 'form'
  const [inputText, setInputText] = useState('')
  const [parsedData, setParsedData] = useState(null)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [suggestedSubtasks, setSuggestedSubtasks] = useState([])

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

  // Parse input text when it changes
  useEffect(() => {
    if (mode === 'ai' && inputText.trim()) {
      const timer = setTimeout(() => {
        const result = parseNaturalLanguage(inputText, categories)
        if (result.success) {
          setParsedData(result.data)
          // Sync with form fields
          setTitle(result.data.title)
          setPriority(result.data.priority)
          setDueAt(result.data.dueAt || '')
          if (result.data.categoryId) setCategoryId(String(result.data.categoryId))
        }
      }, 300)
      return () => clearTimeout(timer)
    } else {
      setParsedData(null)
    }
  }, [inputText, mode, categories])

  const handleSuggestBreakdown = useCallback(() => {
    if (title) {
      const subtasks = suggestTaskBreakdown(title)
      setSuggestedSubtasks(subtasks)
      setShowBreakdown(true)
    }
  }, [title])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    const taskTitle = mode === 'ai' ? (parsedData?.title || title) : title
    if (!taskTitle?.trim()) return
    
    setSaving(true)
    const res = await createTask({
      title: taskTitle.trim(),
      description: parsedData?.description || '',
      categoryId: categoryId || parsedData?.categoryId || undefined,
      priority: parsedData?.priority || priority,
      dueAt: dueAt || parsedData?.dueAt || undefined,
      repeatType: parsedData?.repeatType || 'NONE',
      reminders: parsedData?.reminders || [],
      subtasks: suggestedSubtasks,
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
                  onClick={() => setMode('ai')}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition ${
                    mode === 'ai' ? 'bg-white text-blue-600' : 'text-white/80 hover:text-white'
                  }`}
                >
                  <Brain size={14} weight="bold" />
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

          {/* AI Input Mode */}
          {mode === 'ai' && (
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
                  className="w-full rounded-xl border border-navy-200 bg-navy-50/50 pl-10 pr-4 py-3 text-sm font-semibold text-navy-900 placeholder-navy-300 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500 dark:focus:border-blue-400"
                />
              </div>

              {/* Parsed preview */}
              {parsedData && (
                <div className="mt-4 rounded-xl bg-blue-50/50 p-4 ring-1 ring-blue-100 dark:bg-blue-900/20 dark:ring-blue-800/50">
                  <div className="flex items-center gap-2 text-sm font-bold text-blue-700 dark:text-blue-400">
                    <Sparkle size={16} weight="fill" />
                    {t.aiParsed}
                  </div>
                  
                  <div className="mt-3 space-y-2">
                    {/* Title */}
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-bold text-navy-500 dark:text-slate-400">📌 {t.quickCaptureTitle}:</span>
                      <span className="text-sm font-semibold text-navy-900 dark:text-white">{parsedData.title}</span>
                    </div>
                    
                    {/* Due date */}
                    {parsedData.dueAt && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-bold text-navy-500 dark:text-slate-400">📅 {t.quickCaptureDue}:</span>
                        <span className="text-sm text-navy-700 dark:text-slate-300">{formatDateTime(parsedData.dueAt)}</span>
                      </div>
                    )}
                    
                    {/* Priority */}
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-bold text-navy-500 dark:text-slate-400">⚡ Ưu tiên:</span>
                      <span className={`text-sm font-semibold ${priorityOptions.find(p => p.value === parsedData.priority)?.color}`}>
                        {priorityOptions.find(p => p.value === parsedData.priority)?.label}
                      </span>
                    </div>
                    
                    {/* Repeat */}
                    {parsedData.repeatType !== 'NONE' && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-bold text-navy-500 dark:text-slate-400">🔄 Lặp lại:</span>
                        <span className="text-sm text-navy-700 dark:text-slate-300">
                          {repeatOptions.find(r => r.value === parsedData.repeatType)?.label}
                        </span>
                      </div>
                    )}
                    
                    {/* Reminders */}
                    {parsedData.reminders?.length > 0 && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-bold text-navy-500 dark:text-slate-400">🔔 Nhắc nhở:</span>
                        <span className="text-sm text-navy-700 dark:text-slate-300">
                          {parsedData.reminders.length} nhắc nhở
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Suggest breakdown button */}
                  <button
                    type="button"
                    onClick={handleSuggestBreakdown}
                    className="mt-3 flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-blue-600 shadow-sm ring-1 ring-blue-200 transition hover:bg-blue-50 dark:bg-slate-800 dark:text-blue-400 dark:ring-blue-700"
                  >
                    <ListChecks size={14} weight="bold" />
                    {t.aiSuggestBreakdown}
                  </button>
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
                    value={parsedData?.repeatType || 'NONE'}
                    onChange={(e) => {
                      if (parsedData) {
                        setParsedData({ ...parsedData, repeatType: e.target.value })
                      }
                    }}
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
          {mode === 'ai' && (
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
    aiPlaceholder: 'Ví dụ: "Ôn tập Toán chương 3 ngày mai lúc 19h, nhắc trước 30 phút, khẩn cấp"',
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
    aiPlaceholder: 'e.g. "Review Math chapter 3 tomorrow at 7pm, remind 30 min before, urgent"',
    aiParsed: 'AI parsed:',
    aiSuggestBreakdown: 'Suggest steps',
    aiSuggestedSteps: 'Suggested steps:',
    aiCreateTask: 'Create with AI',
  },
}
