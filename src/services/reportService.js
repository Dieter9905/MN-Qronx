import api from './apiClient'

// ─── Báo cáo năng suất (gói Pro) ─────────────────────────────
// Backend trả 400 kèm chỉ dẫn nâng cấp nếu gói chưa có quyền — giao diện hiện
// đúng thông điệp đó thay vì tự đoán, để không bao giờ lệch với luật ở server.

export async function getReport({ days = 30 } = {}) {
  return api('GET', '/reports', { query: { days } })
}

/**
 * Nội dung file CSV (mở bằng Excel) — backend trả JSON chứa nội dung file để
 * request đi qua đúng đường có token, thay vì mở tab mới (không kèm token).
 */
export async function exportReport({ days = 30 } = {}) {
  return api('GET', '/reports/export', { query: { days } })
}

/**
 * Tải nội dung báo cáo xuống máy dưới dạng file .csv.
 * Nội dung đã có sẵn BOM + `sep=;` từ server (Excel bản Việt mở là ra đúng cột).
 */
export function downloadCsv({ filename, content }) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'bao-cao-mn-qronx.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Thu hồi URL sau khi trình duyệt kịp bắt đầu tải
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default { getReport, exportReport, downloadCsv }
