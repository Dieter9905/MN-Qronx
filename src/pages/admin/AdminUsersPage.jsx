import { useEffect, useState } from 'react'
import {
  MagnifyingGlass,
  Lock,
  LockOpen,
  UsersThree,
  ArrowLeft,
  ArrowRight,
  UserPlus,
  Trash,
  Warning,
} from '@phosphor-icons/react'
import { getAdminUsers, setUserActive, createAdminUser, setUserPlan, deleteAdminUser } from '../../services/adminService'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/common/Toast'
import { Skeleton, EmptyState } from '../../components/common/Feedback'
import Button from '../../components/common/Button'
import Avatar from '../../components/common/Avatar'
import Modal, { ConfirmDialog } from '../../components/common/Modal'
import { Field, Input, Select } from '../../components/common/Inputs'
import { formatDate } from '../../lib/format'
import { PLAN_BADGE, PLAN_NAMES } from '../../lib/constants'

const PAGE_SIZE = 10
const DAY_MS = 86400000

// Trả về mốc thời gian gói trả phí + số ngày còn lại (âm = đã hết hạn)
function planPeriod(u) {
  if (u.plan === 'FREE' || !u.planExpiresAt) return null
  return {
    started: u.planStartedAt ? new Date(u.planStartedAt) : null,
    expires: new Date(u.planExpiresAt),
    days: Math.ceil((new Date(u.planExpiresAt) - Date.now()) / DAY_MS),
  }
}

function PlanMeta({ u }) {
  const meta = planPeriod(u)
  if (!meta) {
    return (
      <p className="text-[11px] font-medium text-navy-400">✓ Dùng miễn phí – không giới hạn thời gian</p>
    )
  }
  const expired = meta.days < 0
  const urgent = !expired && meta.days <= 7
  return (
    <div className="text-[11px] leading-relaxed">
      <p className="text-navy-500">
        <span className="font-bold text-navy-400">Từ:</span>{' '}
        {meta.started ? formatDate(meta.started) : '—'}
      </p>
      <p className={expired ? 'font-bold text-rose-600' : urgent ? 'font-bold text-amber-600' : 'text-navy-500'}>
        <span className={expired ? 'text-rose-400' : urgent ? 'text-amber-500' : 'text-navy-400'}>Hết hạn:</span>{' '}
        {formatDate(meta.expires)}
        {expired ? ' · đã hết hạn' : ` · còn ${meta.days} ngày`}
      </p>
    </div>
  )
}

/** Ô chọn gói + nhãn + hạn dùng — dùng chung cho bảng và thẻ trên điện thoại. */
function PlanSelect({ u, onChange }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={u.plan || 'FREE'}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`Đổi gói của ${u.fullName}`}
          className="h-8 cursor-pointer rounded-lg border-0 bg-navy-50 px-2.5 text-xs font-bold text-navy-700 ring-1 ring-inset ring-navy-100 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600"
        >
          <option value="FREE">Miễn phí</option>
          <option value="PLUS">Plus</option>
          <option value="PRO">Pro</option>
          <option value="BUSINESS">Pro Doanh nghiệp</option>
        </select>
        <span
          className={`inline-flex items-center rounded-full px-2 py-px text-[10px] font-extrabold ring-1 ring-inset ${PLAN_BADGE[u.plan || 'FREE']}`}
        >
          {PLAN_NAMES[u.plan || 'FREE']}
        </span>
      </div>
      <PlanMeta u={u} />
    </div>
  )
}

/** Nhãn trạng thái tài khoản. */
function StatusPill({ active }) {
  if (active) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
        Hoạt động
      </span>
    )
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700 ring-1 ring-inset ring-rose-200">
      <Lock size={11} weight="bold" /> Đã khóa
    </span>
  )
}

