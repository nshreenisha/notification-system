// @/lib/hybrid-database.js
import * as jsonDB from './database.js'
import * as mysqlDB from './mysql-database.js'

let isOnline = true
let syncQueue = []

// Check if MySQL is available
async function checkMySQLHealth() {
  try {
    const result = await mysqlDB.testConnection()
    const wasOffline = !isOnline
    isOnline = result.success
    
    if (wasOffline && isOnline) {
      console.log('🔄 MySQL back online - starting sync...')
      await syncOfflineData()
    }
    
    return isOnline
  } catch (error) {
    isOnline = false
    return false
  }
}

// Sync offline data when MySQL comes back online
async function syncOfflineData() {
  if (!isOnline || syncQueue.length === 0) return
  
  console.log(`🔄 Syncing ${syncQueue.length} offline operations...`)
  
  for (const operation of syncQueue) {
    try {
      switch (operation.type) {
        case 'add':
          await mysqlDB.addSubscription(operation.userId, operation.subscription)
          break
        case 'remove':
          await mysqlDB.removeSubscription(operation.userId)
          break
      }
      console.log(`✅ Synced ${operation.type} for user ${operation.userId}`)
    } catch (error) {
      console.log(`❌ Failed to sync ${operation.type} for user ${operation.userId}:`, error.message)
    }
  }
  
  // Clear sync queue after successful sync
  syncQueue = []
  console.log('✅ Offline sync completed')
}

// Add to sync queue for offline operations
function addToSyncQueue(type, userId, subscription = null) {
  syncQueue.push({
    type,
    userId,
    subscription,
    timestamp: new Date().toISOString()
  })
  console.log(`📝 Added to sync queue: ${type} for user ${userId}`)
}

// Hybrid add subscription
export async function addSubscription(userId, subscription) {
  // Always save to JSON first (immediate backup)
  const jsonResult = await jsonDB.addSubscription(userId, subscription)
  
  if (await checkMySQLHealth()) {
    try {
      // Try MySQL
      const mysqlResult = await mysqlDB.addSubscription(userId, subscription)
      console.log(`✅ Hybrid: Subscription added for user ${userId} (MySQL + JSON)`)
      return mysqlResult
    } catch (error) {
      console.log(`⚠️ MySQL failed, using JSON only:`, error.message)
      addToSyncQueue('add', userId, subscription)
      return jsonResult
    }
  } else {
    console.log(`📴 Offline mode: Subscription saved to JSON for user ${userId}`)
    addToSyncQueue('add', userId, subscription)
    return jsonResult
  }
}

// Hybrid get subscription
export async function getSubscription(userId) {
  if (await checkMySQLHealth()) {
    try {
      // Try MySQL first
      const mysqlResult = await mysqlDB.getSubscription(userId)
      if (mysqlResult) {
        return mysqlResult
      }
    } catch (error) {
      console.log(`⚠️ MySQL failed, falling back to JSON:`, error.message)
    }
  }
  
  // Fallback to JSON
  console.log(`📴 Using JSON fallback for user ${userId}`)
  return await jsonDB.getSubscription(userId)
}

// Hybrid get all subscriptions
export async function getAllSubscriptions() {
  if (await checkMySQLHealth()) {
    try {
      // Try MySQL first
      return await mysqlDB.getAllSubscriptions()
    } catch (error) {
      console.log(`⚠️ MySQL failed, falling back to JSON:`, error.message)
    }
  }
  
  // Fallback to JSON
  console.log(`📴 Using JSON fallback for all subscriptions`)
  return await jsonDB.getAllSubscriptions()
}

// Hybrid remove subscription
export async function removeSubscription(userId) {
  // Always remove from JSON
  await jsonDB.removeSubscription(userId)
  
  if (await checkMySQLHealth()) {
    try {
      // Try MySQL
      await mysqlDB.removeSubscription(userId)
      console.log(`✅ Hybrid: Subscription removed for user ${userId} (MySQL + JSON)`)
    } catch (error) {
      console.log(`⚠️ MySQL failed, JSON removed only:`, error.message)
      addToSyncQueue('remove', userId)
    }
  } else {
    console.log(`📴 Offline mode: Subscription removed from JSON for user ${userId}`)
    addToSyncQueue('remove', userId)
  }
}

// Get system status
export function getSystemStatus() {
  return {
    mysql: isOnline,
    json: true, // JSON is always available
    syncQueue: syncQueue.length,
    lastCheck: new Date().toISOString()
  }
}

// Manual sync trigger
export async function forcSync() {
  if (await checkMySQLHealth()) {
    await syncOfflineData()
    return { success: true, message: 'Sync completed' }
  } else {
    return { success: false, message: 'MySQL not available' }
  }
}

// Periodic health check and sync (every 30 seconds)
setInterval(async () => {
  await checkMySQLHealth()
}, 30000)

// Initial health check
checkMySQLHealth()