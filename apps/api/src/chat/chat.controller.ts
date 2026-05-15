import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import type { ChatQueryDto } from '@comit/shared';

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * POST /chat/query
   * fetch + ReadableStream 방식 (SSE).
   * 브라우저 native EventSource는 GET only라 POST로 처리.
   * Content-Type: text/event-stream
   */
  @Post('query')
  @ApiOperation({ summary: 'RAG 검색 + 스트리밍 응답 (SSE via fetch)' })
  // eslint-disable-next-line @typescript-eslint/require-await
  async query(
    @CurrentUser() user: { id: string },
    @Body() dto: ChatQueryDto,
    @Res() reply: FastifyReply,
  ) {
    const origin =
      (reply.request as { headers: Record<string, string> }).headers[
        'origin'
      ] ?? '*';
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
    });

    const stream$ = this.chatService.streamQuery(user.id, dto);

    stream$.subscribe({
      next: (event) => {
        reply.raw.write(`data: ${event.data}\n\n`);
      },
      error: (err: Error) => {
        reply.raw.write(
          `data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`,
        );
        reply.raw.end();
      },
      complete: () => {
        reply.raw.end();
      },
    });
  }

  @Get('sessions')
  @ApiOperation({ summary: '채팅 세션 목록' })
  getSessions(
    @CurrentUser() user: { id: string },
    @Query('workspaceId') workspaceId: string,
  ) {
    return this.chatService.getSessions(workspaceId, user.id);
  }

  @Get('sessions/:sessionId/messages')
  @ApiOperation({ summary: '세션 메시지 히스토리' })
  getMessages(
    @CurrentUser() user: { id: string },
    @Param('sessionId') sessionId: string,
  ) {
    return this.chatService.getMessages(sessionId, user.id);
  }
}
