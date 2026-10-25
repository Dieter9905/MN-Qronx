import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Headset,
  MagnifyingGlass,
  ArrowLeft,
  CheckCircle,
  ClockCountdown,
  EnvelopeSimple,
  Crown,
  ArrowClockwise,
} from '@phosphor-icons/react'
import SupportChatPanel from '../../components/SupportChatPanel'
import { Skeleton } from '../../components/common/Feedback'
import { useToast } from '../../components/common/Toast'
import { PLAN_NAMES } from '../../lib/constants'
import {
  getAdminConversations,
  getAdminConversation,
  replyAsAdmin,
  markAdminConversationRead,
  setAdminConversationStatus,
} from '../../services/supportService'

/**
 * Hộp thư hỗ trợ của admin: danh sách hội thoại (ưu tiên việc chưa trả lời) bên
 * trái, khung chat trả lời bên phải. Danh sách làm mới mỗi 15 giây, hội thoại
 * đang mở làm mới mỗi 4 giây để gần như tức thì mà không cần websocket.
 */
const LIST_POLL_MS = 15000
const THREAD_POLL_MS = 4000
const PAGE_SIZE = 12

const FILTERS = [
  { key: 'unread', label: 'Chưa trả lời', unread: 'true' },
  { key: 'all', label: 'Tất cả', unread: undefined },
  { key: 'resolved', label: 'Đã xong', status: 'RESOLVED' },
]

