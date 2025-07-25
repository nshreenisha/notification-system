import { getSubscription } from '@/lib/database'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { userId } = req.query

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' })
    }

    const subscription = await getSubscription(userId)
    
    res.status(200).json({ 
      isRegistered: !!subscription,
      userId,
      registeredAt: subscription?.createdAt || null
    })
  } catch (error) {
    console.error('Error checking registration:', error)
    res.status(500).json({ message: 'Failed to check registration' })
  }
}