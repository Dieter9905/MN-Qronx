import { useEffect, useState } from 'react'

// True khi `active` đã kéo dài quá `ms`.
// Dùng để đổi thông báo khi chờ lâu: thay vì để người dùng nhìn spinner vô nghĩa,
// hiện gợi ý rằng máy chủ đang khởi động (hay gặp với web service gói free).
// Gợi ý dùng chung khi máy chủ phản hồi chậm (web service gói free bị ngủ)
export const SERVER_WAKE_HINT =
  'Máy chủ đang khởi động lại (thường mất 30–60 giây sau một thời gian không sử dụng). Vui lòng đợi — không cần bấm lại.'

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
