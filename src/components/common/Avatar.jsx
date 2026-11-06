import { useState } from 'react'

/**
 * Ảnh đại diện người dùng.
 * - Có `src` (vd ảnh từ Google) → hiển thị ảnh
 * - Không có `src`, hoặc ảnh tải lỗi → lùi về chữ cái đầu của tên
 */
// `skin="room"` (tùy chọn, thêm ở mốc 6): đĩa giấy Oat + ring Acorn cho thế
// giới phòng — mặc định vẫn là da navy cũ để trang ngoài mốc này không đổi
// diện mạo (nguyên tắc additive, như Modal skin="room").
export default function Avatar({ name = '?', src = '', size = 'md', className = '', skin }) {
  const [failed, setFailed] = useState(false)

  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-16 w-16 text-xl',
    xl: 'h-20 w-20 text-2xl',
  }
  const initials = String(name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  const showImage = Boolean(src) && !failed
  const tone =
    skin === 'room'
      ? 'bg-room-oat font-bold text-room-ink ring-1 ring-inset ring-room-acorn/25'
      : 'bg-brand-gradient font-bold text-white'

  return (
    <span
      aria-hidden={showImage ? undefined : 'true'}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${tone} ${sizes[size]} ${className}`}
    >
      {showImage ? (
        <img
          src={src}
          alt={name ? `Ảnh đại diện của ${name}` : 'Ảnh đại diện'}
          loading="lazy"
          // Ảnh Google (googleusercontent.com) không hiển thị nếu trình duyệt
          // gửi kèm referrer của trang → phải tắt referrer.
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initials
      )}
    </span>
  )
}
