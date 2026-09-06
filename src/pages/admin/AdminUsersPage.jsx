import { useEffect, useState } from 'react'
import {
  MagnifyingGlass,
  Lock,
  LockOpen,
  UsersThree,
  ArrowLeft,
  ArrowRight,
  UserPlus,
} from '@phosphor-icons/react'
import { getAdminUsers, setUserActive, createAdminUser, setUserPlan } from '../../services/adminService'
import { useToast } from '../../components/common/Toast'
import { Skeleton, EmptyState } from '../../components/common/Feedback'
import Button from '../../components/common/Button'
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

export default function AdminUsersPage() {
  const toast = useToast()
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
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
          <h1 className="text-2xl font-extrabold tracking-tight text-navy-900">Quản lý tài khoản</h1>
          <p className="mt-1 text-sm font-medium text-navy-400">
            {data ? `${data.total} tài khoản` : '…'} · Quản lý tài khoản, theo dõi gói đăng ký và hạn sử dụng
          </p>
        </div>
        <Button variant="gradient" icon={UserPlus} onClick={openCreate}>
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
          <div className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-navy-100">
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
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white">
                            {u.fullName.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-navy-900">{u.fullName}</p>
                            <p className="truncate text-xs text-navy-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-navy-600">{u.taskCount}</td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <select
                              value={u.plan || 'FREE'}
                              onChange={(e) => changePlan(u, e.target.value)}
                              aria-label={`Đổi gói của ${u.fullName}`}
                              className="h-8 cursor-pointer rounded-lg border-0 bg-navy-50 px-2.5 text-xs font-bold text-navy-700 ring-1 ring-inset ring-navy-100 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600"
                            >
                              <option value="FREE">Miễn phí</option>
                              <option value="PLUS">Plus</option>
                              <option value="PRO">Pro</option>
                            </select>
                            <span className={`inline-flex items-center rounded-full px-2 py-px text-[10px] font-extrabold ring-1 ring-inset ${PLAN_BADGE[u.plan || 'FREE']}`}>
                              {PLAN_NAMES[u.plan || 'FREE']}
                            </span>
                          </div>
                          <PlanMeta u={u} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-navy-500">{formatDate(u.createdAt)}</td>
                      <td className="px-4 py-3">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                            Hoạt động
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700 ring-1 ring-inset ring-rose-200">
                            <Lock size={11} weight="bold" /> Đã khóa
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {u.isActive ? (
                          <Button
                            variant="danger-ghost"
                            size="sm"
                            icon={Lock}
                            onClick={() => setConfirm({ id: u.id, name: u.fullName, isActive: true })}
                          >
                            Khóa
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={LockOpen}
                            onClick={() => setConfirm({ id: u.id, name: u.fullName, isActive: false })}
                          >
                            Mở khóa
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-3" aria-label="Phân trang">
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
