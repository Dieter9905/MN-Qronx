import { useState } from 'react'

/**
 * Ảnh đại diện người dùng.
 * - Có `src` (vd ảnh từ Google) → hiển thị ảnh
 * - Không có `src`, hoặc ảnh tải lỗi → lùi về chữ cái đầu của tên
 */
export default function Avatar({ name = '?', src = '', size = 'md', className = '' }) {
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

  return (
    <span
      aria-hidden={showImage ? undefined : 'true'}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-gradient font-bold text-white ${sizes[size]} ${className}`}
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
