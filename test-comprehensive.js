// @/test-comprehensive.js
import * as hybridDB from './lib/hybrid-database.js'
import * as mysqlDB from './lib/mysql-database.js'

async function testComprehensive() {
  console.log('🧪 Comprehensive Offline Support Test...\n')
  
  try {
    // Test 1: Online Mode Test
    console.log('=== TEST 1: ONLINE MODE ===')
    const status1 = hybridDB.getSystemStatus()
    console.log('Status:', status1)
    
    // Add multiple subscriptions
    console.log('\n📝 Adding multiple subscriptions...')
    await hybridDB.addSubscription('user_1', {
      endpoint: 'https://test1.com/push',
      keys: { p256dh: 'key1', auth: 'auth1' }
    })
    
    await hybridDB.addSubscription('user_2', {
      endpoint: 'https://test2.com/push', 
      keys: { p256dh: 'key2', auth: 'auth2' }
    })
    
    const allSubs = await hybridDB.getAllSubscriptions()
    console.log(`✅ Total subscriptions: ${allSubs.length}`)
    
    // Test 2: Database Connection Test
    console.log('\n=== TEST 2: DATABASE CONNECTION ===')
    const mysqlTest = await mysqlDB.testConnection()
    console.log('MySQL Test:', mysqlTest)
    
    // Test 3: Individual Retrieval
    console.log('\n=== TEST 3: INDIVIDUAL RETRIEVAL ===')
    const user1Sub = await hybridDB.getSubscription('user_1')
    const user2Sub = await hybridDB.getSubscription('user_2')
    console.log('User 1 found:', user1Sub ? '✅' : '❌')
    console.log('User 2 found:', user2Sub ? '✅' : '❌')
    
    // Test 4: Remove Subscription
    console.log('\n=== TEST 4: REMOVE SUBSCRIPTION ===')
    await hybridDB.removeSubscription('user_1')
    const afterRemoval = await hybridDB.getAllSubscriptions()
    console.log(`✅ After removal: ${afterRemoval.length} subscriptions`)
    
    // Test 5: Final Status
    console.log('\n=== TEST 5: FINAL STATUS ===')
    const finalStatus = hybridDB.getSystemStatus()
    console.log('Final Status:', finalStatus)
    
    console.log('\n🎉 All tests completed successfully!')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.error('Stack:', error.stack)
  }
  
  process.exit(0)
}

testComprehensive().catch(console.error)