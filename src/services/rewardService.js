import api from './apiClient'

// GET /api/v1/rewards/overview
export async function getRewardsOverview() {
  return api('GET', '/rewards/overview')
}

// POST /api/v1/rewards/claim
export async function claimReward(tierId) {
  return api('POST', '/rewards/claim', { body: { tierId } })
}

export function buildInviteLink(inviteCode) {
  if (!inviteCode) return ''
  return `${window.location.origin}/register?invite=${inviteCode}`
}