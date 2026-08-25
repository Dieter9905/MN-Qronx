import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MagnifyingGlass, Plus, Funnel, X, ArrowLeft, ArrowRight, CaretDown } from '@phosphor-icons/react'
import { getTasks, completeTask } from '../../services/taskService'
import { getCategories } from '../../services/categoryService'
import { useToast } from '../../components/common/Toast'
import { Skeleton, EmptyState } from '../../components/common/Feedback'
import Button from '../../components/common/Button'
import TaskItem from '../../components/TaskItem'

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

export default function TaskListPage() {
  const toast = useToast()
  const [filters, setFilters] = useState({ status: '', priority: '', categoryId: '', keyword: '', range: '', sort: 'dueAsc' })
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState([])
  const [filterOpen, setFilterOpen] = useState(false)

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setPage(1)
  }, [filters])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page])

  const activeFilterCount = useMemo(
    () =>
      ['status', 'priority', 'categoryId', 'range'].filter((k) => filters[k]).length +
      (filters.keyword ? 1 : 0),
    [filters]
  )

  const clearFilters = () => {
    setFilters({ status: '', priority: '', categoryId: '', keyword: '', range: '', sort: 'dueAsc' })
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
          <h1 className="page-title dark:text-white">Công việc</h1>
          <p className="mt-1 text-sm font-medium text-navy-400 dark:text-slate-500">
            {data ? `${data.total} công việc` : '…'} · Lên kế hoạch và hoàn thành đúng thời điểm
          </p>
        </div>
        <Link to="/app/tasks/new">
          <Button variant="gradient" icon={Plus}>Tạo công việc</Button>
        </Link>
      </div>

      {/* Thanh tìm kiếm + lọc */}
      <div className="card p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <MagnifyingGlass size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-300" />
            <input
              type="search"
              value={filters.keyword}
              onChange={(e) => setFilters((f) => ({ ...f, keyword: e.target.value }))}
              placeholder="Tìm công việc theo tiêu đề…"
              aria-label="Tìm kiếm công việc"
              className="h-11 w-full rounded-xl border-0 bg-navy-50 pl-10 pr-4 text-sm text-navy-900 ring-1 ring-inset ring-transparent transition placeholder:text-navy-300 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white dark:placeholder:text-slate-400 dark:focus:bg-slate-600"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filters.sort}
              onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}
              aria-label="Sắp xếp"
              className="h-11 cursor-pointer rounded-xl border-0 bg-navy-50 px-3 text-sm font-medium text-navy-700 ring-1 ring-inset ring-navy-100 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setFilterOpen((o) => !o)}
              aria-expanded={filterOpen}
              className="relative flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-navy-50 px-4 text-sm font-semibold text-navy-700 ring-1 ring-inset ring-navy-100 transition hover:bg-navy-100 dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600 dark:hover:bg-slate-600"
            >
              <Funnel size={17} weight="bold" />
              <span className="hidden sm:inline">Lọc</span>
              {activeFilterCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-gradient px-1 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {filterOpen && (
          <div className="mt-3 grid gap-3 border-t border-navy-100 pt-3 sm:grid-cols-4 animate-slide-down dark:border-slate-700">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-navy-500 dark:text-slate-400">Trạng thái</span>
              <select
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                className="h-10 w-full cursor-pointer rounded-lg border-0 bg-navy-50 px-3 text-sm font-medium text-navy-800 ring-1 ring-inset ring-navy-100 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-navy-500 dark:text-slate-400">Ưu tiên</span>
              <select
                value={filters.priority}
                onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
                className="h-10 w-full cursor-pointer rounded-lg border-0 bg-navy-50 px-3 text-sm font-medium text-navy-800 ring-1 ring-inset ring-navy-100 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600"
              >
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-navy-500 dark:text-slate-400">Danh mục</span>
              <select
                value={filters.categoryId}
                onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}
                className="h-10 w-full cursor-pointer rounded-lg border-0 bg-navy-50 px-3 text-sm font-medium text-navy-800 ring-1 ring-inset ring-navy-100 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600"
              >
                <option value="">Tất cả danh mục</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-navy-500 dark:text-slate-400">Khoảng thời gian</span>
              <select
                value={filters.range}
                onChange={(e) => setFilters((f) => ({ ...f, range: e.target.value }))}
                className="h-10 w-full cursor-pointer rounded-lg border-0 bg-navy-50 px-3 text-sm font-medium text-navy-800 ring-1 ring-inset ring-navy-100 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600"
              >
                <option value="">Mọi lúc</option>
                <option value="today">Hôm nay</option>
                <option value="week">7 ngày tới</option>
                <option value="month">30 ngày tới</option>
              </select>
            </label>
          </div>
        )}
      </div>

      {/* Danh sách */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[76px]" />
          ))}
        </div>
      ) : data && data.items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={MagnifyingGlass}
            title={activeFilterCount > 0 ? 'Không có công việc khớp bộ lọc' : 'Chưa có công việc nào'}
            description={
              activeFilterCount > 0
                ? 'Hãy thử xóa bộ lọc hoặc thay đổi từ khóa tìm kiếm.'
                : 'Tạo công việc đầu tiên của bạn để bắt đầu quản lý thời gian.'
            }
            action={
              activeFilterCount > 0 ? (
                <Button variant="secondary" size="sm" icon={X} onClick={clearFilters}>
                  Xóa bộ lọc
                </Button>
              ) : (
                <Link to="/app/tasks/new">
                  <Button variant="gradient" size="sm" icon={Plus}>
                    Tạo công việc mới
                  </Button>
                </Link>
              )
            }
          />
        </div>
      ) : (
        <>
          <div className="space-y-2.5">
            {data?.items.map((t) => (
              <TaskItem key={t.id} task={t} onToggleComplete={toggleComplete} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Phân trang">
              <Button variant="secondary" size="sm" icon={ArrowLeft} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Trước
              </Button>
              <span className="flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-sm font-bold text-navy-700 ring-1 ring-navy-100 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
                <CaretDown size={14} className="hidden" />
                Trang {page} / {totalPages}
              </span>
              <Button variant="secondary" size="sm" icon={ArrowRight} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Sau
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
