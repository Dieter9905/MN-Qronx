/**
 * "Dữ liệu công việc vừa thay đổi" — một kênh duy nhất để mọi màn hình đang mở
 * tự tải lại.
 *
 * Vì sao cần: chuông báo thức phủ TOÀN MÀN HÌNH và việc được đánh dấu xong ngay
 * tại đó. Khi khách bấm "Đã xong việc", trang nằm phía sau (danh sách việc, Kế
 * hoạch tuần, Báo cáo, Dashboard) vẫn đang giữ dữ liệu cũ — khách quay lại thấy
 * đúng cái việc mình vừa làm xong vẫn nằm đó, tưởng nút không có tác dụng.
 *
 * Trước đây việc này chỉ được xử lý bằng cách tải lại ở từng trang (mỗi trang tự
 * gọi lại API sau thao tác của chính nó), nên thao tác ở MÀN HÌNH KHÁC không bao
 * giờ tới được các trang còn lại. Một kênh chung giải quyết đúng chỗ đó.
 *
 * Cách dùng:
 *   - nơi ĐỔI dữ liệu (services/taskService): gọi `notifyTasksChanged()` sau khi
 *     máy chủ trả về thành công;
 *   - nơi HIỂN THỊ dữ liệu: `useEffect(() => onTasksChanged(reload), [reload])`.
 *
 * Tên sự kiện theo đúng quy ước `mnq:*` đã dùng cho các tín hiệu nội bộ khác
 * (vd `mnq:support-read`), nhưng gói trong hai hàm để không ai gõ sai chuỗi.
 */
const TASKS_CHANGED = 'mnq:tasks-changed'

/** Báo cho mọi màn hình đang mở biết dữ liệu việc vừa thay đổi. */
export function notifyTasksChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(TASKS_CHANGED))
}

/**
 * Nghe tín hiệu trên. Trả về hàm huỷ đăng ký (dùng luôn cho `useEffect`).
 * @param {() => void} handler
 */
export function onTasksChanged(handler) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(TASKS_CHANGED, handler)
  return () => window.removeEventListener(TASKS_CHANGED, handler)
}

export default { notifyTasksChanged, onTasksChanged }
