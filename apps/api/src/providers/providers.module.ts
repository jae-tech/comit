import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';
import { EncryptionService } from './encryption.service';
import { AiProvider } from '../database/entities/ai-provider.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AiProvider])],
  controllers: [ProvidersController],
  providers: [ProvidersService, EncryptionService],
  exports: [ProvidersService, EncryptionService],
})
export class ProvidersModule {}
