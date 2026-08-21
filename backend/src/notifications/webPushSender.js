import webPush from 'web-push'
import config from '../config/index.js'

// ─── Initialize VAPID ──────────────────────────────────

const vapidConfigured =
  config.vapid.publicKey && config.vapid.privateKey

if (vapidConfigured) {
  webPush.setVapidDetails(
    config.vapid.email,
    config.vapid.publicKey,
    config.vapid.privateKey,
  )
}

// ─── Send Web Push ─────────────────────────────────────

/**
 * Send a push notification via Web Push (VAPID).
 * @param {string} endpoint  Push subscription endpoint
 * @param {object} payload   { title, body, taskId, reminderId }
 * @param {string} keys      JSON string of { p256dh, auth } keys
 */
export async function sendPushNotification(endpoint, payload, keys) {
  if (!vapidConfigured) {
    console.warn('[WebPush] VAPID not configured – skipping push')
    return
  }

  const subscription = {
    endpoint,
    keys: typeof keys === 'string' ? JSON.parse(keys) : keys,
  }

  const data = JSON.stringify({
    title: payload.title,
    body: payload.body,
    data: { taskId: payload.taskId, reminderId: payload.reminderId },
  })

  await webPush.sendNotification(subscription, data)
}
