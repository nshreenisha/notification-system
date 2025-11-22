// server.js - Complete version with Content Refresh APIs
const { createServer } = require('http')
const path = require('path')

// Load environment variables from .env.local
require('dotenv').config({ path: path.resolve(__dirname, '.env.local') })

// Import your existing socket library (use relative path, not @/ alias)
const { initSocket, getConnectionStats } = require('./lib/socket')

const PORT = process.env.PORT || 3001

console.log('🚀 Starting Socket.IO server...')
console.log(`📍 Port: ${PORT}`)
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
console.log(`📂 Working directory: ${process.cwd()}`)

// Create HTTP server
const httpServer = createServer()

// Helper function to parse JSON body
const parseJsonBody = (req) => {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk.toString()
    })
    req.on('end', () => {
      try {
        if (!body || body.trim() === '') {
          resolve({})
          return
        }
        
        // Log the raw body for debugging
        console.log('📥 Received body:', JSON.stringify(body))
        console.log('📥 Body length:', body.length)
        console.log('📥 First 50 chars:', body.substring(0, 50))
        
        // Try to parse JSON
        const parsed = JSON.parse(body)
        resolve(parsed)
      } catch (error) {
        console.error('❌ JSON Parse Error:')
        console.error('   Error:', error.message)
        console.error('   Body received:', JSON.stringify(body))
        console.error('   Body preview:', body.substring(0, 100))
        console.error('   Body type:', typeof body)
        reject(error)
      }
    })
    
    req.on('error', (error) => {
      console.error('❌ Request error:', error)
      reject(error)
    })
  })
}