/** Nút khóa/mở khóa + xóa — một chỗ duy nhất cho cả bảng và thẻ. */
function UserActions({ u, currentUser, onLock, onDelete, className = '', fullWidth = false }) {
  const lockDisabled = u.role === 'ADMIN'
  const deleteDisabled = u.role === 'ADMIN' || u.id === currentUser?.id
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {u.isActive ? (
        <Button
          variant="secondary"
          size="sm"
          icon={Lock}
          fullWidth={fullWidth}
          disabled={lockDisabled}
          title={lockDisabled ? 'Không thể khóa tài khoản Admin' : 'Khóa tài khoản'}
          onClick={() => onLock({ id: u.id, name: u.fullName, isActive: true })}
        >
          Khóa
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          icon={LockOpen}
          fullWidth={fullWidth}
          onClick={() => onLock({ id: u.id, name: u.fullName, isActive: false })}
        >
          Mở khóa
        </Button>
      )}
      <Button
        variant="danger-ghost"
        size="sm"
        icon={Trash}
        fullWidth={fullWidth}
        disabled={deleteDisabled}
        title={
          u.role === 'ADMIN'
            ? 'Không thể xóa tài khoản Admin'
            : u.id === currentUser?.id
              ? 'Đây là tài khoản bạn đang đăng nhập'
              : `Xóa vĩnh viễn tài khoản ${u.fullName}`
        }
        onClick={() => onDelete({ id: u.id, name: u.fullName, email: u.email, taskCount: u.taskCount })}
      >
        Xóa
      </Button>
    </div>
  )
}

