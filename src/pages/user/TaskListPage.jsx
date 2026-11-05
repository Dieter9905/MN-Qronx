import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MagnifyingGlass, Plus, Funnel, X, ArrowLeft, ArrowRight, Trash, ArrowUUpLeft } from '@phosphor-icons/react'
import { getTasks, completeTask, getTrash, restoreTask, emptyTrash } from '../../services/taskService'
import { getCategories } from '../../services/categoryService'
import { onTasksChanged } from '../../lib/dataEvents'
import { useToast } from '../../components/common/Toast'
import TaskItem from '../../components/TaskItem'
import { RoomButton, RoomCard, RoomSkeleton, RoomEmpty } from '../../components/common/RoomUI'

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'TODO', label: 'Chưa làm' },
  { value: 'IN_PROGRESS', label: 'Đang làm' },
  { value: 'COMPLETED', label: 'Hoàn thành' },
  { value: 'OVERDUE', label: 'Quá hạn' },
  { value: 'CANCELLED', label: 'Đã hủy' },
]

const PRIORITY_OPTIONS = [
  { value: '', label: 'Tất cả ưu tiên' },
  { value: 'URGENT', label: 'Khẩn cấp' },
  { value: 'HIGH', label: 'Cao' },
  { value: 'MEDIUM', label: 'Trung bình' },
  { value: 'LOW', label: 'Thấp' },
]

const SORT_OPTIONS = [
  { value: 'dueAsc', label: 'Hạn đến gần nhất' },
  { value: 'dueDesc', label: 'Hạn xa nhất' },
  { value: 'priorityDesc', label: 'Ưu tiên cao trước' },
]

const PAGE_SIZE = 8

// Select da phòng — dùng cho sort + 4 ô lọc (token room tự bắt sáng/tối).
const roomSelectCls =
  'h-11 w-full cursor-pointer rounded-xl bg-room-oat/45 px-3 text-sm font-bold text-room-ink ' +
  'ring-1 ring-inset ring-room-acorn/20 transition hover:bg-room-oat/75 ' +
  'focus:ring-2 focus:ring-room-acorn focus:outline-none'

