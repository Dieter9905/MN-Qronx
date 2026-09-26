import api from './apiClient'

// GET /api/v1/plans/me – gói hiện tại (thông tin rút gọn).
// Mua/nâng cấp gói đi qua services/billingService.js — nâng cấp mô phỏng đã bị gỡ.
export async function getMyPlan() {
  return api('GET', '/plans/me')
}
