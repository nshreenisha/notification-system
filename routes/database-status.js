// @/routes/database-status.js
import express from 'express'
import * as hybridDB from '../lib/hybrid-database.js'
import * as mysqlDB from '../lib/mysql-database.js'

const router = express.Router()

// Get database status
router.get('/status', async (req, res) => {
  try {
    const systemStatus = hybridDB.getSystemStatus()
    const mysqlTest = await mysqlDB.testConnection()
    
    res.json({
      success: true,
      status: {
        mysql: {
          connected: systemStatus.mysql,
          message: mysqlTest.message
        },
        json: {
          connected: systemStatus.json,
          message: 'JSON file storage always available'
        },
        syncQueue: systemStatus.syncQueue,
        lastCheck: systemStatus.lastCheck,
        mode: systemStatus.mysql ? 'online' : 'offline'
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get database status',
      error: error.message
    })
  }
})

// Force sync offline data
router.post('/sync', async (req, res) => {
  try {
    const result = await hybridDB.forcSync()
    res.json(result)
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Sync failed',
      error: error.message
    })
  }
})

// Test MySQL connection
router.get('/test-mysql', async (req, res) => {
  try {
    const result = await mysqlDB.testConnection()
    res.json(result)
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'MySQL test failed',
      error: error.message
    })
  }
})

// Get all subscriptions with source info
router.get('/subscriptions', async (req, res) => {
  try {
    const subscriptions = await hybridDB.getAllSubscriptions()
    const status = hybridDB.getSystemStatus()
    
    res.json({
      success: true,
      data: subscriptions,
      source: status.mysql ? 'mysql' : 'json',
      count: subscriptions.length
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get subscriptions',
      error: error.message
    })
  }
})

export default router