export default function AdminUsersPage() {
  const toast = useToast()
  const { user: currentUser } = useAuth()
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  // Xoá tài khoản: tách riêng khỏi khóa/mở khóa vì đây là thao tác không thể hoàn tác
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({
    fullName: '',
    email: '',
    password: '',
    phoneNumber: '',
    role: 'USER',
  })
  const [createErrors, setCreateErrors] = useState({})
  const [creating, setCreating] = useState(false)

  const load = async () => {
    setLoading(true)
    const res = await getAdminUsers({ keyword, isActive: status, page, pageSize: PAGE_SIZE })
    if (res.success) setData(res.data)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, status, page])

  const changePlan = async (u, plan) => {
    if (!plan || plan === u.plan) return
    setBusy(true)
    const res = await setUserPlan(u.id, plan)
    setBusy(false)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success(`Đã chuyển gói của ${res.data.fullName || u.fullName} sang ${PLAN_NAMES[plan]}`)
    load()
  }

  const doLock = async () => {
    if (!confirm) return
    setBusy(true)
    const res = await setUserActive(confirm.id, !confirm.isActive)
    setBusy(false)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success(res.message)
    setConfirm(null)
    load()
  }

  const doDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    const res = await deleteAdminUser(confirmDelete.id)
    setDeleting(false)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success(res.message || `Đã xoá tài khoản ${confirmDelete.name}`)
    setConfirmDelete(null)
    // Xoá bản ghi cuối của trang cuối → lùi một trang cho khỏi trống bảng
    if (data && data.items.length === 1 && page > 1) {
      setPage((p) => p - 1)
      return
    }
    load()
  }

  const openCreate = () => {
    setCreateForm({ fullName: '', email: '', password: '', phoneNumber: '', role: 'USER' })
    setCreateErrors({})
    setShowCreate(true)
  }

  const submitCreate = async () => {
    const er = {}
    if (!createForm.fullName.trim()) er.fullName = 'Họ tên không được để trống'
    if (!createForm.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.email.trim())) {
      er.email = 'Email không hợp lệ'
    }
    if (!createForm.password || createForm.password.length < 6) {
      er.password = 'Mật khẩu phải có ít nhất 6 ký tự'
    }
    setCreateErrors(er)
    if (Object.keys(er).length > 0) return

    setCreating(true)
    const res = await createAdminUser({
      fullName: createForm.fullName.trim(),
      email: createForm.email.trim(),
      password: createForm.password,
      phoneNumber: createForm.phoneNumber.trim(),
      role: createForm.role,
    })
    setCreating(false)
    if (!res.success) {
      if (res.errors) setCreateErrors(res.errors)
      toast.error(res.message || 'Không thể tạo tài khoản')
      return
    }
    toast.success(`Đã tạo tài khoản ${res.data.fullName}`)
    setShowCreate(false)
    setPage(1)
    setKeyword('')
    setStatus('')
    load()
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-navy-900 sm:text-2xl">Quản lý tài khoản</h1>
          <p className="mt-1 text-sm font-medium text-navy-400">
            {data ? `${data.total} tài khoản` : '…'} · Quản lý tài khoản, theo dõi gói đăng ký và hạn sử dụng
          </p>
        </div>
        <Button variant="gradient" icon={UserPlus} onClick={openCreate} className="w-full sm:w-auto">
          Thêm tài khoản
        </Button>
      </div>

      {/* Bộ lọc */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <MagnifyingGlass size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-300" />
          <input
            type="search"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value)
              setPage(1)
            }}
            placeholder="Tìm theo họ tên hoặc email…"
            aria-label="Tìm người dùng"
            className="h-11 w-full rounded-xl border-0 bg-white pl-10 pr-4 text-sm text-navy-900 shadow-sm ring-1 ring-inset ring-navy-200 transition placeholder:text-navy-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
          aria-label="Lọc theo trạng thái"
          className="h-11 cursor-pointer rounded-xl border-0 bg-white px-3.5 text-sm font-medium text-navy-700 shadow-sm ring-1 ring-inset ring-navy-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="true">Đang hoạt động</option>
          <option value="false">Đã khóa</option>
        </select>
      </div>

      {/* Bảng */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : data && data.items.length === 0 ? (
        <div className="rounded-2xl bg-white shadow-card ring-1 ring-navy-100">
          <EmptyState icon={UsersThree} title="Không tìm thấy người dùng" description="Thử đổi từ khóa hoặc bộ lọc trạng thái." />
        </div>
      ) : (
        <>
          {/* ── Điện thoại: mỗi tài khoản một thẻ ────────────────────────────
              Bảng 6 cột không thể đọc trên màn 390px (phải kéo ngang từng dòng,
              nút thao tác nằm ngoài khung nhìn). Thẻ gom đủ thông tin + thao tác
              trong một khối dọc, bấm được bằng ngón tay. Bảng thật vẫn giữ cho
              laptop/desktop từ lg trở lên. */}
          <div className="space-y-3 lg:hidden">
            {data.items.map((u) => (
              <article key={u.id} className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-navy-100">
                <div className="flex items-start gap-3">
                  <Avatar name={u.fullName} src={u.avatarUrl} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-navy-900">{u.fullName}</p>
                        <p className="truncate text-xs text-navy-400">{u.email}</p>
                      </div>
                      <StatusPill active={u.isActive} />
                    </div>
                    <p className="mt-1.5 text-[11px] font-semibold text-navy-400">
                      {u.taskCount} công việc · tạo {formatDate(u.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 border-t border-navy-50 pt-3">
                  <PlanSelect u={u} onChange={(plan) => changePlan(u, plan)} />
                </div>

                <UserActions
                  u={u}
                  currentUser={currentUser}
                  onLock={setConfirm}
                  onDelete={setConfirmDelete}
                  className="mt-3 grid grid-cols-2 gap-2"
                  fullWidth
                />
              </article>
            ))}
          </div>

          {/* ── Desktop: bảng đầy đủ ── */}
          <div className="hidden overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-navy-100 lg:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left">                  <thead>
                    <tr className="border-b border-navy-100 bg-navy-50/70 text-xs font-bold uppercase tracking-wider text-navy-400">
                      <th className="px-4 py-3">Người dùng</th>
                      <th className="px-4 py-3">Công việc</th>
                      <th className="px-4 py-3">Gói</th>
                      <th className="px-4 py-3">Ngày tạo</th>
                      <th className="px-4 py-3">Trạng thái</th>
                      <th className="px-4 py-3 text-right">Hành động</th>
                    </tr>
                  </thead>
                <tbody className="divide-y divide-navy-50">
                  {data?.items.map((u) => (
                    <tr key={u.id} className="transition hover:bg-navy-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.fullName} src={u.avatarUrl} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-navy-900">{u.fullName}</p>
                            <p className="truncate text-xs text-navy-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-navy-600">{u.taskCount}</td>
                      <td className="px-4 py-3 align-top">
                        <PlanSelect u={u} onChange={(plan) => changePlan(u, plan)} />
                      </td>
                      <td className="px-4 py-3 text-sm text-navy-500">{formatDate(u.createdAt)}</td>
                      <td className="px-4 py-3">
                        <StatusPill active={u.isActive} />
                      </td>
                      <td className="px-4 py-3">
                        <UserActions
                          u={u}
                          currentUser={currentUser}
                          onLock={setConfirm}
                          onDelete={setConfirmDelete}
                          className="justify-end"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {totalPages > 1 && (
            <nav className="flex flex-wrap items-center justify-center gap-3" aria-label="Phân trang">
              <Button variant="secondary" size="sm" icon={ArrowLeft} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Trước
              </Button>
              <span className="text-sm font-bold text-navy-500">Trang {page} / {totalPages}</span>
              <Button variant="secondary" size="sm" icon={ArrowRight} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Sau
              </Button>
            </nav>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={doLock}
        title={confirm?.isActive ? 'Khóa tài khoản?' : 'Mở khóa tài khoản?'}
        message={
          confirm?.isActive
            ? `Khóa tài khoản “${confirm?.name}”? Người dùng này sẽ không thể đăng nhập hoặc nhận thông báo.`
            : `Mở khóa tài khoản “${confirm?.name}”? Người dùng sẽ đăng nhập và nhận thông báo trở lại.`
        }
        confirmLabel={confirm?.isActive ? 'Khóa tài khoản' : 'Mở khóa'}
        danger={confirm?.isActive}
        loading={busy}
      />

      {/* Xóa vĩnh viễn tài khoản – thao tác không thể hoàn tác nên tách riêng khỏi khóa */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        size="sm"
        title="Xóa vĩnh viễn tài khoản?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)} disabled={deleting}>
              Hủy
            </Button>
            <Button variant="danger" icon={Trash} onClick={doDelete} loading={deleting}>
              Xóa vĩnh viễn
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3 rounded-xl bg-rose-50 p-3 ring-1 ring-inset ring-rose-200 dark:bg-rose-900/20 dark:ring-rose-800/50">
          <Warning size={20} weight="fill" className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
          <div className="min-w-0 text-sm text-rose-800 dark:text-rose-200">
            <p className="truncate font-bold">{confirmDelete?.name}</p>
            <p className="truncate">{confirmDelete?.email}</p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-navy-600 dark:text-slate-300">
          Tài khoản sẽ bị xóa khỏi hệ thống kèm toàn bộ dữ liệu của nó:{' '}
          {typeof confirmDelete?.taskCount === 'number' && (
            <>
              <b>{confirmDelete.taskCount} công việc</b>,{' '}
            </>
          )}
          danh mục, nhắc nhở, thiết bị nhận thông báo, điểm thưởng và phiên đăng nhập. Email này có thể được đăng ký lại từ đầu.
        </p>
        <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-navy-50 p-3 text-xs font-bold text-navy-600 dark:bg-slate-700/60 dark:text-slate-200">
          <Warning size={14} weight="bold" />
          Hành động này không thể hoàn tác — nên khóa tài khoản nếu chỉ muốn tạm dừng.
        </p>
      </Modal>

      {/* Tạo tài khoản mới */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Thêm tài khoản mới"
        description="Tạo tài khoản cho người dùng hoặc quản trị viên."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)} disabled={creating}>
              Hủy
            </Button>
            <Button variant="gradient" icon={UserPlus} onClick={submitCreate} loading={creating}>
              Tạo tài khoản
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Họ tên" required error={createErrors.fullName}>
            {(id) => (
              <Input
                id={id}
                value={createForm.fullName}
                onChange={(e) => {
                  setCreateForm((f) => ({ ...f, fullName: e.target.value }))
                  setCreateErrors((er) => ({ ...er, fullName: undefined }))
                }}
                invalid={!!createErrors.fullName}
                placeholder="Nguyen Van A"
              />
            )}
          </Field>
          <Field label="Email" required error={createErrors.email}>
            {(id) => (
              <Input
                id={id}
                type="email"
                value={createForm.email}
                onChange={(e) => {
                  setCreateForm((f) => ({ ...f, email: e.target.value }))
                  setCreateErrors((er) => ({ ...er, email: undefined }))
                }}
                invalid={!!createErrors.email}
                placeholder="user@example.com"
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mật khẩu" required error={createErrors.password} hint="Tối thiểu 6 ký tự">
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  value={createForm.password}
                  onChange={(e) => {
                    setCreateForm((f) => ({ ...f, password: e.target.value }))
                    setCreateErrors((er) => ({ ...er, password: undefined }))
                  }}
                  invalid={!!createErrors.password}
                />
              )}
            </Field>
            <Field label="Số điện thoại" error={createErrors.phoneNumber}>
              {(id) => (
                <Input
                  id={id}
                  value={createForm.phoneNumber}
                  onChange={(e) => {
                    setCreateForm((f) => ({ ...f, phoneNumber: e.target.value }))
                    setCreateErrors((er) => ({ ...er, phoneNumber: undefined }))
                  }}
                  invalid={!!createErrors.phoneNumber}
                  placeholder="0901234567"
                />
              )}
            </Field>
          </div>
          <Field label="Vai trò" required>
            {(id) => (
              <Select
                id={id}
                value={createForm.role}
                onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
              >
                <option value="USER">Người dùng (USER)</option>
                <option value="ADMIN">Quản trị viên (ADMIN)</option>
              </Select>
            )}
          </Field>
        </div>
      </Modal>
    </div>
  )
}
