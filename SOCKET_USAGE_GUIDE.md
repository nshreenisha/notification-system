# Socket Server Integration Guide

This guide provides **copy-paste solutions** for integrating real-time features into your application using the Socket Server.
It covers the full flow: **Laravel Backend (Trigger) -> Socket Server (Hub) -> React Frontend (Receiver)**.

---

## 📚 Table of Contents
1. [Real-time Notifications](#1-real-time-notifications) (Targeted alerts to specific users)
2. [Content Refresh](#2-content-refresh) (Tell frontend to refetch data)
3. [Live Content Updates](#3-live-content-updates) (Push new data directly)
4. [Broadcasts](#4-broadcasts) (System-wide announcements)
5. [Connection Setup](#5-connection-setup)
6. [Audio / Video Calling](#6-audio--video-calling-webrtc-signaling) (WebRTC Signaling)
7. [Browser Push Notifications](#7-browser-push-notifications-web-push) (Mobile/Desktop Alerts)
8. [Role-Based Notifications](#8-role-based-notifications) (Targeted Employee Alerts)

---

## 1. Real-time Notifications
**Use Case:** Sending a "Success", "Error", or "Info" alert to a specific logged-in user.
**Example:** "Your order #1234 is Ready!"

### Step 1: Backend (Laravel) - Trigger the Notification
Call this in your Controller or Service after an action occurs.

```php
use Illuminate\Support\Facades\Http;

class OrderController extends Controller {
    public function markReady($orderId) {
        $order = Order::find($orderId);
        $order->status = 'ready';
        $order->save();

        // 🚀 Trigger Socket Notification
        try {
            Http::post(env('SOCKET_URL', 'http://localhost:3001') . '/api/notifications/send', [
                'userId' => (string) $order->user_id, // Ensure ID is string
                'message' => "Order #{$order->order_number} is now READY!",
                'type' => 'success' // Options: 'success', 'error', 'warning', 'info'
            ]);
        } catch (\Exception $e) {
            // Log error but don't fail the request
            \Log::error("Failed to send socket notification: " . $e->getMessage());
        }
        
        return response()->json(['success' => true]);
    }
}
```

### Step 2: Frontend (React) - Receive & Display
The `socketRegistration.js` service and `useSocket` hook already handle this, but here is how to use it in a component if you need custom handling.

```javascript
/* src/components/OrderNotification.js */
import { useEffect } from 'react';
import { useSocket } from '@/context/SocketContext'; // Assuming you have a context or hook in place
// OR access directly if global (as seen in socketRegistration.js)

export default function OrderNotification() {
  useEffect(() => {
    // Check if socket is available
    const socket = window.socketConnection; 
    
    if (!socket) return;

    const handleNotification = (data) => {
      console.log("🔔 Notification Received:", data);
      
      // Example: Show toast
      if (data.type === 'success') {
        alert(`✅ ${data.message}`);
      }
    };

    // 🎧 Listen for event
    socket.on('notification', handleNotification);

    // 🧹 Cleanup
    return () => {
      socket.off('notification', handleNotification);
    };
  }, []);

  return null; // This component handles logic only
}
```

---

## 2. Content Refresh
**Use Case:** Telling the frontend "Something changed, please re-fetch the data" instead of pushing the whole data object.
**Example:** A new Kitchen Order is placed; the Kitchen Display System (KDS) should refresh the list.

### Step 1: Backend (Laravel) - Trigger Refresh
```php
public function storeOrder(Request $request) {
    // ... logic to create order ...
    
    $companyId = $request->user()->company_id;

    // 🚀 Refresh Kitchen Display for ALL users in this company
    try {
        Http::post(env('SOCKET_URL', 'http://localhost:3001') . '/api/content/refresh', [
            'companyId' => $companyId,   // Target: All users in this company
            'page' => 'kitchen',         // Context: Kitchen Page
            'component' => 'order-list', // Specific Component
            'action' => 'refresh'        // Action type
        ]);
    } catch (\Exception $e) {
        // ...
    }
}
```

### Step 2: Frontend (React) - Auto-Refresh Data
```javascript
/* src/app/(restopos)/restopos/kitchen/page.js */
import { useEffect, useState } from 'react';

export default function KitchenPage() {
  const [orders, setOrders] = useState([]);

  // Function to fetch data from API
  const fetchOrders = async () => {
    const res = await fetch('/api/kitchen/orders');
    const data = await res.json();
    setOrders(data);
  };

  useEffect(() => {
    fetchOrders(); // Initial load

    // 🎧 Socket Listener for Refresh
    const socket = window.socketConnection;
    if (socket) {
      const handleRefresh = (data) => {
        // Check if the refresh event applies to this component
        if (data.page === 'kitchen' && data.component === 'order-list') {
          console.log("🔄 New order detected! Refreshing list...");
          fetchOrders(); // <--- Re-run data fetching
        }
      };

      socket.on('content-refresh', handleRefresh);
      return () => socket.off('content-refresh', handleRefresh);
    }
  }, []);

  return (
    <div>
      {orders.map(order => <OrderCard key={order.id} data={order} />)}
    </div>
  );
}
```

---

## 3. Live Content Updates
**Use Case:** Pushing `newContent` directly to the client to update the UI *instantly* without an API call.
**Example:** Updating the "Status" of a table from "Available" to "Occupied".

### Step 1: Backend (Laravel) - Push Update
```php
public function updateTableStatus($tableId) {
    // ... logic ...

    // 🚀 Push Live Update
    Http::post(env('SOCKET_URL', 'http://localhost:3001') . '/api/content/update', [
        'broadcast' => true,            // Send to everyone (or use 'companyId')
        'contentId' => "table-{$tableId}", // Unique ID for finding the item on frontend
        'contentType' => 'table-status',
        'newContent' => [
            'status' => 'occupied',
            'last_active' => now()->toIsoString()
        ]
    ]);
}
```

### Step 2: Frontend (React) - Apply Update
```javascript
/* src/components/FloorPlan.js */
import { useEffect, useState } from 'react';

export default function FloorPlan({ initialTables }) {
  const [tables, setTables] = useState(initialTables);

  useEffect(() => {
    const socket = window.socketConnection;
    if (!socket) return;

    const handleUpdate = (data) => {
      // 🎯 Find and update the specific item locally
      if (data.contentType === 'table-status') {
        const tableId = data.contentId.replace('table-', '');
        
        setTables(prevTables => prevTables.map(table => {
           if (String(table.id) === String(tableId)) {
             return { ...table, ...data.newContent }; // Merge new data
           }
           return table;
        }));
      }
    };

    socket.on('content-update', handleUpdate);
    return () => socket.off('content-update', handleUpdate);
  }, []);

  return (
    <div className="floor-plan">
      {tables.map(table => (
        <div key={table.id} className={`table ${table.status}`}>
          {table.name}
        </div>
      ))}
    </div>
  );
}
```

---

## 4. Broadcasts
**Use Case:** System-wide alerts for everyone.
**Example:** "Server Maintenance in 10 minutes."

### Step 1: Backend
```php
Http::post(env('SOCKET_URL', 'http://localhost:3001') . '/api/notifications/broadcast', [
    'message' => '⚠️ Maintenance scheduled for 2:00 AM',
    'type' => 'warning'
]);
```

### Step 2: Frontend
Handled automatically by the notification listener (see Section 1).

---

## 5. Connection Setup
This is handled by `src/services/socketRegistration.js`.

**To ensure a component has access to the socket:**
1. Stick to using `window.socketConnection` (as established by the service).
2. Or use a proper React Context (recommended for cleaner code).

**Checking Connection:**
```javascript
if (window.socketConnection && window.socketConnection.connected) {
   console.log("✅ Socket is online");
} else {
   console.log("❌ Socket is offline");
}
```

---

## 6. Audio / Video Calling (WebRTC Signaling)
**Use Case:** Enabling video or audio calls between users.
**How it works:** The Socket Server acts as a "Signaling Server" to relay WebRTC connection data (`offer`, `answer`, `ice-candidate`) between two clients. **No new server code is needed;** it is already built-in.

### Client-Side Implementation (React)
Use this pattern to implement calling. The events `call-user`, `answer-call`, `ice-candidate`, and `end-call` are pre-configured on the server.

```javascript
/* src/hooks/useWebRTC.js (Simplified Example) */
import { useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer'; // Recommended library: npm install simple-peer

export function useVideoCall(currentUserId) {
  const [caller, setCaller] = useState('');
  const [receivingCall, setReceivingCall] = useState(false);
  const [callAccepted, setCallAccepted] = useState(false);
  const [signal, setSignal] = useState(null);
  
  const connectionRef = useRef();
  const socket = window.socketConnection;

  useEffect(() => {
    if (!socket) return;

    // 📞 Listen for incoming calls
    socket.on('call-user', (data) => {
      setReceivingCall(true);
      setCaller(data.from);
      setSignal(data.signal);
      console.log(`Incoming call from ${data.from}`);
    });

    socket.on('call-accepted', (signal) => {
      setCallAccepted(true);
      connectionRef.current.signal(signal);
    });

    // ❄️ Handle ICE candidates (Connecting paths)
    socket.on('ice-candidate', (candidate) => {
      if (connectionRef.current) {
        connectionRef.current.addIceCandidate(candidate);
      }
    });

    socket.on('call-ended', () => {
       endCall();
    });

    return () => {
      socket.off('call-user');
      socket.off('call-accepted');
      socket.off('ice-candidate');
    };
  }, [socket]);

  // 1️⃣ Initiate Call
  const callUser = (idToCall, stream) => {
    const peer = new Peer({ initiator: true, trickle: false, stream });

    peer.on('signal', (data) => {
      socket.emit('call-user', {
        userToCall: idToCall,
        signalData: data,
        from: currentUserId
      });
    });

    peer.on('stream', (userStream) => {
        // userVideo.current.srcObject = userStream;
    });

    connectionRef.current = peer;
  };

  // 2️⃣ Answer Call
  const answerCall = (stream) => {
    setCallAccepted(true);
    const peer = new Peer({ initiator: false, trickle: false, stream });

    peer.on('signal', (data) => {
      socket.emit('answer-call', { signal: data, to: caller });
    });

    peer.on('stream', (userStream) => {
        // userVideo.current.srcObject = userStream;
    });

    peer.signal(signal);
    connectionRef.current = peer;
  };
  
  // 3️⃣ End Call
  const endCall = () => {
      setCallAccepted(false);
      setReceivingCall(false);
      if(connectionRef.current) connectionRef.current.destroy();
      
      if(caller) {
          socket.emit('end-call', { to: caller });
      }
  };

  return { callUser, answerCall, receivingCall, callAccepted };
}
```

---

## 7. Browser Push Notifications (Web Push)
**Use Case:** Notifications even when the tab is closed (Mobile/Desktop OS-level alerts).
**Prerequisites:** You must have `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in your `.env`.

### Step 1: Register Service Worker & Subscribe
(This is already handled in `src/services/socketRegistration.js`, but here is the manual logic)

```javascript
// public/push-helper.js or similar
async function subscribeToPush() {
    // 1. Get Public Key from Server
    const response = await fetch('http://localhost:3001/api/push/vapid-key');
    const { publicKey } = await response.json();

    // 2. Register Service Worker
    const register = await navigator.serviceWorker.register('/sw.js');

    // 3. Subscribe
    const subscription = await register.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey
    });

    // 4. Send Subscription to Server
    await fetch('http://localhost:3001/api/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({ userId: currentUser.id, subscription }),
        headers: { 'Content-Type': 'application/json' }
    });
}
```

### Step 2: Sending a Web Push (from Backend)
The Socket Server will handle talking to Google/Mozilla push services.

```php
// In Laravel
Http::post(env('SOCKET_URL', 'http://localhost:3001') . '/api/push/send', [
    'userId' => '123',
    'title' => 'New Order Received',
    'message' => 'Table 5 has placed an order.',
    'icon' => '/images/logo.png',
    'url' => 'https://app.restaurant.com/orders/5'
]);
```

### Step 3: Broadcasting Web Push
Send to **all subscribed users**.
```php
Http::post(env('SOCKET_URL', 'http://localhost:3001') . '/api/push/broadcast', [
    'title' => 'Emergency Alert',
    'message' => 'System going down in 5 mins.',
    'icon' => '/images/alert.png'
]);
```

---

## 8. Role-Based Notifications
**Use Case:** Sending alerts to a specific group of employees (e.g., "All Chefs" or "All Managers").

### Step 1: Frontend - Join Role Room
Call this when the user logs in or when their role is loaded.

```javascript
/* src/services/socketRegistration.js or Component */
if (user.role && user.company_id) {
  socket.emit('join-role-room', {
    companyId: user.company_id,
    role: user.role // e.g. 'chef', 'manager', 'waiter'
  });
}
```

### Step 2: Backend (Laravel) - Send to Role
```php
Http::post(env('SOCKET_URL', 'http://localhost:3001') . '/api/notifications/role', [
    'companyId' => 1,
    'role' => 'chef',
    'message' => 'New Order #502 requires attention!',
    'type' => 'warning'
]);
```
