import { useEffect, useState } from 'react'

export default function Home() {
  const [status, setStatus] = useState('Not connected')
  const [userId] = useState('user123') // Simple user ID for testing
  const [isRegistered, setIsRegistered] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Initialize Socket.io connection
    fetch('/api/socket').finally(() => {
      setStatus('Socket.io initialized')
    })

    // Check registration status
    checkRegistrationStatus()
  }, [])

  const checkRegistrationStatus = async () => {
    try {
      const response = await fetch(`/api/users/check-registration?userId=${userId}`)
      const data = await response.json()
      setIsRegistered(data.isRegistered)
    } catch (error) {
      console.error('Error checking registration:', error)
    } finally {
      setLoading(false)
    }
  }

  const registerForNotifications = async () => {
    try {
      // Request notification permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        alert('Notification permission denied')
        return
      }

      // Register service worker and get push subscription
      const registration = await navigator.serviceWorker.register('/sw.js')
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      })

      // Save subscription to database
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, subscription })
      })

      if (response.ok) {
        setIsRegistered(true)
        alert('Successfully registered for notifications!')
      }
    } catch (error) {
      console.error('Error registering for notifications:', error)
      alert('Failed to register for notifications')
    }
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Notification System Test</h1>
      <p>Status: {status}</p>
      <p>User ID: {userId}</p>
      
      <div style={{ marginTop: '20px', padding: '10px', border: '1px solid #ccc' }}>
        <h3>Registration Status:</h3>
        {loading ? (
          <p>Checking registration...</p>
        ) : (
          <>
            <p style={{ color: isRegistered ? 'green' : 'red' }}>
              {isRegistered ? '✅ Registered for notifications' : '❌ Not registered'}
            </p>
            {!isRegistered && (
              <button 
                onClick={registerForNotifications}
                style={{ 
                  padding: '10px 20px', 
                  backgroundColor: '#007cba', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Register for Notifications
              </button>
            )}
          </>
        )}
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <h3>Quick Test Buttons:</h3>
        <button onClick={() => alert('System is running!')}>
          Test Basic Functionality
        </button>
        <button onClick={checkRegistrationStatus} style={{ marginLeft: '10px' }}>
          Refresh Registration Status
        </button>
      </div>
      
      <div style={{ marginTop: '20px', padding: '10px', background: '#f0f0f0' }}>
        <h4>Next Steps:</h4>
        <ol>
          <li>Open browser developer tools (F12)</li>
          <li>Check console for any errors</li>
          <li>Register for notifications to test the system</li>
        </ol>
      </div>
    </div>
  )
}