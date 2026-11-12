import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  UsersThree,
  Check,
  Warning,
  Crown,
  Eye,
  EyeSlash,
  ArrowRight,
} from '@phosphor-icons/react'
import { getFamily, getFamilyBoard, setProgressSharing } from '../../services/familyService'
import { useToast } from '../../components/common/Toast'
import Avatar from '../../components/common/Avatar'
import { RoomButton, RoomCard, RoomSkeleton, RoomToggle } from '../../components/common/RoomUI'
import { formatDate, formatDateTime, formatVnd } from '../../lib/format'
import { isProPlan } from '../../lib/constants'
import { useAuth } from '../../context/AuthContext'

// ─── Cả nhóm ──────────────────────────────────────────────────
//
// Vì sao trang này tồn tại: gói Pro Doanh nghiệp (349.000đ) đắt gấp 4,4 lần gói Pro
// thường, mà trước trang này thứ khách nhận thêm chỉ là "3 chỗ ngồi" — người trả
// tiền không thấy được gì về cả nhóm mình. Một chỗ để nhìn tiến độ của chủ nhóm
// là lý do bền nhất để trả 349.000đ thay vì 79.000đ.
//
// Nguyên tắc về quyền riêng tư: người trong nhóm LUÔN biết chủ gói đang xem được gì
// và tắt được bất cứ lúc nào. Bị nhìn trộm việc riêng mà không biết là cách chắc
// chắn nhất để họ rời nhóm; tắt được thì họ ở lại và tự quyết định.
//
// Ba vai, ba nội dung — nhưng chỉ MỘT trang, vì cả ba đều đang hỏi cùng một câu:
// "cái gói doanh nghiệp này đang cho tôi cái gì?".

