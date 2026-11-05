import { useEffect, useState } from 'react'
import { Plus, PencilSimple, EyeSlash, Eye, FolderSimple, Check } from '@phosphor-icons/react'
import { getCategories, createCategory, updateCategory, setCategoryActive } from '../../services/categoryService'
import { useToast } from '../../components/common/Toast'
import Modal from '../../components/common/Modal'
import { RoomButton, RoomCard, RoomEmpty, RoomField, RoomInput, RoomSkeleton } from '../../components/common/RoomUI'
import { CATEGORY_COLORS } from '../../lib/constants'

// Trình chọn màu của thế giới phòng: các ô màu là DỮ LIỆU (CATEGORY_COLORS,
// hiện trên lịch & đĩa danh mục) nên màu chọn giữ nguyên — chỉ thay vành chọn
// navy thành ring Acorn trên giấy, và khung picker tự vẽ thay ColorPicker navy
// của Inputs.jsx (đang phục vụ phần app-shell cũ).
function RoomColorPicker({ colors, value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Chọn màu" className="flex flex-wrap gap-2">
      {colors.map((color) => {
        const selected = value === color
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`Màu ${color}`}
            onClick={() => onChange(color)}
            className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full ring-offset-2 ring-offset-room-paper transition-all duration-200 hover:-translate-y-0.5 hover:scale-110 active:scale-95 focus-visible:outline-none ${
              selected ? 'scale-110 ring-2 ring-room-acorn' : ''
            }`}
            style={{ backgroundColor: color }}
          >
            {selected && <Check size={18} weight="bold" className="text-white" aria-hidden="true" />}
          </button>
        )
      })}
    </div>
  )
}

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
          <h1 className="font-display text-2xl font-bold text-room-ink">Danh mục</h1>
          <p className="mt-1 text-sm font-semibold text-room-ink/50">
            Nhóm công việc theo lĩnh vực để theo dõi dễ dàng hơn
          </p>
        </div>
        <RoomButton icon={Plus} onClick={openCreate}>Danh mục mới</RoomButton>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <RoomSkeleton key={i} className="h-36" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <RoomCard className="p-6">
          <RoomEmpty
            icon={FolderSimple}
            title="Chưa có danh mục nào"
            description="Tạo danh mục đầu tiên để phân loại công việc của bạn."
            action={
              <RoomButton size="sm" icon={Plus} onClick={openCreate}>
                Tạo danh mục
              </RoomButton>
            }
          />
        </RoomCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <RoomCard
              key={cat.id}
              className={`group p-5 transition hover:ring-room-acorn/50 ${!cat.isActive ? 'opacity-55' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-white ring-1 ring-inset ring-black/10"
                  style={{ backgroundColor: cat.color }}
                >
                  <FolderSimple size={22} weight="duotone" />
                </span>
                <div className="flex gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => openEdit(cat)}
                    aria-label={`Sửa danh mục ${cat.name}`}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-room-ink/35 transition hover:bg-room-oat/75 hover:text-room-ink"
                  >
                    <PencilSimple size={17} weight="bold" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleActive(cat)}
                    aria-label={cat.isActive ? `Ẩn danh mục ${cat.name}` : `Hiện danh mục ${cat.name}`}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-room-ink/35 transition hover:bg-room-oat/75 hover:text-room-ink"
                  >
                    {cat.isActive ? <EyeSlash size={17} weight="bold" /> : <Eye size={17} weight="bold" />}
                  </button>
                </div>
              </div>
              <h3 className="mt-4 flex items-center gap-2 font-display font-bold text-room-ink">
                {cat.name}
                {!cat.isActive && (
                  <span className="rounded-full bg-room-oat/70 px-2 py-0.5 text-[10px] font-extrabold text-room-ink/55">
                    Đã ẩn
                  </span>
                )}
              </h3>
              <p className="mt-1 text-sm font-semibold text-room-ink/45">{cat.taskCount} công việc</p>
              <div className="mt-3 h-1.5 rounded-full bg-room-oat/70" style={{ width: `${Math.min(100, cat.taskCount * 14)}%` }}>
                {/* Thanh đếm dùng màu của danh mục — dữ liệu giữ nguyên, chỉ thay track Oat */}
                <div className="h-full rounded-full" style={{ backgroundColor: cat.color, width: '100%' }} />
              </div>
            </RoomCard>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Sửa danh mục' : 'Tạo danh mục mới'}
        description="Tên danh mục và màu hiển thị trên lịch & danh sách công việc."
        size="sm"
        skin="room"
        footer={
          <>
            <RoomButton variant="secondary" onClick={() => setModalOpen(false)}>Hủy</RoomButton>
            <RoomButton icon={Check} onClick={save} loading={saving}>
              {editing ? 'Lưu thay đổi' : 'Tạo danh mục'}
            </RoomButton>
          </>
        }
      >
        <div className="space-y-4">
          <RoomField label="Tên danh mục" required>
            {(fid) => (
              <RoomInput
                id={fid}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ví dụ: Sức khỏe"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && save()}
              />
            )}
          </RoomField>
          <RoomField label="Màu hiển thị">
            <RoomColorPicker colors={CATEGORY_COLORS} value={form.color} onChange={(color) => setForm((f) => ({ ...f, color }))} />
          </RoomField>
        </div>
      </Modal>
    </div>
  )
}
