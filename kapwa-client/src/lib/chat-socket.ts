import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

let socket: Socket | null = null;


export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket;

  socket = io(`${WS_URL}/chat`, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
  });

  socket.on('disconnect', (reason) => {
  });

  socket.on('error', (err) => {
    console.error('[WS] Error:', err);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function sendMessage(recipientId: string, content: string, senderName?: string) {
  if (!socket?.connected) return;
  socket.emit("send_message", { recipientId, content, senderName });
}

export function markMessageRead(messageId: string) {
  if (!socket?.connected) return;
  socket.emit('mark_read', { messageId });
}

export function emitTyping(recipientId: string) {
  if (!socket?.connected) return;
  socket.emit('typing', { recipientId });
}
