// lib/socket.js - Improved version with duplicate prevention
const { Server } = require('socket.io')

let io
const sentNotifications = new Map() // Track sent notifications to prevent duplicates
const userSockets = new Map() // Track user socket mappings

function initSocket(server) {
  if (!io) {
    // Get allowed origins from environment variables
    const getAllowedOrigins = () => {
      const origins = []
      
      // Add environment-specific origins
      if (process.env.FRONTEND_URL) {
        origins.push(process.env.FRONTEND_URL)
      }
      
      if (process.env.ALLOWED_ORIGINS) {
        origins.push(...process.env.ALLOWED_ORIGINS.split(','))
      }
      
      // Default origins based on environment
      if (process.env.NODE_ENV === 'production') {
        origins.push(
          process.env.PRODUCTION_URL || 'https://yourdomain.com',
          process.env.STAGING_URL || 'https://staging.yourdomain.com'
        )
      } else {
        origins.push(
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'http://192.168.1.33:3000', // Your network IP
          'http://localhost:3001' // In case frontend runs on different port
        )
      }
      
      return origins.filter(Boolean) // Remove undefined values
    }

    io = new Server(server, {
      cors: {
        origin: getAllowedOrigins(),
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    })

    console.log('🔌 Socket.IO server initialized')
    console.log('🌐 Allowed origins:', getAllowedOrigins())

    // Clean up old notifications periodically (prevent memory leaks)
    setInterval(() => {
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000)
      for (const [key, timestamp] of sentNotifications.entries()) {
        if (timestamp < fiveMinutesAgo) {
          sentNotifications.delete(key)
        }
      }
    }, 60000) // Clean every minute

    io.on('connection', (socket) => {
      console.log('✅ Client connected:', socket.id, 'Transport:', socket.conn.transport.name)

      // Store user-socket mapping
      socket.userId = null

      // User joins their personal room
      socket.on('join-user-room', (userId) => {
        if (!userId) {
          socket.emit('join-error', { error: 'User ID is required' })
          return
        }

        // Leave previous room if any
        if (socket.userId) {
          socket.leave(`user-${socket.userId}`)
          userSockets.delete(socket.userId)
        }

        // Join new room
        socket.join(`user-${userId}`)
        socket.userId = userId
        userSockets.set(userId, socket.id)
        
        // Send confirmation back to client
        socket.emit('joined-room', { 
          userId, 
          socketId: socket.id,
          room: `user-${userId}`,
          timestamp: new Date().toISOString()
        })
        
        console.log(`👤 User ${userId} joined room: user-${userId}`)
      })

      // Handle ping/pong for connection testing
      socket.on('ping', (data) => {
        console.log('🏓 Ping received from user:', data?.userId || 'unknown')
        socket.emit('pong', { 
          ...data, 
          pong: true, 
          serverTime: new Date().toISOString(),
          socketId: socket.id
        })
      })

      // Handle test notifications for debugging
      socket.on('test-notification', (data) => {
        console.log('🧪 Test notification received:', data)
        
        const testNotification = {
          id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          message: data.message || 'Test notification',
          type: 'info',
          timestamp: new Date().toISOString(),
          from: 'test-system',
          test: true
        }
        
        // Send back to sender only
        socket.emit('notification', testNotification)
        
        socket.emit('test-notification', { 
          ...data, 
          received: true,
          serverTime: new Date().toISOString(),
          socketId: socket.id,
          testNotification
        })
      })

      // Handle content refresh requests
      socket.on('request-content-refresh', (data) => {
        console.log('🔄 Content refresh request:', data)
        const { page, component, targetUserId } = data
        
        const refreshMessage = {
          type: 'content-refresh',
          page,
          component,
          timestamp: new Date().toISOString(),
          from: 'socket-request'
        }
        
        if (targetUserId) {
          io.to(`user-${targetUserId}`).emit('content-refresh', refreshMessage)
        } else {
          // Send back to requesting client
          socket.emit('content-refresh', refreshMessage)
        }
      })

      // Handle sending notifications to specific users
      socket.on('send-notification', async (data) => {
        try {
          const { targetUserId, message, type = 'info', title } = data
          
          if (!targetUserId || !message) {
            socket.emit('notification-error', {
              error: 'Missing targetUserId or message',
              timestamp: new Date().toISOString()
            })
            return
          }
          
          // Create unique notification ID to prevent duplicates
          const notificationId = `user-${targetUserId}-${Date.now()}-${message.slice(0, 20).replace(/\s+/g, '-')}`
          
          // Check for duplicates
          if (sentNotifications.has(notificationId)) {
            console.log('⚠️ Duplicate notification prevented:', notificationId)
            socket.emit('notification-error', {
              error: 'Duplicate notification prevented',
              notificationId,
              timestamp: new Date().toISOString()
            })
            return
          }
          
          const notification = {
            id: notificationId,
            message,
            type,
            title,
            timestamp: new Date().toISOString(),
            from: socket.userId || 'socket-server',
            read_at: null
          }
          
          // Mark as sent to prevent duplicates
          sentNotifications.set(notificationId, Date.now())
          
          // Emit to specific user's room
          const roomName = `user-${targetUserId}`
          const roomSockets = io.sockets.adapter.rooms.get(roomName)
          
          if (roomSockets && roomSockets.size > 0) {
            io.to(roomName).emit('notification', notification)
            
            // Send confirmation back to sender
            socket.emit('notification-sent', {
              targetUserId,
              success: true,
              timestamp: new Date().toISOString(),
              roomName,
              notificationId,
              roomSize: roomSockets.size
            })

            console.log(`📨 Notification sent to user ${targetUserId}:`, message, `(${roomSockets.size} clients)`)
          } else {
            // User not connected
            socket.emit('notification-error', {
              error: 'Target user not connected',
              targetUserId,
              timestamp: new Date().toISOString()
            })
            console.log(`❌ User ${targetUserId} not connected`)
          }
          
        } catch (error) {
          console.error('❌ Error sending notification:', error)
          socket.emit('notification-error', {
            error: error.message,
            timestamp: new Date().toISOString()
          })
        }
      })

      // Handle broadcasting to all users
      socket.on('broadcast-notification', (data) => {
        try {
          const { message, type = 'info', title } = data
          
          if (!message) {
            socket.emit('broadcast-error', {
              error: 'Missing message',
              timestamp: new Date().toISOString()
            })
            return
          }
          
          // Create unique broadcast ID
          const broadcastId = `broadcast-${Date.now()}-${message.slice(0, 20).replace(/\s+/g, '-')}`
          
          // Check for duplicate broadcasts
          if (sentNotifications.has(broadcastId)) {
            console.log('⚠️ Duplicate broadcast prevented:', broadcastId)
            socket.emit('broadcast-error', {
              error: 'Duplicate broadcast prevented',
              broadcastId,
              timestamp: new Date().toISOString()
            })
            return
          }
          
          const notification = {
            id: broadcastId,
            message,
            type,
            title,
            timestamp: new Date().toISOString(),
            broadcast: true,
            from: socket.userId || 'socket-server',
            read_at: null
          }
          
          // Mark as sent
          sentNotifications.set(broadcastId, Date.now())
          
          io.emit('notification', notification)
          
          // Send confirmation back to sender
          socket.emit('broadcast-sent', {
            success: true,
            timestamp: new Date().toISOString(),
            totalClients: io.engine.clientsCount,
            broadcastId
          })

          console.log('📢 Broadcast notification:', message, `(${io.engine.clientsCount} clients)`)
        } catch (error) {
          console.error('❌ Error broadcasting notification:', error)
          socket.emit('broadcast-error', {
            error: error.message,
            timestamp: new Date().toISOString()
          })
        }
      })

      // Handle getting connection stats
      socket.on('get-stats', () => {
        const stats = getConnectionStats()
        socket.emit('connection-stats', stats)
      })

      // Handle transport upgrades
      socket.conn.on('upgrade', () => {
        console.log('⬆️ Transport upgraded to:', socket.conn.transport.name)
      })

      // Handle errors
      socket.on('error', (error) => {
        console.error('⚠️ Socket error:', error)
      })

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        console.log('❌ Client disconnected:', socket.id, 'Reason:', reason)
        
        // Clean up user mapping
        if (socket.userId) {
          userSockets.delete(socket.userId)
          console.log(`🧹 Cleaned up user mapping for: ${socket.userId}`)
        }
      })

      // Enhanced debugging: Log all events in development
      if (process.env.NODE_ENV !== 'production') {
        const originalOnevent = socket.onevent
        socket.onevent = function(packet) {
          const args = packet.data || []
          const eventName = args[0]
          const eventData = args[1]
          
          // Skip frequent events to reduce noise
          if (!['ping', 'pong', 'heartbeat'].includes(eventName)) {
            console.log(`🔍 Event received: ${eventName}`, eventData ? JSON.stringify(eventData).slice(0, 100) + '...' : '')
          }
          
          originalOnevent.call(this, packet)
        }
      }
    })

    // Global error handler
    io.engine.on('connection_error', (err) => {
      console.error('❌ Connection error:', err.req?.url, err.code, err.message)
    })

    // Log connection stats periodically in development
    if (process.env.NODE_ENV !== 'production') {
      setInterval(() => {
        const clientCount = io.engine.clientsCount
        const userCount = userSockets.size
        const notificationCacheSize = sentNotifications.size
        
        if (clientCount > 0) {
          console.log(`📊 Stats - Connections: ${clientCount}, Users: ${userCount}, Cache: ${notificationCacheSize}`)
        }
      }, 30000) // Every 30 seconds
    }
  }

  return io
}

