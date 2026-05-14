import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';
import { DemoThrottlerGuard } from './demo-throttler.guard';
import { ChatModule } from '../chat/chat.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    ChatModule,
    WorkspacesModule,
  ],
  controllers: [DemoController],
  providers: [DemoService, DemoThrottlerGuard],
})
export class DemoModule {}
