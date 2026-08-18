import { useEffect, useState } from 'react'
import { Plus, PencilSimple, EyeSlash, Eye, FolderSimple, Check } from '@phosphor-icons/react'
import { getCategories, createCategory, updateCategory, setCategoryActive } from '../../services/categoryService'
import { useToast } from '../../components/common/Toast'
import { Skeleton, EmptyState } from '../../components/common/Feedback'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import { Field, Input, ColorPicker } from '../../components/common/Inputs'
import { CATEGORY_COLORS } from '../../lib/constants'

export default function CategoriesPage() {
  const toast = useToast()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', color: CATEGORY_COLORS[0] })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const res = await getCategories()
    if (res.success) setCategories(res.data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', color: CATEGORY_COLORS[0] })
    setModalOpen(true)
  }

  const openEdit = (cat) => {
    setEditing(cat)
    setForm({ name: cat.name, color: cat.color })
    setModalOpen(true)
  }

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Vui lòng nhập tên danh mục')
      return
    }
    setSaving(true)
    const res = editing
      ? await updateCategory(editing.id, { categoryName: form.name, colorCode: form.color })
      : await createCategory({ categoryName: form.name, colorCode: form.color })
    setSaving(false)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success(res.message)
    setModalOpen(false)
    load()
  }

  const toggleActive = async (cat) => {
    const res = await setCategoryActive(cat.id, !cat.isActive)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success(res.message)
    load()
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Danh mục</h1>
          <p className="mt-1 text-sm font-medium text-navy-400">
            Nhóm công việc theo lĩnh vực để theo dõi dễ dàng hơn
          </p>
        </div>
        <Button variant="gradient" icon={Plus} onClick={openCreate}>Danh mục mới</Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={FolderSimple}
            title="Chưa có danh mục nào"
            description="Tạo danh mục đầu tiên để phân loại công việc của bạn."
            action={
              <Button variant="gradient" size="sm" icon={Plus} onClick={openCreate}>
                Tạo danh mục
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className={`card group p-5 transition-all duration-200 hover:shadow-card-hover ${!cat.isActive ? 'opacity-55' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-sm"
                  style={{ backgroundColor: cat.color }}
                >
                  <FolderSimple size={22} weight="duotone" />
                </span>
                <div className="flex gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => openEdit(cat)}
                    aria-label={`Sửa danh mục ${cat.name}`}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-navy-400 transition hover:bg-navy-100 hover:text-navy-700"
                  >
                    <PencilSimple size={17} weight="bold" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleActive(cat)}
                    aria-label={cat.isActive ? `Ẩn danh mục ${cat.name}` : `Hiện danh mục ${cat.name}`}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-navy-400 transition hover:bg-navy-100 hover:text-navy-700"
                  >
                    {cat.isActive ? <EyeSlash size={17} weight="bold" /> : <Eye size={17} weight="bold" />}
                  </button>
                </div>
              </div>
              <h3 className="mt-4 flex items-center gap-2 font-bold text-navy-900">
                {cat.name}
                {!cat.isActive && (
                  <span className="rounded-full bg-navy-100 px-2 py-0.5 text-[10px] font-bold text-navy-500">Đã ẩn</span>
                )}
              </h3>
              <p className="mt-1 text-sm text-navy-400">{cat.taskCount} công việc</p>
              <div className="mt-3 h-1.5 rounded-full bg-navy-100" style={{ width: `${Math.min(100, cat.taskCount * 14)}%` }}>
                <div className="h-full rounded-full" style={{ backgroundColor: cat.color, width: '100%' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Sửa danh mục' : 'Tạo danh mục mới'}
        description="Tên danh mục và màu hiển thị trên lịch & danh sách công việc."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Hủy</Button>
            <Button variant="gradient" icon={Check} onClick={save} loading={saving}>
              {editing ? 'Lưu thay đổi' : 'Tạo danh mục'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Tên danh mục" required>
            {(fid) => (
              <Input
                id={fid}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ví dụ: Sức khỏe"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && save()}
              />
            )}
          </Field>
          <Field label="Màu hiển thị">
            <ColorPicker colors={CATEGORY_COLORS} value={form.color} onChange={(color) => setForm((f) => ({ ...f, color }))} />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