// Chip số liệu của thế giới phòng: "xong" = Sage (chỉ hoàn thành), dữ liệu
// trung tính = Oat, "quá hạn" = Blush/45 on-blush (Blush chỉ đến hạn/quá hạn).
function StatChip({ value, label, tone = 'default' }) {
  const tones = {
    default: 'bg-room-oat/60 text-room-ink/65',
    good: 'bg-room-sage/45 text-room-ink/75',
    bad: 'bg-room-blush/45 text-room-ink/85 dark:bg-room-blush/30',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-extrabold ${tones[tone]}`}>
      <span className="text-sm">{value}</span>
      {label}
    </span>
  )
}

function PersonCard({ person, isMe }) {
  return (
    <RoomCard className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={person.fullName} src={person.avatarUrl} size="sm" skin="room" />
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-room-ink">
              {person.fullName}
              {isMe && <span className="ml-1.5 text-xs font-bold text-room-ink/60">(bạn)</span>}
            </p>
            <p className="truncate text-xs font-semibold text-room-ink/65">
              {isMe ? 'Người trả tiền cho cả nhóm' : person.email}
            </p>
          </div>
        </div>
        {!person.shared && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-room-oat/70 px-2.5 py-1 text-[11px] font-extrabold text-room-ink/65 ring-1 ring-inset ring-room-acorn/20">
            <EyeSlash size={13} weight="bold" /> Không chia sẻ
          </span>
        )}
      </div>

      {person.shared ? (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatChip value={person.doneToday} label="xong hôm nay" tone={person.doneToday > 0 ? 'good' : 'default'} />
            <StatChip value={person.doneWeek} label="xong 7 ngày" />
            <StatChip value={person.open} label="việc đang mở" />
            {person.overdue > 0 && <StatChip value={person.overdue} label="quá hạn" tone="bad" />}
          </div>

          {/* Việc quá hạn LÂU NHẤT là thứ cần nhắc — không phải việc trễ 5 phút */}
          {(person.worst || []).length > 0 && (
            <ul className="mt-3 space-y-1.5 border-t border-dashed border-room-acorn/25 pt-3">
              {person.worst.map((t) => (
                <li key={t.taskId} className="flex items-start gap-2 text-xs">
                  <Warning size={13} weight="fill" className="mt-0.5 shrink-0 text-room-ink/60" />
                  <span className="min-w-0 flex-1 truncate font-bold text-room-ink/90">{t.title}</span>
                  <span className="shrink-0 rounded-md bg-room-blush/45 px-1.5 py-0.5 font-bold text-room-ink/85 dark:bg-room-blush/30">
                    hạn {formatDateTime(t.dueAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="mt-3 text-xs font-semibold text-room-ink/60">
          Người này đã tắt chia sẻ tiến độ. Số liệu của họ không rời khỏi máy chủ — hãy nhắn hỏi trực tiếp.
        </p>
      )}
    </RoomCard>
  )
}

export default function FamilyPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [family, setFamily] = useState(null)
  const [board, setBoard] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [famRes, boardRes] = await Promise.all([getFamily(), getFamilyBoard()])
    if (famRes.success) setFamily(famRes.data)
    // Chỉ chủ gói mới có bảng này; các vai khác nhận lỗi và bỏ qua
    if (boardRes.success) setBoard(boardRes.data)
    setLoading(false)
  }

  useEffect(() => {
    load()
     
  }, [])

  const toggleSharing = async (next) => {
    setSaving(true)
    const res = await setProgressSharing(next)
    setSaving(false)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success(res.message)
    setFamily((prev) => (prev ? { ...prev, progressShared: next } : prev))
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-5 animate-fade-in">
        <div className="space-y-2">
          <RoomSkeleton className="h-8 w-64" />
          <RoomSkeleton className="h-5 w-80" />
        </div>
        <RoomSkeleton className="h-24" />
        <RoomSkeleton className="h-40" />
      </div>
    )
  }

  const isSeat = family?.role === 'MEMBER'

  // ── Người trong nhóm: biết mình đang chia sẻ gì, và tắt được ──
  if (isSeat) {
    const shared = family?.progressShared !== false
    return (
      <div className="mx-auto max-w-3xl space-y-5 animate-fade-in">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-room-ink">
            <UsersThree size={26} weight="duotone" className="text-room-acorn" />
            Cả nhóm
          </h1>
          <p className="mt-1 text-sm font-semibold text-room-ink/65">
            Bạn đang dùng gói Pro Doanh nghiệp của <b>{family?.owner?.fullName || 'chủ nhóm'}</b>
            {family?.owner?.expiresAt && <> — còn hiệu lực tới {formatDate(family.owner.expiresAt)}</>}.
          </p>
        </div>

        <RoomCard className="p-5">
          <RoomToggle
            checked={shared}
            disabled={saving}
            onChange={() => toggleSharing(!shared)}
            label="Cho chủ gói xem tiến độ của tôi"
            description="Số việc bạn xong hôm nay và trong 7 ngày, số việc đang mở, số việc quá hạn, và tên tối đa 3 việc quá hạn lâu nhất. Không ai đọc được nội dung công việc của bạn."
          />
          <p className="mt-3 flex items-start gap-2 text-xs font-semibold text-room-ink/60">
            {shared ? (
              <>
                <Eye size={14} weight="fill" className="mt-0.5 shrink-0 text-room-acorn" />
                Chủ gói hiện thấy các con số trên. Tắt đi là số liệu của bạn không rời khỏi máy chủ nữa.
              </>
            ) : (
              <>
                <EyeSlash size={14} weight="fill" className="mt-0.5 shrink-0 text-room-ink/65" />
                Chủ gói không thấy số liệu nào của bạn.
              </>
            )}
          </p>
        </RoomCard>

        <RoomCard className="p-5">
          <p className="font-display text-sm font-bold text-room-ink">Bạn có gì trong gói này</p>
          <ul className="mt-2 space-y-1.5 text-sm font-semibold text-room-ink/75">
            {[
              'Toàn bộ quyền lợi Pro: nhắc dai, báo cáo năng suất, kế hoạch tuần, nhờ người khác làm',
              'Việc, nhắc nhở và báo cáo là của riêng bạn — chủ gói không sửa được việc của bạn',
              'Muốn tự trả tiền? Rời gói doanh nghiệp ở trang Gói, dữ liệu vẫn còn nguyên',
            ].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <Check size={15} weight="bold" className="mt-0.5 shrink-0 text-room-sage" />
                {line}
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <Link to="/app/billing">
              <RoomButton variant="secondary" icon={ArrowRight}>
                Quản lý gói của tôi
              </RoomButton>
            </Link>
          </div>
        </RoomCard>
      </div>
    )
  }

  // ── Chủ gói: bảng tiến độ cả nhóm ──
  if (board) {
    return (
      <div className="mx-auto max-w-3xl space-y-5 animate-fade-in">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-room-ink">
              <UsersThree size={26} weight="duotone" className="text-room-acorn" />
              Cả nhóm hôm nay
            </h1>
            <p className="mt-1 text-sm font-semibold text-room-ink/65">
              Mọi người trong gói doanh nghiệp đang tới đâu — số liệu do máy chủ tính theo giờ Việt Nam.
            </p>
          </div>
          <Link to="/app/billing">
            <RoomButton variant="secondary" icon={UsersThree}>
              Quản lý chỗ trong nhóm
            </RoomButton>
          </Link>
        </div>

        <RoomCard className="p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-room-ink/60">Cả nhóm</p>
          <div className="mt-2 flex flex-wrap gap-5">
            <div>
              <p className="text-3xl font-extrabold text-room-ink">{board.totals.doneToday}</p>
              <p className="text-xs font-bold text-room-ink/65">việc xong hôm nay</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-room-ink">{board.totals.doneWeek}</p>
              <p className="text-xs font-bold text-room-ink/65">việc xong trong 7 ngày</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-room-ink">{board.totals.open}</p>
              <p className="text-xs font-bold text-room-ink/65">việc đang mở</p>
            </div>
            <div>
              {/* Quá hạn là dữ liệu "đến hạn" — số nằm mỏ Blush/45 on-blush, số 0 để trống giấy */}
              <p
                className={`text-3xl font-extrabold ${
                  board.totals.overdue > 0
                    ? 'rounded-lg bg-room-blush/45 px-2 text-room-ink dark:bg-room-blush/30'
                    : 'text-room-ink'
                }`}
              >
                {board.totals.overdue}
              </p>
              <p className="text-xs font-bold text-room-ink/65">việc quá hạn</p>
            </div>
          </div>
          {board.hiddenCount > 0 && (
            <p className="mt-3 text-xs font-semibold text-room-ink/60">
              {board.hiddenCount} người trong nhóm không chia sẻ tiến độ, nên các số trên chưa tính họ.
            </p>
          )}
        </RoomCard>

        <PersonCard person={board.me} isMe />

        {board.members.length === 0 ? (
          <RoomCard className="p-5 text-center">
            <p className="font-display text-sm font-bold text-room-ink">
              Nhà mới có mình bạn
            </p>
            <p className="mt-1 text-sm font-semibold text-room-ink/65">
              Mời chủ nhóm vào bằng email — họ dùng miễn phí và có ngay quyền lợi Pro. Nhà dùng được tối đa{' '}
              {board.maxSeats} tài khoản.
            </p>
            <div className="mt-4 flex justify-center">
              <Link to="/app/billing">
                <RoomButton icon={UsersThree}>Mời chủ nhóm</RoomButton>
              </Link>
            </div>
          </RoomCard>
        ) : (
          board.members.map((m) => <PersonCard key={m.userId} person={m} />)
        )}

        <p className="text-center text-xs font-semibold text-room-ink/65">
          Bảng này là quyền lợi riêng của chủ gói Pro Doanh nghiệp. Người trong nhóm luôn thấy được là đang chia sẻ và tắt
          được bất cứ lúc nào.
        </p>
      </div>
    )
  }

  // ── Chưa có nhà: mời mua ──
  const paidButNotFamily = isProPlan(user?.plan)
  return (
    <div className="mx-auto max-w-2xl space-y-5 animate-fade-in">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-room-ink">
          <UsersThree size={26} weight="duotone" className="text-room-acorn" />
          Cả nhóm
        </h1>
        <p className="mt-1 text-sm font-semibold text-room-ink/65">
          Trang này dành cho gói <b>Pro Doanh nghiệp</b> — một người trả tiền, cả nhóm cùng dùng.
        </p>
      </div>

      <RoomCard className="p-6">
        <p className="inline-flex items-center gap-2 font-display text-sm font-bold text-room-ink">
          <Crown size={18} weight="fill" className="text-room-bell" /> Pro Doanh nghiệp — {formatVnd(349000)}/tháng cho cả nhóm
        </p>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-room-ink/65">
          Tới <b>10 tài khoản</b> dùng chung quyền lợi Pro, và chủ gói có trang này để nhìn cả nhóm đang tới đâu: hôm nay
          ai xong việc gì, ai đang quá hạn, việc nào bị bỏ quên lâu nhất. Người trong nhóm luôn biết mình đang chia sẻ
          gì và tắt được bất cứ lúc nào.
        </p>
        <div className="mt-4">
          <Link to="/app/billing">
            <RoomButton icon={ArrowRight}>
              {paidButNotFamily ? 'Nâng cấp lên Pro Doanh nghiệp' : 'Mua cho cả nhóm'}
            </RoomButton>
          </Link>
        </div>
        {paidButNotFamily && (
          <p className="mt-3 text-xs font-semibold text-room-ink/65">
            Bạn đã có quyền lợi Pro rồi; gói doanh nghiệp là để thêm chủ nhóm và mở trang này.
          </p>
        )}
      </RoomCard>
    </div>
  )
}
