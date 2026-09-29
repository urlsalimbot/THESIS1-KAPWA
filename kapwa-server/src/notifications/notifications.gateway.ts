import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../auth/user.entity';

// Roles whose live whereabouts are staff-visible. Only sockets with one of
// these roles join the shared 'team' room; claimants and other roles never
// receive whereabouts broadcasts (the notifications namespace also serves
// claimants).
const TEAM_ROLES = [UserRole.ADMIN, UserRole.SW, UserRole.COORDINATOR];

// CORS origins for the notifications socket. Accepts the NOTIF_WS_ORIGIN
// allowlist (comma-separated, e.g. "https://kapwa.software") plus the APP_URL
// origin, merged with the localhost dev defaults so local dev keeps working
// even when production origins are configured. Kept as an allowlist — no
// wildcard — so only the configured origins (plus localhost) are accepted.
function wsOrigins(): string[] {
  const configured = (process.env.NOTIF_WS_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) configured.push(appUrl);
  const defaults = ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001'];
  return Array.from(new Set([...defaults, ...configured]));
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
      // Staff roles follow live whereabouts via the shared 'team' room;
      // claimants and other roles never join it. Role comes from the verified
      // JWT payload (same payload the JwtStrategy validates for HTTP routes).
      if (TEAM_ROLES.includes(payload.role)) {
        client.join('team');
      }
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

  /**
   * Broadcasts a staff member's status change to every socket attached to the
   * shared `team` room (staff and coordinators that joined `team` to follow
   * live whereabouts). Mirrors emitToUser's server.to(room).emit(event, data)
   * pattern.
   */
  broadcastTeamStatus(payload: {
    userId: string;
    status: string;
    note?: string | null;
    updatedAt: string;
  }) {
    this.server.to('team').emit('team.status.updated', payload);
  }
}
