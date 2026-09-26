/**
 * Service worker của MN-Qronx.
 *
 * Ba việc, theo thứ tự quan trọng:
 *  1. Push: hiện thông báo HỆ THỐNG khi máy chủ gửi — nhờ vậy nhắc nhở vẫn kêu
 *     khi người dùng đã đóng tab/trình duyệt (điều app nhắc việc từng không làm được).
 *  2. notificationclick: bấm vào thông báo là mở/focus cửa sổ app đúng trang.
 *  3. Offline: giữ trang mở được khi mất mạng — app shell lưu lại, tài sản tĩnh
 *     dùng lại bản đã cache, API thì KHÔNG BAO GIỜ cache để không hiện dữ liệu cũ.
 */
const VERSION = 'mnq-shell-v1'
const SHELL = ['/index.html']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// ─── 1. Nhận push từ máy chủ ────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }

  const title = data.title || 'MN-Qronx'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'mnq-reminder',
      renotify: true,
      vibrate: [200, 120, 200],
      requireInteraction: false,
      data: { url: data.url || '/app' },
    })
  )
})

// ─── 2. Bấm vào thông báo ───────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/app'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})

// Trình duyệt đổi subscription (Chrome cấp endpoint mới định kỳ) → báo cho trang
// đang mở đăng ký lại. Trang cũng tự đăng ký lại mỗi lần mở app nên không bị lệch.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => clients.forEach((client) => client.postMessage({ type: 'pushsubscriptionchange' })))
  )
})

// ─── 3. Offline ─────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // không đụng tới bên thứ ba
  if (url.pathname.startsWith('/api/')) return // API: chỉ mạng, không cache

  // Trang (SPA): thử mạng trước, mất mạng thì trả app shell đã lưu
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(VERSION).then((cache) => cache.put('/index.html', copy)).catch(() => {})
          return response
        })
        .catch(() => caches.match('/index.html').then((cached) => cached || Response.error()))
    )
    return
  }

  // Tài sản tĩnh (JS/CSS/icon đã băm theo tên): cache trước, thiếu thì tải rồi lưu
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || /\.(?:svg|png|json|webmanifest|css|js)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => {})
            }
            return response
          })
      )
    )
  }
})
