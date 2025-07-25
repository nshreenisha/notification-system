import webpush from '@/lib/webpush'
import { getSubscription, getAllSubscriptions } from '@/lib/database'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { userId, message, title = 'Notification', broadcast = false } = req.body

    if (!message) {
      return res.status(400).json({ message: 'Message is required' })
    }

    const payload = JSON.stringify({
      title,
      body: message,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      timestamp: Date.now()
    })

    let results = []

    if (broadcast) {
      // Send to all subscribed users
      const allSubscriptions = await getAllSubscriptions()
      
      for (const sub of allSubscriptions) {
        try {
          await webpush.sendNotification(sub.subscription, payload)
          results.push({ userId: sub.userId, status: 'sent' })
        } catch (error) {
          results.push({ userId: sub.userId, status: 'failed', error: error.message })
        }
      }
    } else {
      // Send to specific user
      if (!userId) {
        return res.status(400).json({ message: 'userId is required for non-broadcast messages' })
      }

      const userSub = await getSubscription(userId)
      if (!userSub) {
        return res.status(404).json({ message: 'No subscription found for user' })
      }

      try {
        await webpush.sendNotification(userSub.subscription, payload)
        results.push({ userId, status: 'sent' })
      } catch (error) {
        results.push({ userId, status: 'failed', error: error.message })
      }
    }

    res.status(200).json({ 
      message: 'Push notifications processed',
      results 
    })
  } catch (error) {
    console.error('Error sending push notification:', error)
    res.status(500).json({ message: 'Failed to send push notification' })
  }
}