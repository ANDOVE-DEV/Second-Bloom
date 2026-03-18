import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { AuthModule } from '../auth/auth.module';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { IcebreakerTemplate } from './entities/icebreaker-template.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message, IcebreakerTemplate]),
    AuthModule,
  ],
  providers: [ChatService, ChatGateway]
})
export class ChatModule {}
