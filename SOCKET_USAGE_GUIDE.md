# Socket Server Usage Guide

## Quick Start

### Start the Server
```bash
cd socket
npm start
# or for development with auto-reload
npm run dev
```

Server will start on: `http://localhost:3001`

---

## For Frontend Developers

### 1. Import the Hook
```javascript
import { useSocketNotifications } from '@/hooks/useSocket'
```

### 2. Use in Your Component
```javascript
const MyComponent = () => {
  const userId = user?.id // Get current user ID
  
  const {
    socket,              // Socket instance
    isConnected,         // Connection status
    notifications,       // Array of notifications
    unreadCount,         // Number of unread notifications
    isLoading,           // Loading state
    markAsRead,          // Function to mark notification as read
    markAllAsRead,       // Function to mark all as read
    deleteNotification,  // Function to delete notification
    clearNotifications,  // Function to clear all notifications
    fetchNotifications,  // Function to refresh notifications
    sendNotification,    // Function to send to specific user
    broadcastNotification // Function to broadcast to all
  } = useSocketNotifications(userId)
  
  return (
    <div>
      {/* Connection indicator */}
      <div className={isConnected ? 'bg-green-500' : 'bg-red-500'}>
        {isConnected ? 'Connected' : 'Disconnected'}
      </div>
      
      {/* Unread count badge */}
      {unreadCount > 0 && (
        <span className="badge">{unreadCount}</span>
      )}
      
      {/* Notifications list */}
      {notifications.map(notification => (
        <div key={notification.id}>
          <p>{notification.message}</p>
          <button onClick={() => markAsRead(notification.id)}>
            Mark as Read
          </button>
          <button onClick={() => deleteNotification(notification.id)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  )
}
```

### 3. Send Notification to User
```javascript
// Send to specific user
await sendNotification('user-123', 'Hello User!', 'info')

// Broadcast to all users
await broadcastNotification('System maintenance in 5 minutes', 'warning')
```

---

## For Backend Developers (Laravel)

### Send Notification via HTTP API

#### Option 1: Using cURL
```bash
curl -X POST http://localhost:3001/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "123",
    "message": "Your order has been shipped!",
    "type": "success"
  }'
```

#### Option 2: Using PHP/Laravel
```php
use Illuminate\Support\Facades\Http;

// Send to specific user
Http::post('http://localhost:3001/api/notifications/send', [
    'userId' => $user->id,
    'message' => 'Your order has been shipped!',
    'type' => 'success'
]);

// Broadcast to all users
Http::post('http://localhost:3001/api/notifications/broadcast', [
    'message' => 'System maintenance scheduled',
    'type' => 'warning'
]);
```

#### Option 3: Using Guzzle
```php
use GuzzleHttp\Client;

$client = new Client();
$response = $client->post('http://localhost:3001/api/notifications/send', [
    'json' => [
        'userId' => $user->id,
        'message' => 'New message from admin',
        'type' => 'info'
    ]
]);
```

### Notification Types
- `info` - Blue color, info icon
- `success` - Green color, checkmark icon
- `warning` - Yellow/orange color, warning icon
- `error` - Red color, error icon

---

## Advanced Features

### 1. Content Refresh (Live Updates)
Trigger specific page/component to refresh data:

```javascript
// Via HTTP API
fetch('http://localhost:3001/api/content/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    page: 'dashboard',
    component: 'userList',
    action: 'refresh',
    broadcast: true // or specify userId
  })
})
```

Frontend listens for this event:
```javascript
socket.on('content-refresh', (data) => {
  if (data.page === 'dashboard' && data.component === 'userList') {
    // Refresh the user list data
    fetchUserList()
  }
})
```

### 2. Cache Invalidation
Tell frontend to invalidate cached data:

```javascript
fetch('http://localhost:3001/api/data/invalidate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    cacheKeys: ['users', 'products'],
    broadcast: true
  })
})
```

### 3. Live Content Updates
Push new content directly to clients:

```javascript
fetch('http://localhost:3001/api/content/update', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contentId: 'announcement-1',
    contentType: 'announcement',
    newContent: {
      title: 'New Announcement',
      body: 'Check out our new features!'
    },
    broadcast: true
  })
})
```

---

## Testing

### 1. Health Check
```bash
curl http://localhost:3001/health
```

### 2. View Statistics
```bash
curl http://localhost:3001/api/stats
```

