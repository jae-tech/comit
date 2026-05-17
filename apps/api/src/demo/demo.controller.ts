import {
  Controller,
  Post,
  Get,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Res,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { DemoService } from './demo.service';
import { DemoThrottlerGuard } from './demo-throttler.guard';
import { DemoChatDto, DemoSettingsDto, AddPersonaDto } from './demo.dto';

@ApiTags('demo')
@UseGuards(DemoThrottlerGuard)
@Controller('demo')
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  /**
   * POST /demo/chat
   * Public SSE endpoint — no JWT. Rate-limited by IP via DemoThrottlerGuard.
   */
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '데모 채팅 스트림 (SSE, 인증 불필요)' })
  // eslint-disable-next-line @typescript-eslint/require-await
  async chat(@Body() dto: DemoChatDto, @Res() reply: FastifyReply) {
    const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim());
    const reqOrigin =
      (reply.request as { headers: Record<string, string> }).headers[
        'origin'
      ] ?? '';
    const origin = allowedOrigins.includes(reqOrigin)
      ? reqOrigin
      : allowedOrigins[0];

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': origin,
    });

    const stream$ = this.demoService.streamChat(dto.question, dto.sessionId);

    const subscription = stream$.subscribe({
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

    reply.raw.on('close', () => subscription.unsubscribe());
  }

  /**
   * GET /demo/docs
   */
  @Get('docs')
  @ApiOperation({ summary: '데모 문서 목록' })
  getDocs() {
    return this.demoService.getDocs();
  }

  /**
   * GET /demo/info
   */
  @Get('info')
  @ApiOperation({ summary: '데모 워크스페이스 정보' })
  getInfo() {
    return this.demoService.getInfo();
  }

  /**
   * PATCH /demo/settings
   */
  @Patch('settings')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '데모 워크스페이스 설정 변경' })
  updateSettings(@Body() dto: DemoSettingsDto) {
    return this.demoService.updateSettings(dto);
  }

  /**
   * POST /demo/personas
   */
  @Post('personas')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '페르소나 추가' })
  addPersona(@Body() dto: AddPersonaDto) {
    return this.demoService.addPersona(dto);
  }

  /**
   * PUT /demo/personas/:id/activate
   */
  @Put('personas/:id/activate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '페르소나 활성화' })
  async activatePersona(@Param('id') id: string) {
    try {
      await this.demoService.activatePersona(id);
    } catch {
      throw new NotFoundException(`Persona ${id} not found`);
    }
  }

  /**
   * DELETE /demo/personas/:id
   */
  @Delete('personas/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '페르소나 삭제' })
  async removePersona(@Param('id') id: string) {
    try {
      await this.demoService.removePersona(id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('기본 페르소나')) throw new ForbiddenException(msg);
      throw e;
    }
  }
}
