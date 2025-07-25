//@/pages/api/socket.js
import { initSocket } from '@/lib/socket'

export default function SocketHandler(req, res) {
  if (res.socket.server.io) {
    console.log('Socket.io already initialized')
    res.end()
    return
  }

  console.log('Initializing Socket.io...')
  const io = initSocket(res.socket.server)
  res.socket.server.io = io

  res.end()
}