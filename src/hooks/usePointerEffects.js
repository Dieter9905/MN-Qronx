import { useEffect } from 'react'

/**
 * Hiệu ứng con trỏ dùng chung cho toàn app (chỉ 1 listener, event delegation):
 *
 *  - `[data-spotlight]` và `.card` → đèn rọi chạy theo con trỏ trong phần tử (đặt biến --mx/--my)
 *  - `[data-glow-track]`          → quầng sáng aurora chạy theo con trỏ trong cả khối (đặt --gx/--gy)
 *
 * CSS đọc các biến này để vẽ gradient, nên component không cần state React
 * (không re-render mỗi lần di chuột → giữ UI mượt).
 */
export default function usePointerEffects() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    // Tôn trọng cài đặt giảm chuyển động và thiết bị cảm ứng (không có hover)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    if (window.matchMedia('(hover: none)').matches) return undefined

    let frame = 0
    let pending = null

    const flush = () => {
      frame = 0
      if (!pending) return
      const { el, x, y, mode } = pending
      if (!el.isConnected) return
      if (mode === 'spotlight') {
        el.style.setProperty('--mx', `${x}px`)
        el.style.setProperty('--my', `${y}px`)
      } else {
        el.style.setProperty('--gx', `${x}px`)
        el.style.setProperty('--gy', `${y}px`)
      }
    }

    const onMove = (event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      // .card cũng dùng --mx/--my (xem .card::before trong index.css)
      const spotlightHost = target.closest('[data-spotlight], .card')
      const trackHost = spotlightHost ? null : target.closest('[data-glow-track]')
      const el = spotlightHost || trackHost
      if (!el) return
      const rect = el.getBoundingClientRect()
      pending = {
        el,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        mode: spotlightHost ? 'spotlight' : 'track',
      }
      if (!frame) frame = requestAnimationFrame(flush)
    }

    document.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      document.removeEventListener('pointermove', onMove)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])
}
