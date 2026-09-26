import { useEffect, useState } from 'react'

/**
 * Đếm số tin chưa đọc để hiện huy hiệu trên menu (CSKH).
 *
 * Vì sao 60 giây: huy hiệu chỉ là gợi ý "có gì mới", còn khi người dùng đã ở
 * trong trang hỗ trợ thì vòng làm mới 4 giây lo phần tức thì. Làm mới chậm như
 * vậy tránh đốt request vô ích trên gói máy chủ miễn phí. Tab quay lại foreground
 * thì hỏi ngay một lần để huy hiệu không bị cũ.
 */
export function useUnreadBadge(fetcher, { intervalMs = 60000, enabled = true } = {}) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let alive = true

    const tick = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const res = await fetcher()
        if (alive && res?.success) setCount(res.data?.unread ?? 0)
      } catch {
        /* im lặng — huy hiệu không đáng để làm phiền người dùng */
      }
    }

    tick()
    const id = setInterval(tick, intervalMs)
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)

    // Sau khi người dùng/admin đọc tin trong trang hỗ trợ, các trang đó bắn sự kiện
    // này để huy hiệu về đúng ngay, không phải chờ hết 60 giây.
    const onRead = () => tick()
    window.addEventListener('mnq:support-read', onRead)

    return () => {
      alive = false
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('mnq:support-read', onRead)
    }
  }, [fetcher, intervalMs, enabled])

  return count
}

export default useUnreadBadge
