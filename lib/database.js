//@/lib/database.js
import fs from 'fs/promises'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'data', 'subscriptions.json')

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = path.dirname(DB_PATH)
  try {
    await fs.access(dataDir)
  } catch {
    await fs.mkdir(dataDir, { recursive: true })
  }
}

// Initialize database file
async function initDB() {
  await ensureDataDir()
  try {
    await fs.access(DB_PATH)
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify({ subscriptions: [], users: [] }))
  }
}

// Read database
export async function readDB() {
  await initDB()
  const data = await fs.readFile(DB_PATH, 'utf8')
  return JSON.parse(data)
}

// Write database
export async function writeDB(data) {
  await ensureDataDir()
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2))
}

// Add subscription (JSON only - used as backup)
export async function addSubscription(userId, subscription) {
  const db = await readDB()
  
  // Remove existing subscription for this user
  db.subscriptions = db.subscriptions.filter(sub => sub.userId !== userId)
  
  // Add new subscription
  const newSubscription = {
    userId,
    subscription,
    createdAt: new Date().toISOString()
  }
  
  db.subscriptions.push(newSubscription)
  
  await writeDB(db)
  console.log(`📝 JSON: Subscription saved for user ${userId}`)
  return newSubscription
}

// Get subscription by userId
export async function getSubscription(userId) {
  const db = await readDB()
  return db.subscriptions.find(sub => sub.userId === userId)
}

// Get all subscriptions
export async function getAllSubscriptions() {
  const db = await readDB()
  return db.subscriptions
}

// Remove subscription
export async function removeSubscription(userId) {
  const db = await readDB()
  db.subscriptions = db.subscriptions.filter(sub => sub.userId !== userId)
  await writeDB(db)
}