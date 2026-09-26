import webPush from 'web-push'
import prisma from '../config/prisma.js'
import config from '../config/index.js'
import ApiError from '../utils/ApiError.js'

// ─── Web Push cho PWA ───────────────────────────────────────
// Đây là mạch sống của app nhắc việc: không có push thì báo thức chỉ kêu khi
// người dùng còn mở tab, còn đóng trình duyệt là im lặng hoàn toàn.
//
// Khoá VAPID lấy từ biến môi trường nếu có; không có thì TỰ SINH một lần và lưu
// vào bảng app_settings — nhờ vậy không phải cấu hình gì thêm khi redeploy, và
// khoá vẫn giữ nguyên qua mọi lần khởi động lại máy chủ.

const VAPID_KEY = 'vapid'
// Nhiều tab/máy là bình thường, nhưng có trần để không bị đăng ký rác tích tụ
const MAX_SUBSCRIPTIONS_PER_USER = 6

let cachedKeys = null

/** Khoá VAPID (đã cấu hình sẵn cho web-push). */
export async function vapidKeys() {
  if (cachedKeys) return cachedKeys

  if (config.vapid.publicKey && config.vapid.privateKey) {
    cachedKeys = {
      publicKey: config.vapid.publicKey,
      privateKey: config.vapid.privateKey,
      subject: config.vapid.email,
      source: 'ENV',
    }
    return cachedKeys
  }

  let row = await prisma.appSetting.findUnique({ where: { key: VAPID_KEY } })
  if (!row) {
    const generated = await webPush.generateVAPIDKeys()
    row = await prisma.appSetting.upsert({
      where: { key: VAPID_KEY },
      update: {},
      create: { key: VAPID_KEY, value: JSON.stringify(generated) },
    })
  }

  const parsed = JSON.parse(row.value)
  cachedKeys = {
    publicKey: parsed.publicKey,
    privateKey: parsed.privateKey,
    subject: config.vapid.email,
    source: 'DB',
  }
  return cachedKeys
}

/** Chuỗi khoá công khai (base64url) để trình duyệt làm `applicationServerKey`. */
export async function getPublicKey() {
  return (await vapidKeys()).publicKey
}

function applyVapid(keys) {
  webPush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey)
}

/**
 * Đăng ký subscription của một người dùng. Upsert theo endpoint nên bấm bật/tắt
 * nhiều lần không sinh bản trùng; giữ tối đa MAX_SUBSCRIPTIONS_PER_USER bản mới
 * nhất (mỗi tab/máy một endpoint).
 */
export async function subscribe(userId, { endpoint, keys }, userAgent = null) {
  if (!endpoint || typeof endpoint !== 'string' || !/^https:\/\//i.test(endpoint)) {
    throw ApiError.badRequest('Endpoint không hợp lệ (phải là https)')
  }
  if (!keys?.p256dh || !keys?.auth) {
    throw ApiError.badRequest('Thiếu khoá mã hoá p256dh/auth của subscription')
  }

  const data = {
    userId,
    p256dh: String(keys.p256dh),
    auth: String(keys.auth),
    userAgent: userAgent ? String(userAgent).slice(0, 300) : null,
  }

  const row = await prisma.webPushSubscription.upsert({
    where: { endpoint: String(endpoint).slice(0, 500) },
    update: data,
    create: { endpoint: String(endpoint).slice(0, 500), ...data },
  })

  // Trần số lượng: giữ các bản mới nhất, xoá bản thừa
  const mine = await prisma.webPushSubscription.findMany({
    where: { userId },
    orderBy: { subscriptionId: 'desc' },
    select: { subscriptionId: true },
  })
  const overflow = mine.slice(MAX_SUBSCRIPTIONS_PER_USER)
  if (overflow.length > 0) {
    await prisma.webPushSubscription.deleteMany({
      where: { subscriptionId: { in: overflow.map((o) => o.subscriptionId) } },
    })
  }

  return { subscriptionId: row.subscriptionId, endpoint: row.endpoint }
}

/** Huỷ đăng ký (chỉ của chính người gọi — không xoá được subscription của người khác). */
export async function unsubscribe(userId, endpoint) {
  const res = await prisma.webPushSubscription.deleteMany({
    where: { endpoint: String(endpoint || ''), userId },
  })
  return res.count > 0
}

/** Gửi cho MỘT subscription; endpoint đã chết (410/404) thì xoá khỏi DB. */
async function sendToSubscription(sub, payload) {
  try {
    const keys = await vapidKeys()
    applyVapid(keys)
    await webPush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    )
    await prisma.webPushSubscription.update({
      where: { subscriptionId: sub.subscriptionId },
      data: { lastUsedAt: new Date() },
    })
    return { ok: true }
  } catch (err) {
    const status = err?.statusCode
    // Trình duyệt trả lời "subscription không còn nữa" → dọn để không gửi mãi
    if (status === 404 || status === 410) {
      await prisma.webPushSubscription
        .delete({ where: { subscriptionId: sub.subscriptionId } })
        .catch(() => {})
      return { ok: false, removed: true }
    }
    console.error(`[WebPush] Lỗi gửi: ${err.message}`)
    return { ok: false, error: err.message }
  }
}

/**
 * Gửi push cho tất cả thiết bị của một người.
 * @param {number} userId
 * @param {{title: string, body: string, url?: string, tag?: string, taskId?: number}} payload
 */
export async function pushToUser(userId, payload) {
  const subs = await prisma.webPushSubscription.findMany({ where: { userId } })
  if (subs.length === 0) return { total: 0, ok: 0 }

  let ok = 0
  for (const sub of subs) {
    const result = await sendToSubscription(sub, payload)
    if (result.ok) ok += 1
  }
  return { total: subs.length, ok }
}

/** Số subscription của một người (dùng cho test và cho giao diện hiển thị). */
export async function countSubscriptions(userId) {
  return prisma.webPushSubscription.count({ where: { userId } })
}