### 3. Test from Browser Console
```javascript
// Test sending notification
fetch('http://localhost:3001/api/notifications/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: "5",
    message: "Test from browser!",
    type: "info"
  })
})
.then(r => r.json())
.then(console.log)
```

---

## Common Use Cases

### 1. Order Status Updates
```php
// In Laravel controller after order update
Http::post('http://localhost:3001/api/notifications/send', [
    'userId' => $order->user_id,
    'message' => "Your order #{$order->id} status: {$order->status}",
    'type' => 'success'
]);
```

### 2. New Message Notification
```php
Http::post('http://localhost:3001/api/notifications/send', [
    'userId' => $recipient->id,
    'message' => "New message from {$sender->name}",
    'type' => 'info'
]);
```

### 3. System Announcements
```php
// Broadcast to all users
Http::post('http://localhost:3001/api/notifications/broadcast', [
    'message' => 'System will be down for maintenance at 2 AM',
    'type' => 'warning'
]);
```

### 4. Payment Confirmation
```php
Http::post('http://localhost:3001/api/notifications/send', [
    'userId' => $payment->user_id,
    'message' => "Payment of ${$payment->amount} received successfully",
    'type' => 'success'
]);
```

### 5. Stock Alert
```php
// When product stock is low
Http::post('http://localhost:3001/api/notifications/send', [
    'userId' => $admin->id,
    'message' => "Low stock alert: {$product->name} (Only {$product->stock} left)",
    'type' => 'warning'
]);
```

---

## Troubleshooting

### Socket Not Connecting?

1. **Check if server is running:**
   ```bash
   curl http://localhost:3001/health
   ```

2. **Check for port conflicts:**
   ```bash
   # Windows
   netstat -ano | findstr :3001
   
   # Linux/Mac
   lsof -i :3001
   ```

3. **Check frontend connection URLs:**
   The hook tries these URLs in order:
   - `process.env.NEXT_PUBLIC_SOCKET_URL`
   - `http://localhost:3001`
   - `http://127.0.0.1:3001`
   - `http://192.168.1.33:3001`

4. **Check browser console:**
   Look for Socket.IO connection logs

### Notifications Not Appearing?

1. **Verify user is connected:**
   ```bash
   curl http://localhost:3001/api/stats
   ```
   Check if your userId is in `connectedUsers` array

2. **Check userId format:**
   Make sure you're sending the correct userId format (string or number)

3. **Check browser console:**
   Socket events are logged in development mode

### Server Crashes?

1. **Check logs for errors**
2. **Verify port 3001 is available**
3. **Check Node.js version** (should be 16+)
4. **Reinstall dependencies:**
   ```bash
   cd socket
   rm -rf node_modules
   npm install
   ```

---

## Environment Configuration

Create `.env.local` in the `socket` folder:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Allowed Origins (comma-separated)
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Production URLs (for production environment)
PRODUCTION_URL=https://yourdomain.com
STAGING_URL=https://staging.yourdomain.com
```

---

## Production Deployment

### 1. Environment Setup
```env
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### 2. Using PM2 (Recommended)
```bash
# Install PM2
npm install -g pm2

# Start server
cd socket
pm2 start server.js --name "socket-server"

# View logs
pm2 logs socket-server

# Restart
pm2 restart socket-server

# Stop
pm2 stop socket-server
```

### 3. Using Docker
```bash
cd socket
docker build -t socket-server .
docker run -d -p 3001:3001 --name socket-server socket-server
```

### 4. Using systemd (Linux)
Create `/etc/systemd/system/socket-server.service`:
```ini
[Unit]
Description=Socket.IO Notification Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/socket
ExecStart=/usr/bin/node server.js
Restart=always
Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable socket-server
sudo systemctl start socket-server
sudo systemctl status socket-server
```

---

## API Reference Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/stats` | GET | Connection statistics |
| `/api/notifications/send` | POST | Send to specific user |
| `/api/notifications/broadcast` | POST | Broadcast to all |
| `/api/content/refresh` | POST | Trigger content refresh |
| `/api/data/invalidate` | POST | Invalidate cache |
| `/api/content/update` | POST | Live content update |

---

## Support

- Check server logs for detailed error messages
- Use health check endpoint to verify server status
- Use stats endpoint to see active connections
- Enable debug logging in development mode

---

**Server Status Dashboard:** http://localhost:3001/

This shows all available endpoints and current server status!

