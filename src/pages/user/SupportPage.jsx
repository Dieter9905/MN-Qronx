import { useCallback, useEffect, useRef, useState } from 'react'
import { Headset, ClockCountdown, CheckCircle, WarningCircle } from '@phosphor-icons/react'
import SupportChatPanel from '../../components/SupportChatPanel'
import { RoomCard, RoomSkeleton } from '../../components/common/RoomUI'
import { useToast } from '../../components/common/Toast'
import {
  getMyConversation,
  getNewSupportMessages,
  sendSupportMessage,
  markSupportRead,
} from '../../services/supportService'

/**
 * Hỗ trợ trực tiếp: người dùng nhắn cho admin và thấy phản hồi ngay trong app.
 *
 * Backend Render gói free không có websocket, nên "trực tiếp" ở đây là vòng làm
 * mới 4 giây MỘT CHIỀU (chỉ hỏi những tin mới hơn id cuối cùng), và chỉ chạy khi
 * tab đang mở — vừa nhanh vừa không đốt request khi người dùng đi chỗ khác.
 */
const POLL_MS = 4000

export default function SupportPage() {
  const toast = useToast()
  const [messages, setMessages] = useState([])
  const [status, setStatus] = useState('OPEN')
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const lastIdRef = useRef(0)

  const mergeMessages = useCallback((incoming) => {
    if (!incoming?.length) return
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id))
      const merged = [...prev]
      for (const m of incoming) if (!seen.has(m.id)) merged.push(m)
      merged.sort((a, b) => a.id - b.id)
      return merged
    })
    lastIdRef.current = Math.max(lastIdRef.current, ...incoming.map((m) => m.id))
  }, [])

  const loadInitial = useCallback(async () => {
    setLoading(true)
    const res = await getMyConversation()
    setLoading(false)
    if (!res.success) {
      setError(res.message || 'Không tải được hội thoại hỗ trợ')
      return
    }
    setError('')
    const list = res.data.messages || []
    setMessages(list)
    setStatus(res.data.status || 'OPEN')
    lastIdRef.current = list.reduce((max, m) => Math.max(max, m.id), 0)
    // Mở trang này nghĩa là người dùng đã đọc tin của admin
    if (res.data.unread > 0) {
      setUnread(0)
      markSupportRead()
    }
  }, [])

  useEffect(() => {
    loadInitial()
  }, [loadInitial])

  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== 'visible') return
      const res = await getNewSupportMessages(lastIdRef.current)
      if (!res.success) return
      const incoming = res.data.messages || []
      if (incoming.length) {
        mergeMessages(incoming)
        if (incoming.some((m) => m.senderRole === 'ADMIN')) {
          setUnread(0)
          markSupportRead()
        }
      }
      if (typeof res.data.unread === 'number') setUnread(res.data.unread)
      if (res.data.status) setStatus(res.data.status)
    }
    const id = setInterval(tick, POLL_MS)
    return () => clearInterval(id)
  }, [mergeMessages])

  const handleSend = async ({ body, attachments }) => {
    setSending(true)
    const res = await sendSupportMessage({ body, attachments })
    setSending(false)
    if (!res.success) {
      toast.error(res.message || 'Không gửi được tin nhắn')
      return false
    }
    mergeMessages([res.data])
    setStatus('OPEN')
    return true
  }

  const resolved = status === 'RESOLVED'

  return (
    <div className="mx-auto max-w-3xl space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-2xl font-bold text-room-ink">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-room-oat/45 text-room-acorn ring-1 ring-inset ring-room-acorn/25">
              <Headset size={21} weight="duotone" />
            </span>
            Hỗ trợ trực tiếp
          </h1>
          <p className="mt-1 text-sm font-semibold text-room-ink/50">
            Nhắn cho đội ngũ MN-Qronx. Phản hồi sẽ hiện ngay tại đây, bạn không cần kiểm tra email.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider ring-1 ring-inset ${
            resolved
              ? 'bg-room-sage/45 text-room-ink/75 ring-room-acorn/20'
              : 'bg-room-bell/25 text-room-ink/80 ring-room-bell/40'
          }`}
        >
          {resolved ? <CheckCircle size={12} weight="fill" /> : <ClockCountdown size={12} weight="fill" />}
          {resolved ? 'Đã xong' : 'Đang chờ phản hồi'}
        </span>
      </div>

      {unread > 0 && (
        <p className="rounded-xl bg-room-bell/25 px-3 py-2 text-xs font-bold text-room-ink/80 ring-1 ring-inset ring-room-bell/40">
          Bạn có {unread} tin nhắn mới từ hỗ trợ
        </p>
      )}

      {loading ? (
        <RoomSkeleton className="h-[58vh] min-h-[360px]" />
      ) : error ? (
        <RoomCard className="flex flex-col items-center gap-2 p-8 text-center">
          <WarningCircle size={26} className="text-room-rain" />
          <p className="font-display font-bold text-room-ink">{error}</p>
          <p className="text-sm font-semibold text-room-ink/55">
            Kết nối tới máy chủ bị gián đoạn — kiểm tra mạng rồi bấm thử lại nhé.
          </p>
          <button
            type="button"
            onClick={loadInitial}
            className="mt-1 cursor-pointer rounded-full bg-room-acorn px-5 py-2 text-sm font-bold text-room-paper shadow-[0_14px_26px_-12px_rgb(0_0_0/0.30)] transition hover:brightness-[0.96]"
          >
            Thử lại
          </button>
        </RoomCard>
      ) : (
        <SupportChatPanel messages={messages} onSend={handleSend} sending={sending} skin="room" />
      )}

      <p className="text-center text-xs font-semibold text-room-ink/40">
        Hội thoại được lưu lại — bạn có thể đóng trang và quay lại bất cứ lúc nào.
      </p>
    </div>
  )
}
