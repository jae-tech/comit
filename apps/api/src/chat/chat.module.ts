import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatSession } from '../database/entities/chat-session.entity';
import { ChatMessage } from '../database/entities/chat-message.entity';
import { ProvidersModule } from '../providers/providers.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatSession, ChatMessage]),
    ProvidersModule,
    WorkspacesModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
