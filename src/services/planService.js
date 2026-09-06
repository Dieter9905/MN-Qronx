import api from './apiClient'

// PUT /api/v1/plans/upgrade – nâng cấp gói (mô phỏng thanh toán)
export async function upgradePlan(plan) {
  return api('PUT', '/plans/upgrade', { body: { plan } })
}

// GET /api/v1/plans/me – gói hiện tại
export async function getMyPlan() {
  return api('GET', '/plans/me')
}