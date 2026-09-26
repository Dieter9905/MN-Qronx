import { useEffect, useRef, useState } from 'react'
import { Brain, PaperPlaneTilt, Sparkle, Trash, Plus, CheckCircle } from '@phosphor-icons/react'
import { useToast } from './common/Toast'
import { createTask, getTasks, completeTask, deleteTask } from '../services/taskService'
import { TASK_COMMAND, detectTaskCommand, findTaskMatches, doneMessage, noMatchMessage } from '../lib/aiCommand'
import { loadChatMessages, saveChatMessages, clearChatMessages, lastMentionedFrom } from '../lib/chatHistory'
import { getCategories } from '../services/categoryService'
import { parseNaturalLanguageTasks, fetchAIParseTasks, suggestTaskBreakdown } from '../services/aiService'
import { PRIORITY, REPEAT_TYPE_LIST } from '../lib/constants'

function toLocalInputValue(date) {
  if (!date) return ''
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const REMINDER_CHOICES = [
  { label: 'Đúng giờ', offset: 0 },
  { label: 'Trước 10p', offset: -10 },
  { label: 'Trước 30p', offset: -30 },
  { label: 'Trước 1h', offset: -60 },
]

const WELCOME_TEXT =
  'Chào bạn! Gõ tự nhiên như “Sáng 7h tập gym. Chiều 2h họp team, nhắc trước 10 phút” để tôi tách thành từng công việc cho bạn duyệt. Tôi cũng làm được việc khác: “đánh dấu hoàn thành việc Họp team”, “xóa việc Đi siêu thị”, “hoàn thành việc đó”.'

const QUICK_REPLIES = [
  'Sáng 7h tập gym. Chiều 2h họp team. Tối 8h đọc sách. Nhắc trước 10 phút mỗi cái',
  'Ôn tập Toán ngày mai 19h, nhắc trước 30 phút, ưu tiên Cao',
  'Họp team thứ 2 9h hàng tuần',
  'Tạo hết đi',
  'Đánh dấu hoàn thành việc Họp team',
  'Xóa việc đi siêu thị',
]

function aiTaskToEditable(tk, categories) {
  let categoryId = tk.categoryId ? String(tk.categoryId) : ''
  if (!categoryId && tk.categoryName && categories.length) {
    const found = categories.find((c) => c.name.toLowerCase().includes(String(tk.categoryName).toLowerCase()))
    if (found) categoryId = String(found.id)
  }
  const dueLocal = tk.dueAt ? toLocalInputValue(tk.dueAt) : ''
  // reminders ISO -> offset phút so với dueAt (giữ đúng cấu trúc form: nhắc trước X)
  let offsets = []
  if (tk.dueAt && Array.isArray(tk.reminders)) {
    const due = new Date(tk.dueAt).getTime()
    offsets = tk.reminders
      .map((r) => Math.round((new Date(r.remindAt).getTime() - due) / 60000))
      .filter((n) => Number.isFinite(n) && n <= 0)
  }
  return {
    title: tk.title || '',
    description: tk.description || '',
    categoryId,
    priority: tk.priority || 'MEDIUM',
    dueAtLocal: dueLocal,
    repeatType: tk.repeatType || 'NONE',
    repeatDays: Array.isArray(tk.repeatDays) ? tk.repeatDays : [],
    reminderOffsets: [...new Set(offsets)].slice(0, 5),
    subtasks: [],
  }
}

function missingFields(t) {
  const miss = []
  if (!t.title?.trim()) miss.push('tiêu đề')
  if (!t.dueAtLocal) miss.push('thời hạn')
  return miss
}

export default function AiTaskChat({ onTasksCreated }) {
  const toast = useToast()
  const [categories, setCategories] = useState([])
  // Hội thoại được khôi phục từ lần trước (lưu theo tài khoản) — F5 không mất
  const [messages, setMessages] = useState(() => loadChatMessages([{ id: 1, role: 'bot', text: WELCOME_TEXT }]))
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const [usedAI, setUsedAI] = useState(null)
  const bottomRef = useRef(null)
  // Việc vừa được nhắc/tạo trong chat — dùng cho câu lệnh kiểu "hoàn thành việc đó"
  // Khôi phục "việc vừa nhắc" từ lịch sử đã lưu để câu "hoàn thành việc đó"
  // vẫn hiểu đúng sau khi tải lại trang
  const lastMentionedRef = useRef(lastMentionedFrom(messages))

  useEffect(() => {
    getCategories().then((res) => {
      if (res.success) setCategories(res.data || [])
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, busy])

  // Lưu hội thoại mỗi khi có tin nhắn mới (khoá theo tài khoản)
  useEffect(() => {
    saveChatMessages(messages)
  }, [messages])

  const pushMsg = (msg) => setMessages((ms) => [...ms, { id: Date.now() + Math.random(), ...msg }])

  const clearChat = () => {
    clearChatMessages()
    lastMentionedRef.current = null
    setMessages([{ id: Date.now(), role: 'bot', text: WELCOME_TEXT }])
    toast.success('Đã xoá hội thoại')
  }

  const parseText = async (text) => {
    // 1. Thử AI riêng (backend, PRO) 2. Fallback parser cục bộ
    try {
      const aiTasks = await fetchAIParseTasks(text)
      if (aiTasks?.length) {
        setUsedAI(true)
        return aiTasks
      }
    } catch {
      /* backend chưa cấu hình / hết quota / không phải PRO -> dùng local */
    }
    const local = parseNaturalLanguageTasks(text, categories)
    if (local.success) {
      setUsedAI(false)
      return local.tasks
    }
    return []
  }

  // Câu follow-up ngắn ("ngày mai 8h", "nhắc trước 30p", "ưu tiên cao") -> vá vào task đang thiếu
  const applyFollowUp = async (text, pending) => {
    const patch = await parseText(text)
    if (!patch.length) return null
    const src = patch[0]
    let changed = false
    const next = pending.map((t) => {
      const n = { ...t }
      if (!n.dueAtLocal && src.dueAt) {
        n.dueAtLocal = toLocalInputValue(src.dueAt)
        changed = true
      }
      if (src.priority && src.priority !== 'MEDIUM' && n.priority === 'MEDIUM') {
        n.priority = src.priority
        changed = true
      }
      if (src.repeatType && src.repeatType !== 'NONE' && n.repeatType === 'NONE') {
        n.repeatType = src.repeatType
        n.repeatDays = src.repeatDays || []
        changed = true
      }
      if (src.reminders?.length && !n.reminderOffsets.length) {
        const due = new Date(n.dueAtLocal || src.dueAt).getTime()
        n.reminderOffsets = src.reminders
          .map((r) => Math.round((new Date(r.remindAt).getTime() - due) / 60000))
          .filter((x) => Number.isFinite(x) && x <= 0)
          .slice(0, 5)
        changed = true
      }
      return n
    })
    return changed ? next : null
  }

  const lastPending = () => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'bot' && messages[i].tasks?.length && !messages[i].done) return messages[i]
    }
    return null
  }

  // --- Câu lệnh: "xóa việc …", "đánh dấu hoàn thành …" --------------------
  const runCommand = async (cmd, rawText) => {
    const shown = cmd.rawTarget || rawText
    if (cmd.deictic && !lastMentionedRef.current) {
      pushMsg({ role: 'bot', text: 'Tôi chưa biết bạn đang nói tới việc nào. Bạn gõ tên việc giúp tôi, ví dụ “xóa việc Đi siêu thị”.' })
      return
    }
    setBusy(true)
    const res = await getTasks({ pageSize: 200 })
    setBusy(false)
    if (!res.success) {
      pushMsg({ role: 'bot', text: `Tôi chưa đọc được danh sách công việc (${res.message || 'lỗi mạng'}). Bạn thử lại giúp tôi nhé.` })
      return
    }
    const tasks = res.data?.items || []
    const { candidates, confident } = findTaskMatches(cmd.target, tasks, {
      openOnly: cmd.intent === TASK_COMMAND.COMPLETE,
      lastTask: lastMentionedRef.current,
    })
    if (!candidates.length) {
      pushMsg({ role: 'bot', text: noMatchMessage(cmd.intent, shown) })
      return
    }
    const verb = cmd.intent === TASK_COMMAND.DELETE ? 'xóa' : 'đánh dấu hoàn thành'
    const text = confident
      ? cmd.intent === TASK_COMMAND.DELETE
        ? 'Bạn chắc muốn xóa việc này chứ? Xóa rồi không khôi phục được.'
        : 'Tôi hiểu là bạn muốn đánh dấu hoàn thành việc này. Bấm xác nhận nhé.'
      : `Có ${candidates.length} việc khớp với “${shown}”. Bạn muốn ${verb} việc nào?`
    pushMsg({
      role: 'bot',
      text,
      command: {
        intent: cmd.intent,
        candidates: confident ? [candidates[0]] : candidates,
        resolved: false,
      },
    })
  }

  const executeCommand = async (msgId, task) => {
    const msg = messages.find((m) => m.id === msgId)
    const intent = msg?.command?.intent
    if (!intent) return
    setBusy(true)
    const res = intent === TASK_COMMAND.DELETE ? await deleteTask(task.id) : await completeTask(task.id)
    setBusy(false)
    if (!res.success) {
      toast.error(res.message || 'Không thực hiện được')
      pushMsg({ role: 'bot', text: `Không ${intent === TASK_COMMAND.DELETE ? 'xóa' : 'hoàn thành'} được “${task.title}”: ${res.message || 'lỗi không rõ'}.` })
      return
    }
    setMessages((ms) => ms.map((m) => (m.id === msgId ? { ...m, command: { ...m.command, resolved: true } } : m)))
    lastMentionedRef.current = task
    toast.success(doneMessage(intent, task))
    pushMsg({ role: 'bot', text: `${doneMessage(intent, task)} Bạn cần tôi làm gì nữa không?` })
    onTasksCreated?.()
  }

  const cancelCommand = (msgId) => {
    setMessages((ms) => ms.map((m) => (m.id === msgId ? { ...m, command: { ...m.command, resolved: true } } : m)))
    pushMsg({ role: 'bot', text: 'Đã bỏ qua. Bạn muốn tôi làm gì khác không?' })
  }

  const handleSend = async (rawText) => {
    const text = (rawText ?? input).trim()
    if (!text || busy || creating) return
    setInput('')
    pushMsg({ role: 'user', text })

    // Câu LỆNH ("xóa việc …", "đánh dấu hoàn thành …") thì thực hiện luôn,
    // không tạo công việc mới.
    const command = detectTaskCommand(text)
    if (command) {
      await runCommand(command, text)
      return
    }

    const confirmWords = /^(tạo hết|tạo đi|ok|đồng ý|tạo|yes|tao het|tao di)$/i
    const pendingMsg = lastPending()
    if (pendingMsg && (confirmWords.test(text) || /tạo hết đi/i.test(text))) {
      await handleCreate(pendingMsg.id)
      return
    }
    // Follow-up vá field thiếu
    if (pendingMsg) {
      setBusy(true)
      const patched = await applyFollowUp(text, pendingMsg.tasks)
      setBusy(false)
      if (patched) {
        setMessages((ms) => ms.map((m) => (m.id === pendingMsg.id ? { ...m, tasks: patched } : m)))
        const stillMiss = patched.filter((t) => missingFields(t).length)
        pushMsg({
          role: 'bot',
          text: stillMiss.length
            ? `Đã cập nhật! Còn ${stillMiss.length} việc thiếu ${[...new Set(stillMiss.flatMap(missingFields))].join(', ')}. Bạn bổ sung tiếp hay bấm Tạo?`
            : `Xong! ${patched.length} việc đã đủ tiêu đề + thời hạn. Bấm “Tạo ${patched.length} công việc” nhé.`,
          tasks: undefined,
        })
        return
      }
    }

    setBusy(true)
    const tasks = await parseText(text)
    setBusy(false)
    if (!tasks.length) {
      pushMsg({
        role: 'bot',
        text: 'Tôi chưa tách được công việc nào. Thử theo mẫu: “Ôn Toán ngày mai 19h, nhắc trước 30 phút” hoặc “Sáng 7h tập gym. Chiều 2h họp team”.',
      })
      return
    }
    const editable = tasks.map((t) => aiTaskToEditable(t, categories)).slice(0, 20)
    const missCount = editable.filter((t) => missingFields(t).length).length
    pushMsg({
      role: 'bot',
      text:
        missCount === 0
          ? `Tôi tách được ${editable.length} công việc đủ thông tin. Sửa trực tiếp trên thẻ bên dưới rồi bấm Tạo nhé.`
          : `Tôi tách được ${editable.length} công việc, ${missCount} việc còn thiếu thời hạn/tiêu đề. Bạn nhắn bổ sung (vd “ngày mai 8h”) hoặc sửa tay trên thẻ.`,
      tasks: editable,
    })
  }

  const updateTask = (msgId, idx, patch) => {
    setMessages((ms) => ms.map((m) => (m.id === msgId ? { ...m, tasks: m.tasks.map((t, i) => (i === idx ? { ...t, ...patch } : t)) } : m)))
  }

  const toggleReminder = (msgId, idx, offset) => {
    setMessages((ms) =>
      ms.map((m) => {
        if (m.id !== msgId) return m
        const tasks = m.tasks.map((t, i) => {
          if (i !== idx) return t
          const has = t.reminderOffsets.includes(offset)
          const next = has ? t.reminderOffsets.filter((x) => x !== offset) : [...t.reminderOffsets, offset].slice(0, 5)
          return { ...t, reminderOffsets: next }
        })
        return { ...m, tasks }
      })
    )
  }

  const suggestSubs = (msgId, idx, title) => {
    const subs = suggestTaskBreakdown(title || '').map((s) => ({ content: s.content }))
    if (!subs.length) {
      toast.error('Chưa gợi ý được việc con cho tiêu đề này')
      return
    }
    setMessages((ms) =>
      ms.map((m) => (m.id === msgId ? { ...m, tasks: m.tasks.map((t, i) => (i === idx ? { ...t, subtasks: subs } : t)) } : m))
    )
  }

  const removeTask = (msgId, idx) => {
    setMessages((ms) =>
      ms.map((m) => (m.id === msgId ? { ...m, tasks: m.tasks.filter((_, i) => i !== idx) } : m)).filter((m) => m.role !== 'bot' || !m.tasks || m.tasks.length > 0)
    )
  }

  const handleCreate = async (msgId) => {
    const msg = messages.find((m) => m.id === msgId)
    const tasks = msg?.tasks || []
    if (!tasks.length) return
    const invalid = tasks.findIndex((t) => !t.title.trim() || !t.dueAtLocal)
    if (invalid >= 0) {
      toast.error(`Việc ${invalid + 1} còn thiếu ${missingFields(tasks[invalid]).join(' + ')}`)
      return
    }
    setCreating(true)
    let created = 0
    let firstErr = ''
    for (const t of tasks) {
      const dueDate = new Date(t.dueAtLocal)
      if (dueDate <= new Date()) {
        if (!firstErr) firstErr = `“${t.title}” có thời hạn trong quá khứ`
        continue
      }
      const reminders = t.reminderOffsets.map((off) => ({
        remindAt: new Date(dueDate.getTime() + off * 60000).toISOString(),
      }))
      const res = await createTask({
        title: t.title.trim(),
        description: t.description?.trim() || '',
        categoryId: t.categoryId || undefined,
        priority: t.priority,
        dueAt: dueDate.toISOString(),
        repeatType: t.repeatType,
        repeatDays: t.repeatType === 'WEEKLY' ? t.repeatDays : [],
        reminders,
        subtasks: (t.subtasks || []).filter((s) => s.content?.trim()),
      })
      if (res.success) {
        created += 1
        if (res.data?.id) lastMentionedRef.current = { id: res.data.id, title: t.title }
      }
      else if (!firstErr) firstErr = res.message
    }
    setCreating(false)
    setMessages((ms) => ms.map((m) => (m.id === msgId ? { ...m, done: true } : m)))
    if (!created) {
      toast.error(firstErr || 'Tạo thất bại')
      pushMsg({ role: 'bot', text: `Tạo thất bại: ${firstErr || 'lỗi không rõ'}. Bạn sửa lại thời hạn rồi thử lại nhé.` })
      return
    }
    toast.success(created > 1 ? `Đã tạo ${created} công việc!` : 'Đã tạo công việc!')
    pushMsg({ role: 'bot', text: `Xong! Đã tạo ${created}/${tasks.length} công việc${firstErr ? `. Lỗi: ${firstErr}` : '.'} Bạn muốn tạo tiếp thì cứ gõ nhé.` })
    onTasksCreated?.()
  }

  return (
    <section className="card overflow-hidden dark:bg-slate-800">
      <div className="flex items-center justify-between border-b border-navy-100 bg-gradient-to-r from-violet-50 to-fuchsia-50 px-5 py-4 dark:border-slate-700 dark:from-violet-900/20 dark:to-fuchsia-900/20">
        <h2 className="flex items-center gap-2 font-bold text-navy-900 dark:text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-gradient text-white">
            <Brain size={18} weight="fill" />
          </span>
          Trợ lý AI – tạo việc & ra lệnh
        </h2>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            {usedAI === null ? 'AI + Local' : usedAI ? 'AI riêng' : 'Local AI'}
          </span>
          {messages.length > 1 && (
            <button
              type="button"
              onClick={clearChat}
              title="Xoá hội thoại"
              aria-label="Xoá hội thoại"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-navy-400 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/20"
            >
              <Trash size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="max-h-[480px] space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-brand-gradient text-white shadow-glow-blue'
                  : 'bg-navy-50 text-navy-800 ring-1 ring-inset ring-navy-100 dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600'
              }`}
            >
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.command && (
                <div className="mt-2.5 space-y-1.5">
                  {m.command.candidates.map(({ task }) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-navy-100 dark:bg-slate-800 dark:ring-slate-600"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-navy-900 dark:text-white">{task.title}</p>
                        <p className="text-[11px] text-navy-400">
                          {task.dueAt
                            ? new Date(task.dueAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                            : 'Không có thời hạn'}
                          {task.status === 'COMPLETED' ? ' · đã xong' : ''}
                        </p>
                      </div>
                      {m.command.resolved ? (
                        <span className="shrink-0 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Đã xong</span>
                      ) : m.command.expired ? (
                        <span className="shrink-0 text-[11px] font-bold text-amber-600 dark:text-amber-400">Hết hiệu lực</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => executeCommand(m.id, task)}
                          className={`shrink-0 cursor-pointer rounded-lg px-3 py-1.5 text-[11px] font-bold text-white transition ${
                            m.command.intent === TASK_COMMAND.DELETE ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-500 hover:bg-emerald-600'
                          }`}
                        >
                          {m.command.intent === TASK_COMMAND.DELETE ? 'Xóa' : 'Hoàn thành'}
                        </button>
                      )}
                    </div>
                  ))}
                  {!m.command.resolved && !m.command.expired && (
                    <button
                      type="button"
                      onClick={() => cancelCommand(m.id)}
                      className="cursor-pointer rounded-lg bg-navy-50 px-3 py-1.5 text-[11px] font-bold text-navy-500 hover:bg-navy-100 dark:bg-slate-700 dark:text-slate-300"
                    >
                      Bỏ qua
                    </button>
                  )}
                  {m.command.expired && (
                    <p className="text-[11px] leading-relaxed text-amber-600 dark:text-amber-400">
                      Thẻ xác nhận hết hiệu lực sau khi tải lại trang — gõ lại lệnh nếu bạn vẫn muốn làm.
                    </p>
                  )}
                </div>
              )}
              {m.tasks?.length > 0 && (
                <div className="mt-3 space-y-2.5">
                  {m.tasks.map((t, i) => (
                    <div key={i} className="rounded-xl bg-white p-3 text-left ring-1 ring-navy-100 dark:bg-slate-800 dark:ring-slate-600">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-violet-600 dark:text-violet-300">Việc {i + 1}{m.done ? ' · đã tạo' : ''}</span>
                        {!m.done && (
                          <button type="button" onClick={() => removeTask(m.id, i)} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-navy-400 hover:bg-rose-50 hover:text-rose-500" aria-label="Xóa việc">
                            <Trash size={14} />
                          </button>
                        )}
                      </div>
                      <input
                        value={t.title}
                        disabled={m.done}
                        onChange={(e) => updateTask(m.id, i, { title: e.target.value })}
                        placeholder="Tiêu đề công việc *"
                        className="mt-1.5 h-10 w-full rounded-lg border-0 bg-navy-50 px-3 text-sm font-bold text-navy-900 ring-1 ring-inset ring-navy-100 focus:ring-2 focus:ring-violet-500 focus:outline-none dark:bg-slate-700 dark:text-white dark:ring-slate-600"
                      />
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <select
                          value={t.categoryId}
                          disabled={m.done}
                          onChange={(e) => updateTask(m.id, i, { categoryId: e.target.value })}
                          className="h-10 rounded-lg border-0 bg-navy-50 px-2 text-xs font-semibold text-navy-800 ring-1 ring-inset ring-navy-100 dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600"
                        >
                          <option value="">Không phân loại</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <input
                          type="datetime-local"
                          value={t.dueAtLocal}
                          disabled={m.done}
                          onChange={(e) => updateTask(m.id, i, { dueAtLocal: e.target.value })}
                          className="h-10 rounded-lg border-0 bg-navy-50 px-2 text-xs font-semibold text-navy-800 ring-1 ring-inset ring-navy-100 dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600"
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((p) => (
                          <button
                            key={p}
                            type="button"
                            disabled={m.done}
                            onClick={() => updateTask(m.id, i, { priority: p })}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset transition ${
                              t.priority === p
                                ? 'bg-violet-600 text-white ring-violet-600'
                                : 'bg-navy-50 text-navy-500 ring-navy-100 hover:bg-violet-50 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600'
                            }`}
                          >
                            {PRIORITY[p]?.label || p}
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <select
                          value={t.repeatType}
                          disabled={m.done}
                          onChange={(e) => updateTask(m.id, i, { repeatType: e.target.value })}
                          className="h-9 rounded-lg border-0 bg-navy-50 px-2 text-[11px] font-bold text-navy-700 ring-1 ring-inset ring-navy-100 dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600"
                        >
                          {REPEAT_TYPE_LIST.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                        {REMINDER_CHOICES.map((r) => (
                          <button
                            key={r.offset}
                            type="button"
                            disabled={m.done}
                            onClick={() => toggleReminder(m.id, i, r.offset)}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset transition ${
                              t.reminderOffsets.includes(r.offset)
                                ? 'bg-amber-500 text-white ring-amber-500'
                                : 'bg-navy-50 text-navy-500 ring-navy-100 hover:bg-amber-50 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600'
                            }`}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                      {(t.subtasks?.length > 0) && (
                        <ul className="mt-2 space-y-1">
                          {t.subtasks.map((s, si) => (
                            <li key={si} className="flex items-center gap-1.5 text-xs text-navy-600 dark:text-slate-300">
                              <CheckCircle size={13} className="text-emerald-500" /> {s.content}
                            </li>
                          ))}
                        </ul>
                      )}
                      {!m.done && (
                        <button
                          type="button"
                          onClick={() => suggestSubs(m.id, i, t.title)}
                          className="mt-2 inline-flex cursor-pointer items-center gap-1 rounded-lg bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-700 hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300"
                        >
                          <Sparkle size={12} weight="fill" /> Gợi ý việc con
                        </button>
                      )}
                    </div>
                  ))}
                  {!m.done && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleCreate(m.id)}
                        disabled={creating}
                        className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-brand-gradient py-2.5 text-sm font-bold text-white shadow-glow-blue transition hover:scale-[1.01] disabled:opacity-50"
                      >
                        {creating ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Plus size={15} weight="bold" />}
                        Tạo {m.tasks.length} công việc
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl bg-navy-50 px-3.5 py-2.5 text-sm font-semibold text-violet-600 ring-1 ring-inset ring-navy-100 dark:bg-slate-700 dark:text-violet-300 dark:ring-slate-600">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-400/30 border-t-violet-500" /> AI đang phân tích…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-navy-100 px-4 py-3 dark:border-slate-700">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {QUICK_REPLIES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => handleSend(q)}
              className="cursor-pointer rounded-full bg-navy-50 px-2.5 py-1 text-[11px] font-semibold text-navy-600 ring-1 ring-inset ring-navy-100 transition hover:bg-violet-50 hover:text-violet-700 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600"
            >
              {q.length > 42 ? q.slice(0, 42) + '…' : q}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Nhập nhiều việc một lúc, vd: Sáng 7h tập gym. Chiều 2h họp team…"
            className="h-11 flex-1 rounded-xl border-0 bg-navy-50 px-3.5 text-sm font-medium text-navy-900 ring-1 ring-inset ring-navy-100 placeholder:text-navy-300 focus:ring-2 focus:ring-violet-500 focus:outline-none dark:bg-slate-700 dark:text-white dark:ring-slate-600"
          />
          <button
            type="submit"
            disabled={!input.trim() || busy || creating}
            aria-label="Gửi cho AI"
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow-blue transition hover:scale-105 disabled:opacity-50"
          >
            <PaperPlaneTilt size={18} weight="fill" />
          </button>
        </form>
      </div>
    </section>
  )
}
