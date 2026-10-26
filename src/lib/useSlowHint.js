import { useEffect, useState } from 'react'

// True khi `active` đã kéo dài quá `ms`.
// Dùng để đổi thông báo khi chờ lâu: thay spinner vô nghĩa bằng gợi ý có
// hành động cụ thể. Máy chủ (VPS) luôn chạy 24/7 — chậm gần như chắc chắn
// ở chặng mạng giữa người dùng và VPS (IP nhà mạng đôi lúc xoay giữa chừng).
export const SERVER_WAKE_HINT =
  'Vẫn đang chờ phản hồi — mạng giữa bạn và máy chủ có thể gián đoạn thoáng qua (IP nhà mạng đôi khi xoay giữa chừng). Nếu quá 15 giây, bấm thử lại nhé.'

export function useSlowHint(active, ms = 4000) {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (!active) {
      setSlow(false)
      return undefined
    }
    const timer = setTimeout(() => setSlow(true), ms)
    return () => clearTimeout(timer)
  }, [active, ms])

  return slow
}

export default useSlowHint
