import crypto from 'node:crypto'
import prisma from '../config/prisma.js'
import ApiError from '../utils/ApiError.js'
import { applyPlanChange } from './billingService.js'
import { isPlanExpired } from '../utils/planLimits.js'
import { startOfDay } from '../utils/dateUtils.js'

// ─── Kinh tế điểm ─────────────────────────────────────────
export const POINTS = {
  DAILY_LOGIN: 10, // đăng nhập mỗi ngày
  STREAK_BONUS: 50, // thưởng mỗi 7 ngày liên tiếp
  INVITE: 100, // bạn bè đăng ký mã mời + đăng nhập lần đầu (kích hoạt)
}

// ─── Bảng giá đổi thưởng ──────────────────────────────────
export const REWARD_TIERS = [
  {
    id: 'plus_7d',
    name: '7 ngày gói Plus',
    description: 'Mở khóa giới hạn Plus trong 7 ngày',
    points: 200,
    plan: 'PLUS',
    days: 7,
  },
  {
    id: 'plus_30d',
    name: '30 ngày gói Plus',
    description: 'Mở khóa giới hạn Plus trong 30 ngày',
    points: 500,
    plan: 'PLUS',
    days: 30,
  },
  {
    id: 'pro_7d',
    name: '7 ngày gói Pro',
    description: 'Toàn bộ tính năng Pro (kể cả AI) trong 7 ngày',
    points: 800,
    plan: 'PRO',
    days: 7,
  },
  {
    id: 'pro_30d',
    name: '30 ngày gói Pro',
    description: 'Toàn bộ tính năng Pro (kể cả AI) trong 30 ngày',
    points: 1500,
    plan: 'PRO',
    days: 30,
  },
]

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // bỏ chữ dễ nhầm (I, O, 0, 1)

function generateInviteCode() {
  const bytes = crypto.randomBytes(6)
  let code = ''
  for (let i = 0; i < 6; i += 1) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  }
  return code
}

/**
 * Đảm bảo user có mã mời riêng (sinh mã duy nhất nếu chưa có).
 */
export async function ensureInviteCode(userId) {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { userId: true, inviteCode: true },
  })
  if (user?.inviteCode) return user.inviteCode

  let code = generateInviteCode()
  // Tránh trùng mã (hiếm gặp, thử lại)
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const exists = await prisma.user.findUnique({ where: { inviteCode: code } })
    if (!exists) break
    code = generateInviteCode()
  }
  await prisma.user.update({ where: { userId }, data: { inviteCode: code } })
  return code
}

/**
 * Cộng điểm đăng nhập hằng ngày (idempotent theo ngày):
 * - Đã nhận hôm nay → không cộng thêm
 * - Hôm qua có đăng nhập → streak +1; ngược lại streak = 1
 * - Mỗi streak đạt bội số 7 → thưởng STREAK_BONUS
 */
export async function creditDailyLogin(user, now = new Date()) {
  const today = startOfDay(now)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const last = user.lastLoginDate ? new Date(user.lastLoginDate) : null
  const lastDay = last ? startOfDay(last) : null

  // Đã nhận điểm hôm nay rồi
  if (lastDay && lastDay.getTime() === today.getTime()) {
    return { credited: false, points: user.points || 0, loginStreak: user.loginStreak || 0 }
  }

  const streak = lastDay && lastDay.getTime() === yesterday.getTime() ? (user.loginStreak || 0) + 1 : 1
  const bonus = streak > 0 && streak % 7 === 0 ? POINTS.STREAK_BONUS : 0
  const points = (user.points || 0) + POINTS.DAILY_LOGIN + bonus

  await prisma.$transaction([
    prisma.user.update({
      where: { userId: user.userId },
      data: { points, loginStreak: streak, lastLoginDate: today },
    }),
    prisma.pointTransaction.create({
      data: { userId: user.userId, amount: POINTS.DAILY_LOGIN, reason: 'DAILY_LOGIN', note: 'Đăng nhập hằng ngày' },
    }),
    ...(bonus > 0
      ? [
          prisma.pointTransaction.create({
            data: {
              userId: user.userId,
              amount: bonus,
              reason: 'STREAK_BONUS',
              note: `Chuỗi ${streak} ngày liên tiếp 🔥`,
            },
          }),
        ]
      : []),
  ])

  return { credited: true, points, loginStreak: streak, lastLoginDate: today, earned: POINTS.DAILY_LOGIN + bonus, bonus }
}

/**
 * Kích hoạt lời mời khi người được mời đăng nhập lần đầu.
 * Chống lạm dụng: 1 IP + 1 thiết bị chỉ tính 1 tài khoản cho cùng người mời
 * (cùng inviter + cùng ip + cùng device đã được thưởng → lời mời này bị REJECTED).
 */
