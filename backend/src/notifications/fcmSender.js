import admin from 'firebase-admin'
import config from '../config/index.js'

// ─── Initialize Firebase Admin ─────────────────────────

let initialized = false

function ensureInit() {
  if (initialized) return

  if (!config.fcm.projectId || !config.fcm.privateKey || !config.fcm.clientEmail) {
    console.warn('[FCM] Firebase credentials not configured – skipping FCM')
    return
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: config.fcm.projectId,
      privateKey: config.fcm.privateKey.replace(/\n/g, '\n'),
      clientEmail: config.fcm.clientEmail,
    }),
  })

  initialized = true
}

// ─── Send FCM Notification ─────────────────────────────

/**
 * Send a push notification via Firebase Cloud Messaging.
 * @param {string} token   FCM device token
 * @param {object} payload { title, body, taskId, reminderId }
 */
export async function sendFcmNotification(token, payload) {
  ensureInit()
  if (!initialized) return

  const message = {
    token,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: {
      taskId: String(payload.taskId),
      reminderId: String(payload.reminderId),
    },
  }

  await admin.messaging().send(message)
}
