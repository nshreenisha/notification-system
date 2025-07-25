import { getSocket } from '@/lib/socket'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { userId, message, type = 'info', broadcast = false } = req.body

    if (!message) {
      return res.status(400).json({ message: 'Message is required' })
    }

    const io = getSocket()
    const notificationData = {
      message,
      type,
      timestamp: new Date().toISOString(),
      id: Date.now()
    }

    if (broadcast) {
      // Send to all connected users
      io.emit('notification', notificationData)
    } else {
      // Send to specific user
      if (!userId) {
        return res.status(400).json({ message: 'userId is required for non-broadcast messages' })
      }
      
      io.to(`user-${userId}`).emit('notification', notificationData)
    }

    res.status(200).json({ 
      message: 'Socket notification sent successfully',
      data: notificationData
    })
  } catch (error) {
    console.error('Error sending socket notification:', error)
    res.status(500).json({ message: 'Failed to send socket notification' })
  }
}