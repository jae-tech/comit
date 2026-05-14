import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ProvidersModule } from '../providers/providers.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [ProvidersModule, WorkspacesModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
