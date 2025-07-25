// @/lib/startup.js
export async function initializeSocketServer() {
  try {
    const response = await fetch('/api/socket', { method: 'POST' })
    const data = await response.json()
    console.log('Socket server initialization:', data)
    return true
  } catch (error) {
    console.error('Failed to initialize socket server:', error)
    return false
  }
}