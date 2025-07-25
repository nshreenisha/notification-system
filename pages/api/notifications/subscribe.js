import { addSubscription } from '@/lib/database'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { userId, subscription } = req.body

    if (!userId || !subscription) {
      return res.status(400).json({ message: 'Missing userId or subscription' })
    }

    await addSubscription(userId, subscription)
    
    res.status(201).json({ 
      message: 'Subscription saved successfully',
      userId 
    })
  } catch (error) {
    console.error('Error saving subscription:', error)
    res.status(500).json({ message: 'Failed to save subscription' })
  }
}