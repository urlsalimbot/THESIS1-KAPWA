import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL ?? '';

let socket: Socket | null = null;

export function connectNotificationSocket(token: string): Socket {
  if (socket?.connected) return socket;

  socket = io(`${WS_URL}/notifications`, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  socket.on('connect_error', (err) => {
    console.error('[WS Notif] connect error:', err.message);
  });

  socket.on('error', (err) => {
    console.error('[WS Notif] Error:', err);
  });

  return socket;
}

export function disconnectNotificationSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