// Add request handler for health checks and API routes
httpServer.on('request', async (req, res) => {
  // Parse URL
  const url = new URL(req.url, `http://${req.headers.host}`)
  
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }
  
  // Route handling
  try {
    switch (url.pathname) {
      case '/health':
        const stats = getConnectionStats()
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ 
          status: 'ok', 
          port: PORT,
          environment: process.env.NODE_ENV || 'development',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          ...stats
        }, null, 2))
        break

      // API: Send notification to specific user
      case '/api/notifications/send':
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          break
        }

        let sendData
        try {
          sendData = await parseJsonBody(req)
        } catch (parseError) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ 
            error: 'Invalid JSON format',
            message: parseError.message,
            hint: 'Make sure your JSON is valid. Check for: missing quotes, trailing commas, or invalid characters.',
            example: {
              userId: '1',
              message: 'Your message here',
              type: 'info'
            }
          }))
          break
        }
        
        const { userId: notificationUserId, message, type = 'info' } = sendData

        if (!notificationUserId || !message) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ 
            error: 'Missing required fields: userId, message',
            received: sendData
          }))
          break
        }

        const notification = {
          message,
          type,
          timestamp: new Date().toISOString(),
          id: Date.now(),
          from: 'api'
        }

        // Send via Socket.IO
        io.to(`user-${notificationUserId}`).emit('notification', notification)
        
        console.log(`📨 API notification sent to user ${notificationUserId}:`, message)
        
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: true,
          message: 'Notification sent',
          targetUser: notificationUserId,
          notification,
          connectedClients: io.engine.clientsCount
        }))
        break

      // API: Broadcast notification to all users  
      case '/api/notifications/broadcast':
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          break
        }

        const broadcastData = await parseJsonBody(req)
        const { message: broadcastMessage, type: broadcastType = 'info' } = broadcastData

        if (!broadcastMessage) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ 
            error: 'Missing required field: message',
            received: broadcastData
          }))
          break
        }

        const broadcastNotification = {
          message: broadcastMessage,
          type: broadcastType,
          timestamp: new Date().toISOString(),
          id: Date.now(),
          broadcast: true,
          from: 'api'
        }

        // Broadcast via Socket.IO
        io.emit('notification', broadcastNotification)
        
        console.log(`📢 API broadcast:`, broadcastMessage, `(${io.engine.clientsCount} clients)`)
        
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: true,
          message: 'Broadcast sent',
          notification: broadcastNotification,
          connectedClients: io.engine.clientsCount
        }))
        break

      // API: Trigger content refresh for specific page/component
      case '/api/content/refresh':
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          break
        }

        const refreshData = await parseJsonBody(req)
        const { 
          userId: refreshUserId, 
          page, 
          component, 
          action = 'refresh',
          data = null,
          broadcast = false 
        } = refreshData

        if (!page && !component) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ 
            error: 'Missing required field: page or component',
            received: refreshData
          }))
          break
        }

        const refreshMessage = {
          type: 'content-refresh',
          action, // 'refresh', 'reload', 'update', 'invalidate'
          page,
          component,
          data,
          timestamp: new Date().toISOString(),
          id: Date.now(),
          from: 'api'
        }

        if (broadcast) {
          // Send to all users
          io.emit('content-refresh', refreshMessage)
          console.log(`🔄 Broadcast content refresh - Page: ${page}, Component: ${component}`)
        } else if (refreshUserId) {
          // Send to specific user
          io.to(`user-${refreshUserId}`).emit('content-refresh', refreshMessage)
          console.log(`🔄 Content refresh sent to user ${refreshUserId} - Page: ${page}, Component: ${component}`)
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ 
            error: 'Must specify either userId or set broadcast: true'
          }))
          break
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: true,
          message: 'Content refresh triggered',
          refreshMessage,
          targetUser: refreshUserId || 'all',
          connectedClients: io.engine.clientsCount
        }))
        break

      // API: Trigger data invalidation
      case '/api/data/invalidate':
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          break
        }

        const invalidateData = await parseJsonBody(req)
        const { 
          cacheKeys = [], 
          dataType, 
          userId: invalidateUserId, 
          broadcast: invalidateBroadcast = false 
        } = invalidateData

        if (!cacheKeys.length && !dataType) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ 
            error: 'Missing required field: cacheKeys or dataType'
          }))
          break
        }

        const invalidateMessage = {
          type: 'data-invalidate',
          cacheKeys,
          dataType,
          timestamp: new Date().toISOString(),
          id: Date.now(),
          from: 'api'
        }

        if (invalidateBroadcast) {
          io.emit('data-invalidate', invalidateMessage)
          console.log(`🗑️ Broadcast data invalidation - Keys: ${cacheKeys.join(', ')}`)
        } else if (invalidateUserId) {
          io.to(`user-${invalidateUserId}`).emit('data-invalidate', invalidateMessage)
          console.log(`🗑️ Data invalidation sent to user ${invalidateUserId}`)
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ 
            error: 'Must specify either userId or set broadcast: true'
          }))
          break
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: true,
          message: 'Data invalidation triggered',
          invalidateMessage,
          connectedClients: io.engine.clientsCount
        }))
        break

      // API: Send live content update
      case '/api/content/update':
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          break
        }

        const updateData = await parseJsonBody(req)
        const { 
          contentId,
          contentType,
          newContent,
          userId: updateUserId,
          broadcast: updateBroadcast = false 
        } = updateData

        if (!contentId || !newContent) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ 
            error: 'Missing required fields: contentId, newContent'
          }))
          break
        }

        const contentUpdateMessage = {
          type: 'content-update',
          contentId,
          contentType,
          newContent,
          timestamp: new Date().toISOString(),
          id: Date.now(),
          from: 'api'
        }

        if (updateBroadcast) {
          io.emit('content-update', contentUpdateMessage)
          console.log(`📝 Broadcast content update - ID: ${contentId}`)
        } else if (updateUserId) {
          io.to(`user-${updateUserId}`).emit('content-update', contentUpdateMessage)
          console.log(`📝 Content update sent to user ${updateUserId} - ID: ${contentId}`)
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ 
            error: 'Must specify either userId or set broadcast: true'
          }))
          break
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: true,
          message: 'Content update sent',
          contentUpdateMessage,
          connectedClients: io.engine.clientsCount
        }))
        break

      // API: Get connection stats
      case '/api/stats':
        const connectionStats = getConnectionStats()
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          ...connectionStats,
          rooms: connectionStats.rooms?.filter(room => room.startsWith('user-')) || [],
          serverInfo: {
            port: PORT,
            environment: process.env.NODE_ENV || 'development',
            uptime: process.uptime(),
            memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
          }
        }, null, 2))
        break

      // API: Test endpoint
      case '/api/test':
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          message: 'Socket server API is working',
          timestamp: new Date().toISOString(),
          method: req.method,
          connectedClients: io.engine.clientsCount
        }))
        break
        
      case '/':
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Socket.IO Server</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; }
              .status { color: green; font-weight: bold; }
              .info { background: #f0f0f0; padding: 15px; margin: 10px 0; }
              .endpoint { background: #e8f4f8; padding: 10px; margin: 5px 0; }
              .api-endpoint { background: #fff3cd; padding: 10px; margin: 5px 0; border-left: 4px solid #ffc107; }
              .method { font-weight: bold; color: #007bff; }
            </style>
          </head>
          <body>
            <h1>🔌 Socket.IO Server</h1>
            <div class="status">✅ Server is running</div>
            <div class="info">
              <strong>Port:</strong> ${PORT}<br>
              <strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}<br>
              <strong>Started:</strong> ${new Date().toISOString()}<br>
              <strong>Connected Clients:</strong> ${io.engine.clientsCount}
            </div>
            
            <h2>Available Endpoints:</h2>
            <div class="endpoint"><strong>GET /health</strong> - Server health check</div>
            <div class="endpoint"><strong>GET /api/stats</strong> - Connection statistics</div>
            <div class="endpoint"><strong>WebSocket /socket.io/</strong> - Socket.IO connection</div>
            
            <h2>API Endpoints (for Postman):</h2>
            <div class="api-endpoint">
              <span class="method">POST</span> <strong>/api/notifications/send</strong><br>
              Send notification to specific user<br>
              <code>{ "userId": "test-user-123", "message": "Hello!", "type": "info" }</code>
            </div>
            <div class="api-endpoint">
              <span class="method">POST</span> <strong>/api/notifications/broadcast</strong><br>
              Broadcast notification to all users<br>
              <code>{ "message": "Server maintenance in 5 minutes", "type": "warning" }</code>
            </div>
            
            <h2>Content Refresh API:</h2>
            <div class="api-endpoint">
              <span class="method">POST</span> <strong>/api/content/refresh</strong><br>
              Trigger page/component refresh<br>
              <code>{ "page": "dashboard", "component": "userList", "action": "refresh", "broadcast": true }</code>
            </div>
            <div class="api-endpoint">
              <span class="method">POST</span> <strong>/api/data/invalidate</strong><br>
              Invalidate cached data<br>
              <code>{ "cacheKeys": ["users", "orders"], "broadcast": true }</code>
            </div>
            <div class="api-endpoint">
              <span class="method">POST</span> <strong>/api/content/update</strong><br>
              Send live content updates<br>
              <code>{ "contentId": "announcement-1", "newContent": {...}, "broadcast": true }</code>
            </div>
            
            <p><strong>Frontend connects to:</strong> <code>http://localhost:${PORT}</code></p>
            <p><strong>API Base URL:</strong> <code>http://localhost:${PORT}/api</code></p>
          </body>
          </html>
        `)
        break
        
      default:
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          error: 'Not Found',
          availableEndpoints: [
            'GET /health',
            'GET /api/stats', 
            'POST /api/notifications/send',
            'POST /api/notifications/broadcast',
            'POST /api/content/refresh',
            'POST /api/data/invalidate',
            'POST /api/content/update',
            'WebSocket /socket.io/'
          ]
        }))
    }
  } catch (error) {
    console.error('❌ API Error:', error)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }))
  }
})

// Initialize Socket.IO with your existing configuration
const io = initSocket(httpServer)

// Start the server
httpServer.listen(PORT, '0.0.0.0', (err) => {
  if (err) {
    console.error('❌ Failed to start server:', err)
    process.exit(1)
  }
  
  console.log(`✅ Socket.IO server running on http://localhost:${PORT}`)
  console.log(`🏥 Health check: http://localhost:${PORT}/health`)
  console.log(`🌐 Frontend can connect to: http://localhost:${PORT}`)
  console.log('⏳ Waiting for frontend connections...')
  console.log('\n📊 Server Status:')
  console.log(`   • PID: ${process.pid}`)
  console.log(`   • Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`)
  console.log(`   • Node.js: ${process.version}`)
})

// Enhanced error handling
httpServer.on('error', (error) => {
  console.error('\n❌ Server Error:', error.message)
  
  if (error.code === 'EADDRINUSE') {
    console.error(`📍 Port ${PORT} is already in use`)
    console.log('\n💡 Solutions:')
    console.log(`   • Kill existing process: lsof -ti:${PORT} | xargs kill -9`)
    console.log(`   • Use different port: PORT=3002 node server.js`)
    console.log(`   • Check what's using the port: lsof -i:${PORT}`)
  } else if (error.code === 'EACCES') {
    console.error(`📍 Permission denied for port ${PORT}`)
    console.log('\n💡 Try using a port above 1024 or run with sudo')
  }
  
  process.exit(1)
})

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 ${signal} received, shutting down gracefully...`)
  
  httpServer.close((err) => {
    if (err) {
      console.error('❌ Error during shutdown:', err)
      process.exit(1)
    }
    
    console.log('✅ HTTP server closed')
    console.log('🔌 Socket.IO connections closed')
    console.log('👋 Socket server stopped gracefully')
    process.exit(0)
  })
  
  // Force close after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('❌ Forced shutdown after 10 seconds timeout')
    process.exit(1)
  }, 10000)
}

// Listen for shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Handle unhandled errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error)
  console.error('Stack:', error.stack)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:')
  console.error('Promise:', promise)
  console.error('Reason:', reason)
  process.exit(1)
})

// Optional: Log memory usage every 5 minutes in development
if (process.env.NODE_ENV !== 'production') {
  setInterval(() => {
    const memUsage = process.memoryUsage()
    console.log(`📊 Memory Usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB heap, ${Math.round(memUsage.rss / 1024 / 1024)}MB total`)
  }, 5 * 60 * 1000) // 5 minutes
}