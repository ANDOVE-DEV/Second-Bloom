import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient<Socket>();
    
    // Attempt to extract token from auth payload or handshake headers
    const token = client.handshake?.auth?.token || client.handshake?.headers?.authorization?.split(' ')[1];

    if (!token) {
      throw new WsException('Unauthorized: Missing auth token');
    }

    try {
      const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
      if (!secret) {
        throw new Error('JWT configuration missing');
      }

      const payload = await this.jwtService.verifyAsync(token, { secret });
      
      // Attach user payload to the socket client for later use
      client.data.user = { id: payload.sub, email: payload.email };
      return true;
    } catch {
      throw new WsException('Unauthorized: Invalid or expired token');
    }
  }
}
