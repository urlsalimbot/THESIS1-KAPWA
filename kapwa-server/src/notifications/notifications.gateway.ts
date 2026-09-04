import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

// CORS origins for the notifications socket. Defaults cover local dev; in
// production set NOTIF_WS_ORIGIN to a comma-separated list of allowed origins
// (e.g. "https://kapwa.mswdo-norzagaray.gov.ph") so the deployed client can
// connect when served from a different origin than the API.
function wsOrigins(): string[] {
  const raw = process.env.NOTIF_WS_ORIGIN;
  if (raw) {
    return raw.split(',').map((o) => o.trim()).filter(Boolean);
  }
  return ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001'];
}

@WebSocketGateway({
  cors: {
    origin: wsOrigins(),
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      if (!token) {
        client.emit('error', 'Authentication required');
        client.disconnect();
        return;
      }
      const payload = this.jwtService.verify(token as string);
      const userId = payload.sub || payload.id;
      if (!userId) {
        client.emit('error', 'Invalid token payload');
        client.disconnect();
        return;
      }
      client.data.userId = userId;
      client.join(`user:${userId}`);
      client.emit('connected', { userId });
    } catch {
      client.emit('error', 'Invalid token');
      client.disconnect();
    }
  }

  handleDisconnect(_client: Socket) {}

  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
