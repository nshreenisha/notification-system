// @/lib/web-push-service.js
import webpush from 'web-push'
import * as hybridDB from './hybrid-database.js'

// VAPID keys from your .env
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || 'BHJYTTMMeFHogRBPnFA4bR1ReIiVgi60-fzr6xdjk-6aIAU8Wmg0b3iGzCv481_sDf1IZHRLfj2EyFZh53gq6gQ',
  privateKey: process.env.VAPID_PRIVATE_KEY || 'FBEwXwCqcF1tb7hEGd7BAcSnZMu-6UOcatVDFRPyD0g'
}

// Configure web-push
webpush.setVapidDetails(
  'mailto:your-email@example.com', // Your email
  vapidKeys.publicKey,
  vapidKeys.privateKey
)

// Send push notification to specific user
export async function sendPushNotification(userId, payload) {
  try {
    // Get user's push subscription from database
    const subscription = await hybridDB.getSubscription(userId)
    
    if (!subscription) {
      console.log(`❌ No push subscription found for user ${userId}`)
      return { success: false, error: 'No subscription found' }
    }

    // Prepare notification payload
    const notificationPayload = JSON.stringify({
      title: payload.title || 'Notification',
      body: payload.message || payload.body,
      icon: payload.icon || '/icon-192x192.png',
      badge: payload.badge || '/badge-72x72.png',
      data: {
        url: payload.url || '/',
        userId: userId,
        timestamp: new Date().toISOString(),
        ...payload.data
      },
      actions: payload.actions || [
        {
          action: 'open',
          title: 'Open App'
        },
        {
          action: 'close',
          title: 'Close'
        }
      ]
    })

    // Send push notification
    const result = await webpush.sendNotification(
      subscription.subscription,
      notificationPayload
    )

    console.log(`✅ Push notification sent to user ${userId}:`, payload.title || payload.message)
    return { 
      success: true, 
      result,
      userId,
      message: payload.message || payload.body
    }

  } catch (error) {
    console.error(`❌ Failed to send push notification to user ${userId}:`, error.message)
    
    // If subscription is invalid, remove it from database
    if (error.statusCode === 410 || error.statusCode === 404) {
      console.log(`🗑️ Removing invalid subscription for user ${userId}`)
      await hybridDB.removeSubscription(userId)
    }
    
    return { 
      success: false, 
      error: error.message,
      statusCode: error.statusCode
    }
  }
}

// Send push notification to multiple users
export async function sendPushToMultipleUsers(userIds, payload) {
  const results = []
  
  for (const userId of userIds) {
    const result = await sendPushNotification(userId, payload)
    results.push({ userId, ...result })
  }
  
  const successful = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  
  console.log(`📊 Push notification results: ${successful} successful, ${failed} failed`)
  
  return {
    total: userIds.length,
    successful,
    failed,
    results
  }
}

// Broadcast push notification to all subscribed users
export async function broadcastPushNotification(payload) {
  try {
    const allSubscriptions = await hybridDB.getAllSubscriptions()
    
    if (allSubscriptions.length === 0) {
      console.log('❌ No push subscriptions found for broadcast')
      return { success: false, error: 'No subscriptions found' }
    }

    const userIds = allSubscriptions.map(sub => sub.userId)
    const results = await sendPushToMultipleUsers(userIds, payload)
    
    console.log(`📢 Broadcast push notification sent to ${results.successful}/${results.total} users`)
    
    return {
      success: true,
      broadcast: true,
      ...results
    }
    
  } catch (error) {
    console.error('❌ Failed to broadcast push notification:', error.message)
    return { success: false, error: error.message }
  }
}

// Test push notification
export async function testPushNotification(userId) {
  return await sendPushNotification(userId, {
    title: '🧪 Test Notification',
    message: 'This is a test push notification from your server!',
    icon: '/icon-192x192.png',
    data: {
      test: true,
      timestamp: new Date().toISOString()
    }
  })
}

// Get VAPID public key for frontend
export function getVapidPublicKey() {
  return vapidKeys.publicKey
}