export default function TaskListPage() {
  const toast = useToast()
  const [filters, setFilters] = useState({ status: '', priority: '', categoryId: '', keyword: '', range: '', sort: 'dueAsc' })
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState([])
  const [filterOpen, setFilterOpen] = useState(false)
  // Thùng rác: xoá là đưa vào đây nên người dùng không sợ mất dữ liệu
  const [trashOpen, setTrashOpen] = useState(false)
  const [trash, setTrash] = useState(null)
  const [trashLoading, setTrashLoading] = useState(false)
  const [trashBusy, setTrashBusy] = useState(false)

  const loadCategories = async () => {
    const res = await getCategories({ isActive: true })
    if (res.success) setCategories(res.data)
  }

  const load = async () => {
    setLoading(true)
    const now = new Date()
    const params = { ...filters, page, pageSize: PAGE_SIZE }
    if (filters.range === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      params.dueFrom = start.toISOString()
      params.dueTo = end.toISOString()
    } else if (filters.range === 'week') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7)
      params.dueFrom = start.toISOString()
      params.dueTo = end.toISOString()
    } else if (filters.range === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const end = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())
      params.dueFrom = start.toISOString()
      params.dueTo = end.toISOString()
    }
    const res = await getTasks(params)
    if (res.success) setData(res.data)
    setLoading(false)
  }

  useEffect(() => {
    loadCategories()

  }, [])

  useEffect(() => {
    setPage(1)
  }, [filters])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page])

  // Việc được đánh dấu xong ở nơi khác — trên hết là màn hình chuông báo thức phủ
  // toàn màn hình — thì danh sách đang mở phải tải lại, nếu không khách quay lại
  // vẫn thấy việc vừa làm xong nằm đó. Giữ `load` trong ref để chỉ đăng ký MỘT
  // lần, thay vì đăng ký lại mỗi khi đổi bộ lọc.
  const loadRef = useRef(load)
  loadRef.current = load
  useEffect(() => onTasksChanged(() => loadRef.current()), [])

  const activeFilterCount = useMemo(
    () =>
      ['status', 'priority', 'categoryId', 'range'].filter((k) => filters[k]).length +
      (filters.keyword ? 1 : 0),
    [filters]
  )

  const clearFilters = () => {
    setFilters({ status: '', priority: '', categoryId: '', keyword: '', range: '', sort: 'dueAsc' })
  }

  const loadTrash = async () => {
    setTrashLoading(true)
    const res = await getTrash({ page: 1, pageSize: 20 })
    if (res.success) setTrash(res.data)
    else toast.error(res.message)
    setTrashLoading(false)
  }

  const openTrash = async () => {
    if (trashOpen) {
      setTrashOpen(false)
      return
    }
    setTrashOpen(true)
    await loadTrash()
  }

  const restore = async (id) => {
    const res = await restoreTask(id)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success('Đã khôi phục công việc')
    await loadTrash()
    load()
  }

  const purgeAll = async () => {
    if (trashBusy) return
    setTrashBusy(true)
    const res = await emptyTrash()
    setTrashBusy(false)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success(res.message || 'Đã xoá sạch thùng rác')
    await loadTrash()
  }

  const toggleComplete = async (task) => {
    const res = await completeTask(task.id)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success('Đã hoàn thành công việc')
    load()
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-room-ink">Công việc</h1>
          <p className="mt-1 text-sm font-semibold text-room-ink/55">
            {data ? `${data.total} công việc` : '…'} · Lên kế hoạch và hoàn thành đúng thời điểm
          </p>
        </div>
        <Link to="/app/tasks/new">
          <RoomButton icon={Plus}>Tạo công việc</RoomButton>
        </Link>
      </div>

      {/* Thanh tìm kiếm + lọc — khay bạn học: mọi kệ têm nằm trên cùng mặt giấy */}
      <RoomCard className="p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <MagnifyingGlass size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-room-ink/35" />
            <input
              type="search"
              value={filters.keyword}
              onChange={(e) => setFilters((f) => ({ ...f, keyword: e.target.value }))}
              placeholder="Tìm công việc theo tiêu đề…"
              aria-label="Tìm kiếm công việc"
              className="h-11 w-full rounded-xl bg-room-oat/45 pl-10 pr-4 text-sm font-semibold text-room-ink transition placeholder:text-room-ink/35 hover:bg-room-oat/70 focus:bg-room-paper focus:ring-2 focus:ring-room-acorn focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filters.sort}
              onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}
              aria-label="Sắp xếp"
              className={roomSelectCls}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setFilterOpen((o) => !o)}
              aria-expanded={filterOpen}
              className="relative flex h-11 cursor-pointer shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-room-oat/45 px-4 text-sm font-bold text-room-ink ring-1 ring-inset ring-room-acorn/20 transition hover:bg-room-oat/75"
            >
              <Funnel size={17} weight="bold" />
              <span className="hidden sm:inline">Lọc</span>
              {activeFilterCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-room-acorn px-1 text-[10px] font-bold text-room-paper">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {/* Thùng rác = khoảng "chờ dẹp" → Rain trung tính, không rose */}
            <button
              type="button"
              onClick={openTrash}
              aria-pressed={trashOpen}
              className={`flex h-11 cursor-pointer shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-bold ring-1 ring-inset transition ${
                trashOpen
                  ? 'bg-room-rain/35 text-room-ink ring-room-rain'
                  : 'bg-room-oat/45 text-room-ink ring-room-acorn/20 hover:bg-room-oat/75'
              }`}
            >
              <Trash size={17} weight="bold" />
              <span className="hidden sm:inline">Thùng rác</span>
              {trash?.total > 0 && (
                <span className="rounded-full bg-room-rain px-1.5 text-[10px] font-extrabold text-room-ink">{trash.total}</span>
              )}
            </button>
          </div>
        </div>

        {filterOpen && (
          <div className="mt-3 grid gap-3 border-t border-room-acorn/15 pt-3 sm:grid-cols-4 animate-slide-down">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-room-ink/60">Trạng thái</span>
              <select
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                className={`h-10 ${roomSelectCls}`}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-room-ink/60">Ưu tiên</span>
              <select
                value={filters.priority}
                onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
                className={`h-10 ${roomSelectCls}`}
              >
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-room-ink/60">Danh mục</span>
              <select
                value={filters.categoryId}
                onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}
                className={`h-10 ${roomSelectCls}`}
              >
                <option value="">Tất cả danh mục</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-room-ink/60">Khoảng thời gian</span>
              <select
                value={filters.range}
                onChange={(e) => setFilters((f) => ({ ...f, range: e.target.value }))}
                className={`h-10 ${roomSelectCls}`}
              >
                <option value="">Mọi lúc</option>
                <option value="today">Hôm nay</option>
                <option value="week">7 ngày tới</option>
                <option value="month">30 ngày tới</option>
              </select>
            </label>
          </div>
        )}
      </RoomCard>

      {trashOpen && (
        <RoomCard className="animate-slide-down p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-room-acorn/15 pb-3">
            <div>
              <h2 className="flex items-center gap-2 font-display font-bold text-room-ink">
                <Trash size={18} weight="fill" className="text-room-ink/50" />
                Thùng rác
              </h2>
              <p className="mt-0.5 text-xs font-semibold text-room-ink/55">
                Việc xoá được giữ 30 ngày rồi mới xoá thật — khôi phục được bất cứ lúc nào.
              </p>
            </div>
            {trash?.total > 0 && (
              <RoomButton variant="secondary" size="sm" icon={Trash} loading={trashBusy} onClick={purgeAll}>
                Xoá sạch ({trash.total})
              </RoomButton>
            )}
          </div>

          {trashLoading ? (
            <div className="mt-3 space-y-2.5">
              {[0, 1].map((i) => (
                <RoomSkeleton key={i} className="h-16" />
              ))}
            </div>
          ) : !trash || trash.items.length === 0 ? (
            <p className="mt-4 text-sm font-semibold text-room-ink/55">
              Thùng rác trống — không có việc nào cần khôi phục.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {trash.items.map((t) => (
                <li
                  key={t.id ?? t.taskId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-room-oat/50 p-3.5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-room-ink">{t.title}</span>
                    <span className="block text-xs font-semibold text-room-ink/50">
                      {t.category?.categoryName || 'Không danh mục'} · đang chờ xoá vĩnh viễn
                    </span>
                  </span>
                  <RoomButton variant="secondary" size="sm" icon={ArrowUUpLeft} onClick={() => restore(t.id ?? t.taskId)}>
                    Khôi phục
                  </RoomButton>
                </li>
              ))}
            </ul>
          )}
        </RoomCard>
      )}

      {/* Danh sách */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <RoomSkeleton key={i} className="h-[76px]" />
          ))}
        </div>
      ) : data && data.items.length === 0 ? (
        <RoomCard className="p-4">
          <RoomEmpty
            icon={MagnifyingGlass}
            title={activeFilterCount > 0 ? 'Không có công việc khớp bộ lọc' : 'Chưa có công việc nào'}
            description={
              activeFilterCount > 0
                ? 'Hãy thử xóa bộ lọc hoặc thay đổi từ khóa tìm kiếm.'
                : 'Tạo công việc đầu tiên của bạn để bắt đầu quản lý thời gian.'
            }
            action={
              activeFilterCount > 0 ? (
                <RoomButton variant="secondary" size="sm" icon={X} onClick={clearFilters}>
                  Xóa bộ lọc
                </RoomButton>
              ) : (
                <Link to="/app/tasks/new">
                  <RoomButton size="sm" icon={Plus}>
                    Tạo công việc mới
                  </RoomButton>
                </Link>
              )
            }
          />
        </RoomCard>
      ) : (
        <>
          <div className="space-y-2.5">
            {data?.items.map((t) => (
              <TaskItem key={t.id} task={t} onToggleComplete={toggleComplete} skin="room" />
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Phân trang">
              <RoomButton variant="secondary" size="sm" icon={ArrowLeft} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Trước
              </RoomButton>
              <span className="flex items-center gap-1 rounded-xl bg-room-paper px-3 py-2 text-sm font-bold text-room-ink ring-1 ring-room-acorn/25">
                Trang {page} / {totalPages}
              </span>
              <RoomButton variant="secondary" size="sm" icon={ArrowRight} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Sau
              </RoomButton>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
