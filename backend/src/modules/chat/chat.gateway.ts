import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { WsJwtGuard } from '../../common/guards/ws-jwt.guard';

@WebSocketGateway({ namespace: '/chat', cors: { origin: '*' } })
@UseGuards(WsJwtGuard)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: Socket) {}
  handleDisconnect(client: Socket) {}

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    const user = client.data.user;
    if (!user) throw new WsException('Unauthorized');

    const canJoin = await this.chatService.canAccessConversation(user.id, payload.conversationId);
    if (!canJoin) {
      throw new WsException('Forbidden');
    }

    client.join(payload.conversationId);
    return { event: 'joined', data: payload.conversationId };
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string; content: string; type?: 'text' | 'icebreaker' },
  ) {
    const user = client.data.user;
    const canAccess = await this.chatService.canAccessConversation(user.id, payload.conversationId);
    if (!canAccess) throw new WsException('Forbidden');
    if (!payload.content || payload.content.length > 1000) throw new WsException('Invalid content');

    const message = await this.chatService.saveMessage(
      user.id,
      payload.conversationId,
      payload.content,
      payload.type || 'text',
    );

    this.server.to(payload.conversationId).emit('new_message', message);
    return { success: true, messageId: message.id };
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    const user = client.data.user;
    client.to(payload.conversationId).emit('user_typing', {
      conversationId: payload.conversationId,
      userId: user.id,
    });
  }

  @SubscribeMessage('read_message')
  async handleReadMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId: string },
  ) {
    const user = client.data.user;
    const message = await this.chatService.markAsRead(user.id, payload.messageId);
    if (message) {
      this.server.to(message.conversationId).emit('message_read', {
        messageId: message.id,
        readAt: new Date().toISOString(),
      });
    }
  }
}
