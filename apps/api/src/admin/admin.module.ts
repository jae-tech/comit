import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
