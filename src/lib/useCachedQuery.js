import { useCallback, useEffect, useRef, useState } from 'react'
import { sessionUser } from '../services/session'
import { useSlowHint } from './useSlowHint'
import { onTasksChanged } from './dataEvents'

/**
 * Tải dữ liệu kiểu "hiện ngay, làm mới sau" — dành cho backend Render gói free.
 *
 * Web service gói free "ngủ" sau 15 phút không có request; lần mở app kế tiếp
 * request đầu tiên phải chờ máy chủ khởi động 30–60 giây. Nếu màn hình chỉ có
 * skeleton trong suốt thời gian đó thì người dùng thấy như app bị treo.
 *
 * Hook này:
 *  1. Đọc bản lưu trong localStorage ngay khi mount ⇒ lần vào sau hiện dữ liệu
 *     cũ tức thì, không chờ máy chủ.
 *  2. Vẫn gọi API để làm mới ở chế độ ngầm rồi thay số liệu khi có kết quả.
 *  3. Tự thử lại khi lỗi mạng/5xx (đúng lúc máy chủ đang khởi động, proxy
 *     thường trả 502/503) thay vì để người dùng bấm tải lại.
 *  4. Trả `slow` để UI hiện gợi ý "máy chủ đang khởi động" sau 4 giây.
 *
 * Khoá cache được gắn userId để hai tài khoản trên cùng máy không lẫn dữ liệu;
 * `clearQueryCache()` được gọi khi đăng xuất.
 */
const CACHE_PREFIX = 'mnq:cache:'

function storageKey(key) {
  const uid = sessionUser()?.id ?? 'guest'
  return `${CACHE_PREFIX}${uid}:${key}`
}

export function readQueryCache(key) {
  try {
    const raw = localStorage.getItem(storageKey(key))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeQueryCache(key, data) {
  try {
    localStorage.setItem(storageKey(key), JSON.stringify(data))
  } catch {
    /* hết dung lượng / chế độ riêng tư — bỏ qua, chỉ là cache */
  }
}

/** Xoá toàn bộ cache dữ liệu (dùng khi đăng xuất hoặc đổi tài khoản). */
export function clearQueryCache() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(CACHE_PREFIX))
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    /* bỏ qua */
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 429/5xx = lỗi tạm thời của hạ tầng (máy chủ đang khởi động, quá tải) → nên thử
// lại. 4xx còn lại là lỗi nghiệp vụ (hết hạn token, dữ liệu sai) → thử lại vô ích.
const retryable = (status) => status === 429 || status >= 500

export function useCachedQuery(key, fetcher, { retries = 2 } = {}) {
  const [data, setData] = useState(() => readQueryCache(key))
  const [loading, setLoading] = useState(() => !readQueryCache(key))
  const [error, setError] = useState(null)
  // Giữ fetcher trong ref để component truyền hàm inline vẫn không gây vòng lặp
  // gọi lại API mỗi lần render.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const aliveRef = useRef(true)

  const load = useCallback(async () => {
    if (!readQueryCache(key)) setLoading(true)
    let lastMessage = null
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const res = await fetcherRef.current()
        if (res && res.success) {
          if (!aliveRef.current) return true
          setData(res.data)
          setError(null)
          setLoading(false)
          writeQueryCache(key, res.data)
          return true
        }
        lastMessage = res?.message || 'Không tải được dữ liệu.'
        if (!retryable(res?.status)) break
      } catch (err) {
        lastMessage = err?.message || 'Không thể kết nối máy chủ.'
      }
      if (attempt < retries) await sleep(700 * 2 ** attempt)
    }
    if (aliveRef.current) {
      setError(lastMessage)
      setLoading(false)
    }
    return false
  }, [key, retries])

  useEffect(() => {
    aliveRef.current = true
    load()
    return () => {
      aliveRef.current = false
    }
  }, [load])

  // Việc được tạo / sửa / đánh dấu xong ở MỘT màn hình khác (kể cả trên màn hình
  // chuông) thì bản đang hiển thị ở đây phải cũ đi ngay — bản lưu trong cache là
  // để mở app tức thì, không phải để nói dối về dữ liệu vừa đổi.
  useEffect(() => onTasksChanged(load), [load])

  const slow = useSlowHint(loading)

  return { data, loading, error, slow, reload: load }
}

export default useCachedQuery
