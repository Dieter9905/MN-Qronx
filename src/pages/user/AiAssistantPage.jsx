import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Brain,
  Crown,
  ListChecks,
  Warning,
  WarningCircle,
  CheckCircle,
  ArrowRight,
  Sparkle,
  CalendarBlank,
} from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/common/Toast'
import Button from '../../components/common/Button'
import { Skeleton } from '../../components/common/Feedback'
import { getTasks, createTask, completeTask } from '../../services/taskService'
import AiTaskChat from '../../components/AiTaskChat'
import {
  prioritizeTasks,
  detectScheduleWarnings,
  generateSmartBreakdown,
} from '../../services/aiService'
import { PRIORITY, isProPlan } from '../../lib/constants'

export default function AiAssistantPage() {
  const { user } = useAuth()
  const isPro = isProPlan(user?.plan)
  const toast = useToast()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [priorityList, setPriorityList] = useState([])
  const [warnings, setWarnings] = useState([])
  const [breakdownTitle, setBreakdownTitle] = useState('')
  const [breakdownDesc, setBreakdownDesc] = useState('')
  const [breakdown, setBreakdown] = useState(null)
  const [creating, setCreating] = useState(false)
  const [completing, setCompleting] = useState(null)

  // `silent` = làm mới nền: KHÔNG bật skeleton, nếu không cả cây (kể cả chat)
  // bị unmount và lịch sử trò chuyện biến mất mỗi lần thực hiện xong một câu lệnh.
  const load = async (opts = {}) => {
    const silent = opts?.silent === true
    if (!silent) setLoading(true)
    const res = await getTasks({ status: '', pageSize: 100, sort: 'dueAsc' })
    if (!silent) setLoading(false)
    if (!res.success) return
    const list = res.data.items
    setTasks(list)
    const scored = prioritizeTasks(list)
    setPriorityList(scored.filter((s) => s.score > 0).slice(0, 7))
    setWarnings(detectScheduleWarnings(list))
  }

  useEffect(() => {
    if (isPro) load()
     
  }, [isPro])

  const analyzeBreakdown = () => {
    if (!breakdownTitle.trim()) return
    const found = tasks.find((t) => t.title.toLowerCase() === breakdownTitle.trim().toLowerCase())
    const dueInDays = found?.dueAt
      ? Math.ceil((new Date(found.dueAt) - new Date()) / 86400000)
      : null
    setBreakdown(generateSmartBreakdown(breakdownTitle, breakdownDesc, dueInDays))
  }

  const createFromBreakdown = async () => {
    setCreating(true)
    const res = await createTask({
      title: breakdownTitle.trim(),
      description: breakdownDesc.trim() || undefined,
      dueAt: undefined,
      subtasks: breakdown.steps,
    })
    setCreating(false)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success('Đã tạo công việc kèm các bước gợi ý!')
    setBreakdown(null)
    setBreakdownTitle('')
    setBreakdownDesc('')
    load()
  }

  const doComplete = async (id) => {
    setCompleting(id)
    const res = await completeTask(id)
    setCompleting(null)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success('Hoàn thành xuất sắc! 🎉')
    load()
  }

  // ─── Chưa phải Pro → upsell ─────────────────────────────
  if (!isPro) {
    const aiFeatures = [
      'Ưu tiên thông minh – AI xếp thứ tự “nên làm gì tiếp theo” kèm lý do',
      'Cảnh báo lịch – phát hiện quá tải & xung đột thời gian',
      'Tách việc con – AI gợi ý các bước thực hiện cho từng công việc',
      'Tạo nhanh bằng ngôn ngữ tự nhiên: “Ôn tập Toán mai 19h, nhắc trước 30 phút”',
    ]
    return (
      <div className="mx-auto max-w-3xl animate-fade-in">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-8 text-white shadow-card">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider backdrop-blur">
            <Brain size={13} weight="fill" /> Trợ lý AI · Gói Pro
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Khoá AI đang chờ bạn</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-violet-100">
            Nâng cấp lên <b>Pro</b> để dùng toàn bộ trợ lý AI của MN-Qronx – tự động ưu tiên,
            cảnh báo lịch và chia nhỏ công việc chỉ trong vài giây.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/app/billing">
              <Button variant="light" icon={Crown}>
                Nâng cấp lên Pro
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {aiFeatures.map((f) => (
            <div key={f} className="card flex items-start gap-3 p-4">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                <Sparkle size={16} weight="fill" />
              </span>
              <p className="text-sm font-medium text-navy-700 dark:text-slate-300">{f}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─── Pro: nội dung trợ lý AI ────────────────────────────
  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-navy-900 dark:text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-gradient text-white">
              <Brain size={21} weight="fill" />
            </span>
            Trợ lý AI
          </h1>
          <p className="mt-1 text-sm font-medium text-navy-400 dark:text-slate-500">
            AI phân tích công việc của bạn và đưa ra gợi ý hành động thông minh
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-glow-purple">
          <Crown size={12} weight="fill" /> Pro
        </span>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <>
          {/* Chatbot tạo việc bằng AI – phân loại đúng cấu trúc form */}
          <AiTaskChat onTasksCreated={() => load({ silent: true })} />

          {priorityList.length === 0 && tasks.length === 0 ? (
        <div className="card p-10 text-center">
          <Brain size={40} className="mx-auto text-navy-300" />
          <p className="mt-3 font-bold text-navy-700">Chưa có công việc nào để AI phân tích</p>
          <p className="mt-1 text-sm text-navy-400">Tạo vài công việc rồi quay lại, AI sẽ giúp bạn sắp xếp.</p>
        </div>
          ) : (
        <>
          {/* Nên làm gì tiếp theo */}
          <section className="card overflow-hidden dark:bg-slate-800">
            <div className="border-b border-navy-100 bg-gradient-to-r from-blue-50 to-cyan-50 px-5 py-4 dark:border-slate-700 dark:from-blue-900/20 dark:to-cyan-900/20">
              <h2 className="flex items-center gap-2 font-bold text-navy-900 dark:text-white">
                <ListChecks size={19} weight="fill" className="text-blue-600 dark:text-blue-400" />
                Nên làm gì tiếp theo?
              </h2>
              <p className="mt-0.5 text-xs text-navy-400 dark:text-slate-500">
                AI xếp hạng theo độ khẩn cấp + mức ưu tiên của bạn
              </p>
            </div>
            <ul className="divide-y divide-navy-50 dark:divide-slate-700">
              {priorityList.map(({ task, reasons, recommendation }, i) => (
                <li key={task.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-100 text-xs font-extrabold text-navy-600 dark:bg-slate-700 dark:text-slate-300">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-navy-900 dark:text-white">{task.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      {reasons.map((r) => (
                        <span
                          key={r}
                          className={`rounded-full px-2 py-px text-[10px] font-bold ring-1 ring-inset ${
                            task.status === 'IN_PROGRESS'
                              ? 'bg-blue-50 text-blue-600 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-700'
                              : r.startsWith('Quá hạn')
                                ? 'bg-rose-50 text-rose-600 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-700'
                                : 'bg-navy-50 text-navy-500 ring-navy-100 dark:bg-slate-700 dark:text-slate-400 dark:ring-slate-600'
                          }`}
                        >
                          {r}
                        </span>
                      ))}
                      <span
                        className={`rounded-full px-2 py-px text-[10px] font-extrabold ring-1 ring-inset ${
                          task.isOverdue || task.overdue
                            ? 'bg-rose-600 text-white ring-rose-600'
                            : 'bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:ring-emerald-800'
                        }`}
                      >
                        {recommendation}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className={`hidden text-[10px] font-bold sm:block ${PRIORITY[task.priority]?.dot || ''}`}>
                      {PRIORITY[task.priority]?.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => doComplete(task.id)}
                      disabled={completing === task.id}
                      title="Đánh dấu hoàn thành"
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
                    >
                      <CheckCircle size={19} weight={completing === task.id ? 'fill' : 'regular'} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Cảnh báo lịch */}
          <section className="card p-5 dark:bg-slate-800">
            <h2 className="flex items-center gap-2 font-bold text-navy-900 dark:text-white">
              <Warning size={19} weight="fill" className="text-amber-500" />
              AI Cảnh báo lịch
            </h2>
            <ul className="mt-3 space-y-2.5">
              {warnings.map((w, i) => (
                <li
                  key={i}
                  className={`flex items-start gap-3 rounded-xl p-3 ring-1 ring-inset ${
                    w.level === 'danger'
                      ? 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:ring-rose-800'
                      : w.level === 'warn'
                        ? 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:ring-amber-800'
                        : 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:ring-emerald-800'
                  }`}
                >
                  <span className="mt-0.5 shrink-0">
                    {w.level === 'danger' ? (
                      <WarningCircle size={18} weight="fill" />
                    ) : w.level === 'warn' ? (
                      <Warning size={18} weight="fill" />
                    ) : (
                      <CheckCircle size={18} weight="fill" />
                    )}
                  </span>
                  <div>
                    <p className="text-sm font-bold">{w.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed opacity-90">{w.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Tách việc con bằng AI */}
          <section className="card p-5 dark:bg-slate-800">
            <h2 className="flex items-center gap-2 font-bold text-navy-900 dark:text-white">
              <Sparkle size={19} weight="fill" className="text-violet-500" />
              AI tách việc con
            </h2>
            <p className="mt-0.5 text-xs text-navy-400 dark:text-slate-500">
              Nhập tên công việc – AI gợi ý các bước thực hiện cụ thể (có thể tạo kèm luôn)
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <input
                value={breakdownTitle}
                onChange={(e) => setBreakdownTitle(e.target.value)}
                placeholder="Ví dụ: Làm bài tập lớn môn Web…"
                className="h-11 w-full rounded-xl border-0 bg-navy-50 px-3.5 text-sm font-semibold text-navy-900 ring-1 ring-inset ring-navy-100 placeholder:text-navy-300 focus:ring-2 focus:ring-violet-500 focus:outline-none dark:bg-slate-700 dark:text-white dark:ring-slate-600"
              />
              <input
                value={breakdownDesc}
                onChange={(e) => setBreakdownDesc(e.target.value)}
                placeholder="Mô tả ngắn (tùy chọn) – giúp AI gợi ý sát hơn…"
                className="h-11 w-full rounded-xl border-0 bg-navy-50 px-3.5 text-sm text-navy-900 ring-1 ring-inset ring-navy-100 placeholder:text-navy-300 focus:ring-2 focus:ring-violet-500 focus:outline-none dark:bg-slate-700 dark:text-white dark:ring-slate-600"
              />
              <div className="flex justify-end">
                <Button variant="gradient" size="sm" icon={Sparkle} onClick={analyzeBreakdown} disabled={!breakdownTitle.trim()}>
                  AI gợi ý các bước
                </Button>
              </div>
            </div>

            {breakdown && (
              <div className="mt-4 rounded-xl bg-violet-50/60 p-4 ring-1 ring-violet-100 dark:bg-violet-900/20 dark:ring-violet-800/50">
                <p className="text-sm font-bold text-violet-700 dark:text-violet-300">
                  ✨ Các bước AI đề xuất cho “{breakdownTitle.trim()}”:
                </p>
                <ul className="mt-2.5 space-y-1.5">
                  {breakdown.steps.map((s, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-navy-700 dark:text-slate-300">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-[10px] font-extrabold text-violet-700 dark:bg-violet-800/50 dark:text-violet-200">
                        {i + 1}
                      </span>
                      {s.content}
                    </li>
                  ))}
                </ul>
                {breakdown.hint && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-violet-500 dark:text-violet-400">
                    <CalendarBlank size={13} weight="bold" /> {breakdown.hint}
                  </p>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setBreakdown(null)}>
                    Bỏ
                  </Button>
                  <Button
                    variant="gradient"
                    size="sm"
                    icon={ArrowRight}
                    loading={creating}
                    onClick={createFromBreakdown}
                  >
                    Tạo công việc kèm các bước
                  </Button>
                </div>
              </div>
            )}
          </section>
        </>
          )}
        </>
      )}
    </div>
  )
}