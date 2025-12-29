// Push Notification Helper for Frontend
// Include this in your frontend application

class PushNotificationManager {
  constructor(socketUrl = 'http://localhost:3001') {
    this.socketUrl = socketUrl
    this.vapidPublicKey = null
    this.subscription = null
  }

  // Initialize push notifications
  async init(userId) {
    try {
      this.userId = userId
      
      // Check if browser supports push notifications
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Push notifications not supported')
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js')
      console.log('✅ Service Worker registered:', registration)

      // Get VAPID public key from server
      await this.getVapidKey()

      // Request notification permission
      const permission = await this.requestPermission()
      if (permission !== 'granted') {
        throw new Error('Notification permission denied')
      }

      // Subscribe to push notifications
      await this.subscribe(registration)

      console.log('🔔 Push notifications initialized successfully')
      return true

    } catch (error) {
      console.error('❌ Failed to initialize push notifications:', error)
      return false
    }
  }

  // Get VAPID public key from server
  async getVapidKey() {
    try {
      const response = await fetch(`${this.socketUrl}/api/push/vapid-key`)
      const data = await response.json()
      
      if (data.success) {
        this.vapidPublicKey = data.publicKey
        console.log('✅ VAPID key received')
      } else {
        throw new Error('Failed to get VAPID key')
      }
    } catch (error) {
      console.error('❌ Error getting VAPID key:', error)
      throw error
    }
  }

  // Request notification permission
  async requestPermission() {
    const permission = await Notification.requestPermission()
    console.log('🔔 Notification permission:', permission)
    return permission
  }

  // Subscribe to push notifications
  async subscribe(registration) {
    try {
      // Convert VAPID key to Uint8Array
      const applicationServerKey = this.urlBase64ToUint8Array(this.vapidPublicKey)

      // Subscribe to push manager
      this.subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      })

      console.log('✅ Push subscription created:', this.subscription)

      // Send subscription to server
      await this.sendSubscriptionToServer()

    } catch (error) {
      console.error('❌ Error subscribing to push notifications:', error)
      throw error
    }
  }

  // Send subscription to server
  async sendSubscriptionToServer() {
    try {
      const response = await fetch(`${this.socketUrl}/api/push/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: this.userId,
          subscription: this.subscription
        })
      })

      const data = await response.json()
      
      if (data.success) {
        console.log('✅ Subscription sent to server successfully')
      } else {
        throw new Error(data.error || 'Failed to send subscription to server')
      }
    } catch (error) {
      console.error('❌ Error sending subscription to server:', error)
      throw error
    }
  }

  // Test push notification
  async testNotification() {
    try {
      const response = await fetch(`${this.socketUrl}/api/push/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: this.userId
        })
      })

      const data = await response.json()
      console.log('🧪 Test notification result:', data)
      return data
    } catch (error) {
      console.error('❌ Error sending test notification:', error)
      return { success: false, error: error.message }
    }
  }

  // Utility function to convert VAPID key
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  // Check if notifications are supported
  static isSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window
  }

  // Get current permission status
  static getPermissionStatus() {
    return Notification.permission
  }
}

// Usage example:
/*
const pushManager = new PushNotificationManager('http://localhost:3001')

// Initialize for a user
pushManager.init('user_123').then(success => {
  if (success) {
    console.log('Push notifications ready!')
    
    // Test notification
    document.getElementById('test-btn').addEventListener('click', () => {
      pushManager.testNotification()
    })
  }
})
*/

// Make it available globally
window.PushNotificationManager = PushNotificationManager