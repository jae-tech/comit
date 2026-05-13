import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { EmbeddingProcessor } from './embedding.processor';
import { Document } from '../database/entities/document.entity';
import { DocumentChunk } from '../database/entities/document-chunk.entity';
import { ProvidersModule } from '../providers/providers.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { EMBEDDING_QUEUE } from './constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, DocumentChunk]),
    BullModule.registerQueue({ name: EMBEDDING_QUEUE }),
    ProvidersModule,
    WorkspacesModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, EmbeddingProcessor],
})
export class DocumentsModule {}