function timeAgo(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'vừa xong'
  if (mins < 60) return `${mins} phút trước`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} giờ trước`
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

export default function AdminSupportPage() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [filter, setFilter] = useState('unread')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [loadingList, setLoadingList] = useState(true)

  const [selectedId, setSelectedId] = useState(null)
  const [thread, setThread] = useState(null)
  const [loadingThread, setLoadingThread] = useState(false)
  const [sending, setSending] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const lastIdRef = useRef(0)

  const activeFilter = useMemo(() => FILTERS.find((f) => f.key === filter) || FILTERS[0], [filter])

  const loadList = useCallback(async () => {
    setLoadingList(true)
    const res = await getAdminConversations({
      keyword: keyword || undefined,
      unread: activeFilter.unread,
      status: activeFilter.status,
      page,
      pageSize: PAGE_SIZE,
    })
    setLoadingList(false)
    if (!res.success) {
      toast.error(res.message || 'Không tải được danh sách hội thoại')
      return
    }
    setItems(res.data.items || [])
    setPagination(res.data.pagination || { page: 1, totalPages: 1, total: 0 })
  }, [keyword, activeFilter, page, toast])

  useEffect(() => {
    loadList()
  }, [loadList])

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') loadList()
    }, LIST_POLL_MS)
    return () => clearInterval(id)
  }, [loadList])

  const openConversation = useCallback(async (conversationId) => {
    setSelectedId(conversationId)
    setLoadingThread(true)
    const res = await getAdminConversation(conversationId)
    setLoadingThread(false)
    if (!res.success) {
      toast.error(res.message || 'Không tải được hội thoại')
      setThread(null)
      return
    }
    setThread(res.data)
    lastIdRef.current = (res.data.messages || []).reduce((max, m) => Math.max(max, m.id), 0)
    // Mở ra là coi như admin đã đọc → huy hiệu chưa đọc giảm
    if (res.data.unread > 0) {
      await markAdminConversationRead(conversationId)
      setThread((t) => (t ? { ...t, unread: 0 } : t))
      setItems((prev) => prev.map((c) => (c.id === conversationId ? { ...c, unread: 0 } : c)))
    }
  }, [toast])

  // Làm mới nhanh hội thoại đang mở
  useEffect(() => {
    if (!selectedId) return
    const id = setInterval(async () => {
      if (document.visibilityState !== 'visible') return
      const res = await getNewSupportMessagesOfThread(selectedId, lastIdRef.current)
      if (!res) return
      const incoming = res.messages || []
      if (!incoming.length) return
      setThread((t) => {
        if (!t) return t
        const seen = new Set(t.messages.map((m) => m.id))
        const merged = [...t.messages]
        for (const m of incoming) if (!seen.has(m.id)) merged.push(m)
        merged.sort((a, b) => a.id - b.id)
        return { ...t, messages: merged }
      })
      lastIdRef.current = Math.max(lastIdRef.current, ...incoming.map((m) => m.id))
      if (incoming.some((m) => m.senderRole === 'USER')) {
        await markAdminConversationRead(selectedId)
      }
    }, THREAD_POLL_MS)
    return () => clearInterval(id)
  }, [selectedId])

  // Tin mới của hội thoại admin xem: dùng đúng API admin (khác endpoint của user)
  const getNewSupportMessagesOfThread = async (conversationId, since) => {
    const res = await getAdminConversation(conversationId)
    if (!res.success) return null
    const list = res.data.messages || []
    return { messages: list.filter((m) => m.id > since) }
  }

  const handleReply = async ({ body, attachments }) => {
    if (!selectedId) return false
    setSending(true)
    const res = await replyAsAdmin(selectedId, { body, attachments })
    setSending(false)
    if (!res.success) {
      toast.error(res.message || 'Không gửi được phản hồi')
      return false
    }
    const message = res.data
    setThread((t) => (t ? { ...t, messages: [...t.messages, message], status: 'OPEN' } : t))
    lastIdRef.current = Math.max(lastIdRef.current, message.id)
    toast.success('Đã gửi phản hồi')
    loadList()
    return true
  }

  const toggleStatus = async () => {
    if (!selectedId || !thread) return
    const next = thread.status === 'RESOLVED' ? 'OPEN' : 'RESOLVED'
    setUpdatingStatus(true)
    const res = await setAdminConversationStatus(selectedId, next)
    setUpdatingStatus(false)
    if (!res.success) {
      toast.error(res.message || 'Không đổi được trạng thái')
      return
    }
    setThread((t) => (t ? { ...t, status: next } : t))
    toast.success(next === 'RESOLVED' ? 'Đã đánh dấu xong' : 'Đã mở lại hội thoại')
    loadList()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-navy-900 dark:text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-gradient text-white">
              <Headset size={21} weight="fill" />
            </span>
            Hộp thư hỗ trợ
          </h1>
          <p className="mt-1 text-sm font-medium text-navy-400 dark:text-slate-500">
            {pagination.total} hội thoại · ưu tiên hiển thị trước những hội thoại chưa được trả lời
          </p>
        </div>
        <button
          type="button"
          onClick={loadList}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-bold text-navy-700 ring-1 ring-navy-200 transition hover:bg-navy-50 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600"
        >
          <ArrowClockwise size={15} /> Làm mới
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,340px)_1fr]">
        {/* ── Danh sách hội thoại ── */}
        <div className={`${selectedId ? 'hidden lg:flex' : 'flex'} flex-col gap-3`}>
          <div className="card space-y-3 p-3">
            <div className="relative">
              <MagnifyingGlass size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-navy-400" />
              <input
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value)
                  setPage(1)
                }}
                placeholder="Tìm theo tên, email hoặc nội dung…"
                className="h-10 w-full rounded-xl border-0 bg-navy-50 pl-9 pr-3 text-sm text-navy-900 ring-1 ring-inset ring-navy-100 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white dark:ring-slate-600"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => {
                    setFilter(f.key)
                    setPage(1)
                  }}
                  className={`cursor-pointer rounded-full px-3 py-1 text-[11px] font-bold ring-1 ring-inset transition ${
                    filter === f.key
                      ? 'bg-navy-900 text-white ring-navy-900 dark:bg-white dark:text-navy-900 dark:ring-white'
                      : 'bg-white text-navy-500 ring-navy-200 hover:bg-navy-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {loadingList && items.length === 0 ? (
              <>
                <Skeleton className="h-20 rounded-2xl" />
                <Skeleton className="h-20 rounded-2xl" />
                <Skeleton className="h-20 rounded-2xl" />
              </>
            ) : items.length === 0 ? (
              <div className="card p-6 text-center">
                <Headset size={26} className="mx-auto text-navy-300" />
                <p className="mt-2 text-sm font-bold text-navy-700 dark:text-slate-200">
                  {filter === 'unread' ? 'Không còn hội thoại nào chờ trả lời' : 'Không có hội thoại nào'}
                </p>
              </div>
            ) : (
              items.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openConversation(c.id)}
                  className={`card w-full cursor-pointer p-3 text-left transition hover:shadow-md ${
                    selectedId === c.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-bold text-navy-900 dark:text-white">
                      {c.customer?.fullName || 'Người dùng'}
                    </span>
                    <span className="shrink-0 text-[11px] text-navy-400">{timeAgo(c.lastMessageAt)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-navy-400">{c.customer?.email}</p>
                  <p className="mt-1.5 line-clamp-2 text-xs text-navy-600 dark:text-slate-300">
                    {c.lastMessagePreview || '(chưa có tin nhắn)'}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    {c.unread > 0 && (
                      <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-extrabold text-white">
                        {c.unread} tin mới
                      </span>
                    )}
                    {c.status === 'RESOLVED' && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        Đã xong
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}

            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold text-navy-600 ring-1 ring-navy-200 disabled:opacity-40 dark:text-slate-300 dark:ring-slate-600"
                >
                  Trước
                </button>
                <span className="text-xs text-navy-400">
                  Trang {pagination.page}/{pagination.totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold text-navy-600 ring-1 ring-navy-200 disabled:opacity-40 dark:text-slate-300 dark:ring-slate-600"
                >
                  Sau
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Khung trả lời ── */}
        <div className={`${selectedId ? 'flex' : 'hidden lg:flex'} min-w-0 flex-col gap-3`}>
          {!selectedId ? (
            <div className="card flex h-full min-h-[360px] flex-col items-center justify-center p-8 text-center">
              <Headset size={30} className="text-navy-300" />
              <p className="mt-3 font-bold text-navy-700 dark:text-slate-200">Chọn một hội thoại để trả lời</p>
              <p className="mt-1 text-sm text-navy-400">
                Hội thoại chưa trả lời được xếp lên đầu danh sách.
              </p>
            </div>
          ) : (
            <>
              <div className="card flex flex-wrap items-center justify-between gap-3 p-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(null)
                      setThread(null)
                    }}
                    aria-label="Quay lại danh sách"
                    className="cursor-pointer rounded-xl bg-navy-50 p-2 text-navy-500 lg:hidden dark:bg-slate-700 dark:text-slate-200"
                  >
                    <ArrowLeft size={16} weight="bold" />
                  </button>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-navy-900 dark:text-white">
                      {thread?.customer?.fullName || 'Người dùng'}
                    </p>
                    <p className="flex items-center gap-1.5 truncate text-xs text-navy-400">
                      <EnvelopeSimple size={12} /> {thread?.customer?.email}
                      {thread?.customer?.plan && thread.customer.plan !== 'FREE' && (
                        <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          <Crown size={10} weight="fill" /> {PLAN_NAMES[thread.customer.plan] || thread.customer.plan}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleStatus}
                  disabled={updatingStatus}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ring-1 ring-inset transition disabled:opacity-50 bg-white text-navy-700 ring-navy-200 hover:bg-navy-50 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600"
                >
                  {thread?.status === 'RESOLVED' ? (
                    <>
                      <ClockCountdown size={14} weight="fill" /> Mở lại hội thoại
                    </>
                  ) : (
                    <>
                      <CheckCircle size={14} weight="fill" /> Đánh dấu đã xong
                    </>
                  )}
                </button>
              </div>

              {loadingThread && !thread ? (
                <Skeleton className="h-[58vh] min-h-[360px] rounded-2xl" />
              ) : (
                <SupportChatPanel
                  messages={thread?.messages || []}
                  onSend={handleReply}
                  sending={sending}
                  emptyTitle="Chưa có tin nhắn trong hội thoại này"
                  emptyHint="Chào hỏi và hỏi thêm thông tin để hỗ trợ người dùng nhanh hơn."
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
