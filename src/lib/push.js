import api from '../services/apiClient'

// ─── Web Push cho trình duyệt ───────────────────────────────
// Máy chủ gửi push → service worker hiện thông báo HỆ THỐNG → nhắc nhở vẫn kêu
// khi người dùng đã đóng tab. Trước đây app chỉ poll mỗi 60 giây nên đóng trình
// duyệt là im lặng hoàn toàn.

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in window.navigator &&
    'PushManager' in window.navigator &&
    'Notification' in window
  )
}

async function subscribeWithBackend() {
  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()

  if (!subscription) {
    const res = await api('GET', '/devices/push/key')
    if (!res.success || !res.data?.publicKey) {
      throw new Error(res.message || 'Không lấy được khoá thông báo từ máy chủ')
    }
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(res.data.publicKey),
    })
  }

  const json = subscription.toJSON()
  const saved = await api('POST', '/devices/push', {
    body: { endpoint: json.endpoint, keys: json.keys },
  })
  return { subscription, saved }
}

/** Bật thông báo: xin quyền rồi đăng ký subscription với máy chủ. */
export async function enablePush() {
  if (!pushSupported()) {
    return { success: false, status: 'unsupported', message: 'Trình duyệt này không hỗ trợ thông báo đẩy' }
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return {
      success: false,
      status: permission,
      message:
        permission === 'denied'
          ? 'Bạn đã chặn thông báo — hãy mở cài đặt trình duyệt và cho phép trang này'
          : 'Chưa cho phép thông báo nên nhắc nhở sẽ không kêu khi đóng tab',
    }
  }

  try {
    const { saved } = await subscribeWithBackend()
    return { success: saved.success, status: 'granted', message: saved.message || 'Đã bật thông báo đẩy' }
  } catch (err) {
    return { success: false, status: 'granted', message: err.message }
  }
}

/** Tắt thông báo cho máy/tab này. */
export async function disablePush() {
  if (!pushSupported()) return { success: true, status: 'unsupported', message: 'Trình duyệt không hỗ trợ' }

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      await api('POST', '/devices/push/unsubscribe', { body: { endpoint: subscription.endpoint } })
      await subscription.unsubscribe()
    }
    return { success: true, status: Notification.permission, message: 'Đã tắt thông báo đẩy' }
  } catch (err) {
    return { success: false, status: Notification.permission, message: err.message }
  }
}

/** Trạng thái hiện tại để giao diện hiển thị. */
export async function pushStatus() {
  if (!pushSupported()) return { supported: false, permission: 'unsupported', subscribed: false }
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    return {
      supported: true,
      permission: Notification.permission,
      subscribed: Boolean(subscription),
    }
  } catch {
    return { supported: true, permission: Notification.permission, subscribed: false }
  }
}

/**
 * Gọi mỗi lần mở app khi người dùng ĐÃ cho phép thông báo: đăng ký lại subscription
 * (endpoint có thể đã đổi) để máy chủ không gửi vào địa chỉ cũ.
 */
export async function syncPushSubscription() {
  try {
    if (!pushSupported() || Notification.permission !== 'granted') return
    await subscribeWithBackend()
  } catch {
    /* âm thầm — không chặn app vì lỗi thông báo */
  }
}
