// @/test-offline-support.js
import * as hybridDB from './lib/hybrid-database.js'

async function testOfflineSupport() {
  console.log('🧪 Testing Offline Support...\n')
  
  // Test 1: Check initial status
  console.log('1. Initial Status:')
  console.log(hybridDB.getSystemStatus())
  console.log('')
  
  // Test 2: Add subscription (should work online or offline)
  console.log('2. Adding test subscription...')
  try {
    const result = await hybridDB.addSubscription('test_user_123', {
      endpoint: 'https://test.com/push',
      keys: {
        p256dh: 'test_p256dh_key',
        auth: 'test_auth_key'
      }
    })
    console.log('✅ Subscription added:', result)
  } catch (error) {
    console.log('❌ Failed to add subscription:', error.message)
  }
  console.log('')
  
  // Test 3: Get subscription
  console.log('3. Getting subscription...')
  try {
    const subscription = await hybridDB.getSubscription('test_user_123')
    console.log('✅ Subscription retrieved:', subscription ? 'Found' : 'Not found')
  } catch (error) {
    console.log('❌ Failed to get subscription:', error.message)
  }
  console.log('')
  
  // Test 4: Get all subscriptions
  console.log('4. Getting all subscriptions...')
  try {
    const all = await hybridDB.getAllSubscriptions()
    console.log(`✅ Found ${all.length} subscriptions`)
  } catch (error) {
    console.log('❌ Failed to get all subscriptions:', error.message)
  }
  console.log('')
  
  // Test 5: Final status
  console.log('5. Final Status:')
  console.log(hybridDB.getSystemStatus())
  
  console.log('\n🎉 Test completed!')
  process.exit(0)
}

testOfflineSupport().catch(console.error)