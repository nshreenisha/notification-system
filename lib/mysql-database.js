// @/lib/mysql-database.js
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'your_laravel_db',
  port: parseInt(process.env.DB_PORT) || 3306
}

let connection = null

async function getConnection() {
  try {
    if (!connection) {
      connection = await mysql.createConnection(dbConfig)
      console.log('✅ MySQL connection established')
    }
    
    // Test connection
    await connection.ping()
    return connection
  } catch (error) {
    console.log('❌ MySQL connection failed:', error.message)
    connection = null
    throw error
  }
}

// Test database connection
export async function testConnection() {
  try {
    const conn = await getConnection()
    const [rows] = await conn.execute('SELECT 1 as test')
    return { success: true, message: 'Database connected successfully' }
  } catch (error) {
    return { success: false, message: error.message }
  }
}

// Add subscription to MySQL
export async function addSubscription(userId, subscription) {
  try {
    const conn = await getConnection()
    
    // Remove existing subscription for this user
    await conn.execute(
      'DELETE FROM socket_subscriptions WHERE user_id = ?',
      [userId]
    )
    
    // Add new subscription
    const [result] = await conn.execute(
      'INSERT INTO socket_subscriptions (user_id, subscription_data, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
      [userId, JSON.stringify(subscription)]
    )
    
    console.log(`✅ MySQL: Subscription added for user ${userId}`)
    return {
      id: result.insertId,
      userId,
      subscription,
      createdAt: new Date().toISOString()
    }
  } catch (error) {
    console.log(`❌ MySQL addSubscription failed:`, error.message)
    throw error
  }
}

// Get subscription by userId from MySQL
export async function getSubscription(userId) {
  try {
    const conn = await getConnection()
    const [rows] = await conn.execute(
      'SELECT * FROM socket_subscriptions WHERE user_id = ?',
      [userId]
    )
    
    if (rows.length > 0) {
      return {
        userId: rows[0].user_id,
        subscription: JSON.parse(rows[0].subscription_data),
        createdAt: rows[0].created_at
      }
    }
    return null
  } catch (error) {
    console.log(`❌ MySQL getSubscription failed:`, error.message)
    throw error
  }
}

// Get all subscriptions from MySQL
export async function getAllSubscriptions() {
  try {
    const conn = await getConnection()
    const [rows] = await conn.execute('SELECT * FROM socket_subscriptions ORDER BY created_at DESC')
    
    return rows.map(row => ({
      userId: row.user_id,
      subscription: JSON.parse(row.subscription_data),
      createdAt: row.created_at
    }))
  } catch (error) {
    console.log(`❌ MySQL getAllSubscriptions failed:`, error.message)
    throw error
  }
}

// Remove subscription from MySQL
export async function removeSubscription(userId) {
  try {
    const conn = await getConnection()
    const [result] = await conn.execute(
      'DELETE FROM socket_subscriptions WHERE user_id = ?',
      [userId]
    )
    
    console.log(`✅ MySQL: Subscription removed for user ${userId}`)
    return result.affectedRows > 0
  } catch (error) {
    console.log(`❌ MySQL removeSubscription failed:`, error.message)
    throw error
  }
}

// Close connection
export async function closeConnection() {
  if (connection) {
    await connection.end()
    connection = null
    console.log('✅ MySQL connection closed')
  }
}