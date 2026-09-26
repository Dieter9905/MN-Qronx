import { useEffect, useRef, useState } from 'react'
import { PaperPlaneTilt, ImageSquare, X, CircleNotch, Headset } from '@phosphor-icons/react'
import Modal from './common/Modal'
import { useToast } from './common/Toast'
import { compressImageFile, formatBytes } from '../lib/chatImage'
import { getAttachmentBlobUrl } from '../services/supportService'

/**
 * Khung chat hỗ trợ dùng CHUNG cho trang người dùng và trang admin: bong bóng tin
 * nhắn (của mình bên phải), ảnh đính kèm, và ô soạn có nén ảnh trước khi gửi.
 */

const MAX_PENDING = 3

function timeLabel(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const sameDay = new Date().toDateString() === d.toDateString()
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return time
  return `${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} ${time}`
}

/** Ảnh cần token để tải nên phải fetch blob (không dùng <img src> trực tiếp). */
function AttachmentThumb({ attachment, onOpen }) {
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    getAttachmentBlobUrl(attachment.id)
      .then((u) => {
        if (alive) setUrl(u)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [attachment.id])

  if (failed) {
    return <span className="text-[11px] text-rose-500">Không tải được ảnh</span>
  }
  if (!url) {
    return <span className="block h-24 w-32 animate-pulse rounded-lg bg-navy-100 dark:bg-slate-600" />
  }
  return (
    <button type="button" onClick={() => onOpen(url)} className="cursor-pointer overflow-hidden rounded-lg ring-1 ring-black/5">
      <img src={url} alt="Ảnh đính kèm" loading="lazy" className="h-24 w-auto max-w-[200px] object-cover" />
    </button>
  )
}

function Bubble({ m, onOpenImage }) {
  const mine = m.mine
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] sm:max-w-[70%] ${mine ? 'items-end' : 'items-start'}`}>
        {!mine && (
          <p className="mb-1 flex items-center gap-1 text-[11px] font-bold text-navy-500 dark:text-slate-400">
            <Headset size={12} weight="fill" className="text-cyan-500" />
            {m.authorIsAdmin ? 'Hỗ trợ MN-Qronx' : m.authorName || 'Người dùng'}
          </p>
        )}
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
            mine
              ? 'bg-brand-gradient text-white shadow-glow-blue'
              : 'bg-white text-navy-800 ring-1 ring-inset ring-navy-100 dark:bg-slate-700 dark:text-slate-100 dark:ring-slate-600'
          }`}
        >
          {m.body}
        </div>
        {m.attachments?.length > 0 && (
          <div className={`mt-1.5 flex flex-wrap gap-1.5 ${mine ? 'justify-end' : ''}`}>
            {m.attachments.map((a) => (
              <AttachmentThumb key={a.id} attachment={a} onOpen={onOpenImage} />
            ))}
          </div>
        )}
        <p className={`mt-1 text-[10px] text-navy-400 ${mine ? 'text-right' : ''}`}>{timeLabel(m.createdAt)}</p>
      </div>
    </div>
  )
}

export default function SupportChatPanel({
  messages = [],
  onSend,
  sending = false,
  emptyTitle = 'Bắt đầu trò chuyện với bộ phận hỗ trợ',
  emptyHint = 'Mô tả vấn đề bạn gặp, kèm ảnh chụp màn hình nếu có — bạn sẽ nhận phản hồi ngay trong app.',
  heightClass = 'h-[58vh] min-h-[360px]',
}) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [pending, setPending] = useState([])
  const [compressing, setCompressing] = useState(false)
  const [preview, setPreview] = useState(null)
  const fileRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  const pickFiles = async (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return

    const room = MAX_PENDING - pending.length
    if (room <= 0) {
      toast.error(`Mỗi tin nhắn gửi được tối đa ${MAX_PENDING} ảnh`)
      return
    }

    setCompressing(true)
    const added = []
    for (const file of files.slice(0, room)) {
      try {
        added.push(await compressImageFile(file))
      } catch (err) {
        toast.error(err.message || 'Không xử lý được ảnh')
      }
    }
    setCompressing(false)
    if (added.length) setPending((prev) => [...prev, ...added].slice(0, MAX_PENDING))
  }

  const submit = async () => {
    const body = text.trim()
    if (sending || compressing) return
    if (!body && pending.length === 0) return

    const attachments = pending.map((p) => ({ mimeType: p.mimeType, dataBase64: p.dataBase64 }))
    const ok = await onSend({ body, attachments })
    if (ok === false) return // lỗi đã được báo, giữ nguyên nội dung để người dùng thử lại

    setText('')
    setPending([])
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-navy-50/70 ring-1 ring-navy-100 dark:bg-slate-800/60 dark:ring-slate-700">
      <div className={`flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-4 ${heightClass}`}>
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-white">
              <Headset size={22} weight="fill" />
            </span>
            <p className="mt-3 font-bold text-navy-800 dark:text-white">{emptyTitle}</p>
            <p className="mt-1 max-w-sm text-sm text-navy-500 dark:text-slate-400">{emptyHint}</p>
          </div>
        ) : (
          messages.map((m) => <Bubble key={m.id} m={m} onOpenImage={setPreview} />)
        )}
        <div ref={bottomRef} />
      </div>

      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-navy-100 bg-white/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/70">
          {pending.map((p, i) => (
            <div key={i} className="relative">
              <img src={p.previewUrl} alt={p.name} className="h-14 w-14 rounded-lg object-cover ring-1 ring-navy-100" />
              <button
                type="button"
                onClick={() => setPending((prev) => prev.filter((_, idx) => idx !== i))}
                aria-label="Bỏ ảnh này"
                className="absolute -top-1.5 -right-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-rose-500 text-white shadow"
              >
                <X size={11} weight="bold" />
              </button>
              <span className="mt-0.5 block text-center text-[10px] text-navy-400">{formatBytes(p.size)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 border-t border-navy-100 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={pickFiles} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={compressing || pending.length >= MAX_PENDING}
          title="Gửi ảnh chụp màn hình"
          aria-label="Gửi ảnh chụp màn hình"
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-navy-50 text-navy-500 transition hover:bg-navy-100 disabled:opacity-40 dark:bg-slate-700 dark:text-slate-300"
        >
          {compressing ? <CircleNotch size={18} className="animate-spin" /> : <ImageSquare size={18} />}
        </button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          rows={1}
          placeholder="Nhập nội dung cần hỗ trợ… (Enter để gửi, Shift+Enter xuống dòng)"
          className="max-h-32 min-h-10 flex-1 resize-y rounded-xl border-0 bg-navy-50 px-3 py-2.5 text-sm text-navy-900 ring-1 ring-inset ring-navy-100 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white dark:ring-slate-600"
        />
        <button
          type="button"
          onClick={submit}
          disabled={sending || compressing || (!text.trim() && pending.length === 0)}
          className="flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-brand-gradient px-3.5 text-sm font-bold text-white shadow-glow-blue transition hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
        >
          {sending ? <CircleNotch size={17} className="animate-spin" /> : <PaperPlaneTilt size={16} weight="fill" />}
          Gửi
        </button>
      </div>

      {preview && (
        <Modal open onClose={() => setPreview(null)} title="Ảnh đính kèm" size="lg">
          <img src={preview} alt="Ảnh đính kèm" className="mx-auto max-h-[70vh] w-auto rounded-xl" />
        </Modal>
      )}
    </div>
  )
}
