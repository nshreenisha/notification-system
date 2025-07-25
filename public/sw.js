// public/sw.js
const CACHE_NAME = 'notification-system-v1'

// Install service worker
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...')
  self.skipWaiting()
})

// Activate service worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...')
  event.waitUntil(self.clients.claim())
})

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event)
  
  let payload = {}
  
  try {
    payload = event.data ? event.data.json() : {}
  } catch (error) {
    payload = {
      title: 'Notification',
      body: event.data ? event.data.text() : 'You have a new notification'
    }
  }

  const options = {
    body: payload.body || 'You have a new notification',
    icon: payload.icon || '/icon-192x192.png',
    badge: payload.badge || '/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      timestamp: payload.timestamp || Date.now(),
      url: payload.url || '/'
    },
    actions: [
      {
        action: 'open',
        title: 'Open App',
        icon: '/checkmark.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/xmark.png'
      }
    ],
    requireInteraction: true,
    tag: 'notification-' + (payload.timestamp || Date.now())
  }

  event.waitUntil(
    self.registration.showNotification(
      payload.title || 'Notification',
      options
    )
  )
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event)
  
  event.notification.close()

  if (event.action === 'close') {
    return
  }

  // Open the app
  event.waitUntil(
    self.clients.matchAll().then((clients) => {
      // Check if app is already open
      for (const client of clients) {
        if (client.url === self.location.origin && 'focus' in client) {
          return client.focus()
        }
      }
      
      // Open new window if app is not open
      if (self.clients.openWindow) {
        return self.clients.openWindow('/')
      }
    })
  )
})