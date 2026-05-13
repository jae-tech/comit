import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import '@fastify/multipart';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DocumentsService } from './documents.service';

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @ApiOperation({ summary: '문서 업로드 (PDF, TXT, MD)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  async upload(
    @CurrentUser() user: { id: string },
    @Query('workspaceId') workspaceId: string,
    @Req() req: FastifyRequest,
  ) {
    if (!workspaceId) throw new BadRequestException('workspaceId is required');
    const data = await req.file();
    if (!data) throw new BadRequestException('No file uploaded');

    const allowedMimes = ['application/pdf', 'text/plain', 'text/markdown'];
    const allowedExts = /\.(pdf|txt|md)$/i;
    if (!allowedMimes.includes(data.mimetype) || !allowedExts.test(data.filename)) {
      throw new BadRequestException('Unsupported file type. Allowed: PDF, TXT, MD');
    }

    const buffer = await data.toBuffer();
    return this.documentsService.upload(workspaceId, user.id, {
      originalname: data.filename,
      mimetype: data.mimetype,
      size: buffer.length,
      buffer,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Workspace 문서 목록' })
  findAll(
    @CurrentUser() user: { id: string },
    @Query('workspaceId') workspaceId: string,
  ) {
    return this.documentsService.findAll(workspaceId, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: '문서 상세 + status' })
  findOne(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Query('workspaceId') workspaceId: string,
  ) {
    return this.documentsService.findOne(id, workspaceId, user.id);
  }

  @Get(':id/status')
  @ApiOperation({ summary: '문서 embedding 상태 SSE 스트림' })
  async getStatus(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Query('workspaceId') workspaceId: string,
    @Res() reply: FastifyReply,
  ) {
    const origin = (reply.request as { headers: Record<string, string> }).headers['origin'] ?? '*';
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
    });

    // 초기 상태 즉시 전송
    const doc = await this.documentsService.findOne(id, workspaceId, user.id);
    reply.raw.write(`data: ${JSON.stringify({ status: doc.status, progress: this.statusToProgress(doc.status) })}\n\n`);

    if (doc.status === 'ready' || doc.status === 'failed') {
      reply.raw.end();
      return;
    }

    // 폴링: 1초마다 상태 확인 (최대 5분)
    const MAX_POLLS = 300;
    let polls = 0;

    const interval = setInterval(async () => {
      polls++;
      try {
        const current = await this.documentsService.findOne(id, workspaceId, user.id);
        reply.raw.write(`data: ${JSON.stringify({ status: current.status, progress: this.statusToProgress(current.status) })}\n\n`);

        if (current.status === 'ready' || current.status === 'failed' || polls >= MAX_POLLS) {
          clearInterval(interval);
          reply.raw.end();
        }
      } catch {
        clearInterval(interval);
        reply.raw.end();
      }
    }, 1000);

    reply.raw.on('close', () => clearInterval(interval));
  }

  private statusToProgress(status: string): number {
    const map: Record<string, number> = {
      pending: 0,
      processing: 50,
      ready: 100,
      failed: 0,
    };
    return map[status] ?? 0;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '문서 삭제 (chunks + 파일 cascade)' })
  remove(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Query('workspaceId') workspaceId: string,
  ) {
    return this.documentsService.remove(id, workspaceId, user.id);
  }
}
