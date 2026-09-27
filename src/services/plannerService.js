import api from './apiClient'

// ─── Kế hoạch tuần (gói Pro) ─────────────────────────────────
// Backend trả 400 kèm chỉ dẫn nâng cấp nếu gói chưa có quyền — giao diện hiện
// đúng thông điệp đó thay vì tự đoán luật.

export async function getWeekPlan({ capacity = 5 } = {}) {
  return api('GET', '/planner/week', { query: { capacity } })
}

export default { getWeekPlan }
