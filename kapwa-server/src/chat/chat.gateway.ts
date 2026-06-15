import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private userSockets = new Map<string, string[]>();

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
  ) {}

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
      client.data.userId = userId;

      const existing = this.userSockets.get(userId) || [];
      existing.push(client.id);
      this.userSockets.set(userId, existing);

      client.join(`user:${userId}`);
      client.emit('connected', { userId });
    } catch {
      client.emit('error', 'Invalid token');
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      const sockets = this.userSockets.get(userId)?.filter(s => s !== client.id) || [];
      if (sockets.length === 0) this.userSockets.delete(userId);
      else this.userSockets.set(userId, sockets);
    }
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { recipientId: string; content: string; senderName: string },
  ) {
    const senderId = client.data.userId;
    if (!senderId) return { error: 'Not authenticated' };

    const msg = await this.chatService.sendMessage(
      senderId,
      data.senderName || 'Unknown',
      data.recipientId,
      data.content,
    );

    this.server.to(`user:${data.recipientId}`).emit('new_message', msg);
    this.server.to(`user:${senderId}`).emit('new_message', msg);

    return { status: 'sent', message: msg };
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string },
  ) {
    await this.chatService.markAsRead(data.messageId);
    return { status: 'read' };
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { recipientId: string },
  ) {
    const senderId = client.data.userId;
    this.server.to(`user:${data.recipientId}`).emit('user_typing', { userId: senderId });
  }
}