export async function activateInvitation(invitee, ipAddress, deviceId) {
  const inv = await prisma.invitation.findFirst({
    where: { inviteeId: invitee.userId, status: 'PENDING' },
  })
  if (!inv) return { status: 'none' }

  // Trùng IP + thiết bị với một tài khoản đã được thưởng của cùng người mời → không tính
  if (ipAddress && deviceId) {
    const dup = await prisma.invitation.findFirst({
      where: {
        inviterId: inv.inviterId,
        status: 'CREDITED',
        ipAddress,
        deviceId,
      },
    })
    if (dup) {
      await prisma.invitation.update({
        where: { invitationId: inv.invitationId },
        data: { status: 'REJECTED' },
      })
      return { status: 'rejected' }
    }
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { userId: inv.inviterId },
      data: { points: { increment: POINTS.INVITE } },
    }),
    prisma.pointTransaction.create({
      data: {
        userId: inv.inviterId,
        amount: POINTS.INVITE,
        reason: 'INVITE',
        note: `Bạn bè: ${invitee.email}`,
      },
    }),
    prisma.invitation.update({
      where: { invitationId: inv.invitationId },
      data: { status: 'CREDITED', creditedAt: new Date() },
    }),
  ])

  return { status: 'credited' }
}

/**
 * Đổi điểm lấy thưởng: trừ điểm + gia hạn gói (cộng dồn nếu cùng gói còn hạn).
 */
export async function claimReward(userId, tierId) {
  const tier = REWARD_TIERS.find((t) => t.id === tierId)
  if (!tier) throw ApiError.badRequest('Phần thưởng không tồn tại')

  const user = await prisma.user.findUnique({
    where: { userId },
    select: { userId: true, points: true, plan: true, planStartedAt: true, planExpiresAt: true },
  })
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng')
  if (user.points < tier.points) {
    throw ApiError.badRequest(`Chưa đủ điểm (cần ${tier.points} điểm, hiện có ${user.points})`)
  }

  // Chủ gói Pro Doanh nghiệp đổi điểm: KHÔNG được hạ xuống PLUS/PRO — applyPlanChange
  // sẽ viết thẳng users.plan và khi đó scheduler coi nhà đã hết hạn, gỡ hết người
  // trong nhóm. Đổi điểm cho họ đúng nghĩa là "gia hạn nhà thêm N ngày".
  const keepFamily = user.plan === 'BUSINESS' && !isPlanExpired(user)

  // Trừ điểm + ghi lịch sử quyền lợi trong cùng transaction. Đi qua
  // applyPlanChange để gói đổi bằng điểm cũng có dòng Subscription, ngày hết hạn
  // và quy tắc cộng dồn y hệt gói mua bằng tiền.
  const result = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { userId },
      data: { points: { decrement: tier.points } },
    })
    await tx.pointTransaction.create({
      data: {
        userId,
        amount: -tier.points,
        reason: 'REDEEM_REWARD',
        note: `Đổi: ${tier.name}`,
      },
    })
    return applyPlanChange({
      userId,
      plan: keepFamily ? 'BUSINESS' : tier.plan,
      cycle: 'MONTHLY',
      provider: 'REWARD',
      providerRef: tier.id,
      note: `Đổi điểm: ${tier.name}`,
      days: tier.days,
      client: tx,
    })
  })

  return {
    tier,
    plan: result.user.plan,
    planStartedAt: result.user.planStartedAt,
    planExpiresAt: result.user.planExpiresAt,
    remainingPoints: user.points - tier.points,
  }
}

/**
 * Tổng quan trang phần thưởng.
 */
export async function getOverview(userId) {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: {
      userId: true,
      fullName: true,
      email: true,
      points: true,
      loginStreak: true,
      lastLoginDate: true,
      inviteCode: true,
    },
  })
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng')

  const inviteCode = await ensureInviteCode(userId)

  const [invites, transactions, claimed] = await Promise.all([
    prisma.invitation.findMany({
      where: { inviterId: userId },
      include: { invitee: { select: { email: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.pointTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.pointTransaction.findMany({
      where: { userId, reason: 'REDEEM_REWARD' },
      select: { note: true, amount: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const today = startOfDay(new Date())
  const lastDay = user.lastLoginDate ? startOfDay(new Date(user.lastLoginDate)) : null
  const todayClaimed = !!lastDay && lastDay.getTime() === today.getTime()

  return {
    points: user.points,
    loginStreak: user.loginStreak,
    lastLoginDate: user.lastLoginDate,
    todayClaimed,
    nextStreakMilestone: (Math.floor((user.loginStreak || 0) / 7) + 1) * 7,
    inviteCode,
    tiers: REWARD_TIERS.map((t) => ({
      ...t,
      canClaim: user.points >= t.points,
      progress: Math.min(user.points, t.points),
    })),
    claimed,
    invites: invites.map((inv) => ({
      id: inv.invitationId,
      email: inv.invitee.email,
      fullName: inv.invitee.fullName,
      status: inv.status,
      createdAt: inv.createdAt,
      creditedAt: inv.creditedAt,
    })),
    transactions: transactions.map((tx) => ({
      id: tx.pointTransactionId,
      amount: tx.amount,
      reason: tx.reason,
      note: tx.note,
      createdAt: tx.createdAt,
    })),
    rules: {
      dailyLogin: POINTS.DAILY_LOGIN,
      streakBonus: POINTS.STREAK_BONUS,
      invite: POINTS.INVITE,
    },
  }
}

export default {
  POINTS,
  REWARD_TIERS,
  ensureInviteCode,
  creditDailyLogin,
  activateInvitation,
  claimReward,
  getOverview,
}