function getSocket() {
  if (!io) {
    throw new Error('Socket.io not initialized')
  }
  return io
}

// Helper function to get connection stats
function getConnectionStats() {
  if (!io) {
    return { connected: false, clientsCount: 0 }
  }
  
  return {
    connected: true,
    clientsCount: io.engine.clientsCount,
    userCount: userSockets.size,
    rooms: Array.from(io.sockets.adapter.rooms.keys()),
    notificationCache: sentNotifications.size,
    connectedUsers: Array.from(userSockets.keys()),
    timestamp: new Date().toISOString()
  }
}

// Helper function to send notification to specific user (with duplicate prevention)
function sendToUser(userId, message, type = 'info', title = null) {
  if (!io) {
    throw new Error('Socket.io not initialized')
  }
  
  const notificationId = `server-${userId}-${Date.now()}-${message.slice(0, 20).replace(/\s+/g, '-')}`
  
  // Check for duplicates
  if (sentNotifications.has(notificationId)) {
    console.log('⚠️ Duplicate server notification prevented:', notificationId)
    return null
  }
  
  const notification = {
    id: notificationId,
    message,
    type,
    title,
    timestamp: new Date().toISOString(),
    from: 'server-direct',
    read_at: null
  }
  
  // Mark as sent
  sentNotifications.set(notificationId, Date.now())
  
  const roomName = `user-${userId}`
  const roomSockets = io.sockets.adapter.rooms.get(roomName)
  
  if (roomSockets && roomSockets.size > 0) {
    io.to(roomName).emit('notification', notification)
    console.log(`📨 Direct notification sent to user ${userId}:`, message, `(${roomSockets.size} clients)`)
  } else {
    console.log(`❌ User ${userId} not connected for direct notification`)
  }
  
  return notification
}

// Helper function to broadcast to all users (with duplicate prevention)
function broadcastToAll(message, type = 'info', title = null) {
  if (!io) {
    throw new Error('Socket.io not initialized')
  }
  
  const broadcastId = `server-broadcast-${Date.now()}-${message.slice(0, 20).replace(/\s+/g, '-')}`
  
  // Check for duplicates
  if (sentNotifications.has(broadcastId)) {
    console.log('⚠️ Duplicate server broadcast prevented:', broadcastId)
    return null
  }
  
  const notification = {
    id: broadcastId,
    message,
    type,
    title,
    timestamp: new Date().toISOString(),
    broadcast: true,
    from: 'server-direct',
    read_at: null
  }
  
  // Mark as sent
  sentNotifications.set(broadcastId, Date.now())
  
  io.emit('notification', notification)
  console.log('📢 Direct broadcast:', message, `(${io.engine.clientsCount} clients)`)
  
  return notification
}

// Clear notification cache (useful for debugging)
function clearNotificationCache() {
  sentNotifications.clear()
  console.log('🧹 Notification cache cleared')
}

// Export using CommonJS
module.exports = {
  initSocket,
  getSocket,
  getConnectionStats,
  sendToUser,
  broadcastToAll,
  clearNotificationCache
}