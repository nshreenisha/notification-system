// Test Company-based Socket Targeting
import { io } from 'socket.io-client'

const SOCKET_URL = 'http://localhost:3001'

// Simulate multiple users from different companies
const users = [
  // Company 1 users
  { id: 1, name: 'User 1', company_id: 1 },
  { id: 3, name: 'User 3', company_id: 1 },
  { id: 4, name: 'User 4', company_id: 1 },
  { id: 6, name: 'User 6', company_id: 1 },
  
  // Company 2 users  
  { id: 2, name: 'User 2', company_id: 2 },
  { id: 8, name: 'User 8', company_id: 2 },
  { id: 10, name: 'User 10', company_id: 2 },
  { id: 11, name: 'User 11', company_id: 2 }
]

async function testCompanyTargeting() {
  console.log('🧪 Testing Company-based Socket Targeting...\n')
  
  const sockets = []
  
  try {
    // Step 1: Connect all users
    console.log('📡 Connecting users to socket...')
    for (const user of users) {
      const socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        timeout: 5000
      })
      
      socket.user = user
      sockets.push(socket)
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000)
        
        socket.on('connect', () => {
          clearTimeout(timeout)
          console.log(`✅ ${user.name} (Company ${user.company_id}) connected: ${socket.id}`)
          
          // Join user room
          socket.emit('join-user-room', user.id)
          
          // Join company room
          socket.emit('join-company-room', {
            userId: user.id,
            companyId: user.company_id
          })
          
          resolve()
        })
        
        socket.on('connect_error', reject)
      })
      
      // Listen for content refresh events
      socket.on('content-refresh', (data) => {
        console.log(`🔄 ${user.name} (Company ${user.company_id}) received refresh:`, data.component)
      })
      
      // Listen for room join confirmations
      socket.on('joined-room', (data) => {
        console.log(`👤 ${user.name} joined user room: ${data.room}`)
      })
      
      socket.on('joined-company-room', (data) => {
        console.log(`🏢 ${user.name} joined company room: ${data.room}`)
      })
    }
    
    console.log(`\n✅ All ${users.length} users connected successfully!\n`)
    
    // Wait a bit for all connections to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Step 2: Test Company 1 targeting
    console.log('🎯 Testing Company 1 targeting...')
    console.log('Expected: Only Company 1 users (User 1, 3, 4, 6) should receive refresh\n')
    
    const response1 = await fetch(`${SOCKET_URL}/api/content/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: 1,
        page: 'dashboard',
        component: 'sales',
        data: {
          message: 'New sale created in Company 1!',
          amount: 5000
        }
      })
    })
    
    const result1 = await response1.json()
    console.log('📊 Company 1 refresh result:', result1.target, `(${result1.connectedClients} clients)`)
    
    // Wait for messages to be received
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Step 3: Test Company 2 targeting
    console.log('\n🎯 Testing Company 2 targeting...')
    console.log('Expected: Only Company 2 users (User 2, 8, 10, 11) should receive refresh\n')
    
    const response2 = await fetch(`${SOCKET_URL}/api/content/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: 2,
        page: 'dashboard',
        component: 'purchases',
        data: {
          message: 'New purchase created in Company 2!',
          amount: 3000
        }
      })
    })
    
    const result2 = await response2.json()
    console.log('📊 Company 2 refresh result:', result2.target, `(${result2.connectedClients} clients)`)
    
    // Wait for messages to be received
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Step 4: Test broadcast to all
    console.log('\n📢 Testing broadcast to all companies...')
    console.log('Expected: All users from both companies should receive refresh\n')
    
    const response3 = await fetch(`${SOCKET_URL}/api/content/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        broadcast: true,
        page: 'dashboard',
        component: 'system',
        data: {
          message: 'System maintenance notification for all companies!'
        }
      })
    })
    
    const result3 = await response3.json()
    console.log('📊 Broadcast result:', result3.target, `(${result3.connectedClients} clients)`)
    
    // Wait for messages to be received
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    console.log('\n🎉 Company targeting test completed!')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  } finally {
    // Cleanup: Disconnect all sockets
    console.log('\n🧹 Cleaning up connections...')
    sockets.forEach(socket => {
      if (socket.connected) {
        socket.disconnect()
      }
    })
    console.log('✅ All connections closed')
    process.exit(0)
  }
}

testCompanyTargeting().catch(console.error)