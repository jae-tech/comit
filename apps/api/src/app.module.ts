import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { RedisModule } from '@nestjs-modules/ioredis';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DrizzleModule } from './database/drizzle.module';
import { AuthModule } from './auth/auth.module';
import { ProvidersModule } from './providers/providers.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { DocumentsModule } from './documents/documents.module';
import { ChatModule } from './chat/chat.module';
import { DemoModule } from './demo/demo.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),

    DrizzleModule,

    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'single',
        url: config.getOrThrow<string>('REDIS_URL'),
      }),
    }),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        url: config.getOrThrow<string>('REDIS_URL'),
      }),
    }),

    AuthModule,
    ProvidersModule,
    WorkspacesModule,
    DocumentsModule,
    ChatModule,
    DemoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
