// Se suma al service worker de la app: muestra las notificaciones push
// y, al tocarlas, abre (o trae al frente) la app.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Truco', {
      body: data.body || '',
      icon: 'icon-192.png',
      badge: 'favicon.png',
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || './' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || './', self.registration.scope).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.registration.scope))
      if (open) return open.focus()
      return self.clients.openWindow(url)
    })
  )
})
