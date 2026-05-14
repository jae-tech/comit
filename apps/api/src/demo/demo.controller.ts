import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { DemoService } from './demo.service';
import { DemoThrottlerGuard } from './demo-throttler.guard';
import { DemoAdminGuard } from './demo-admin.guard';

class DemoChatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  question!: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}

class DemoSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  personaName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  systemPrompt?: string;
}

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
  async chat(
    @Body() dto: DemoChatDto,
    @Res() reply: FastifyReply,
  ) {
    const allowedOrigins = (
      process.env.FRONTEND_URL || 'http://localhost:3000'
    ).split(',').map((o) => o.trim());
    const reqOrigin = (reply.request as { headers: Record<string, string> }).headers['origin'] ?? '';
    const origin = allowedOrigins.includes(reqOrigin) ? reqOrigin : allowedOrigins[0];

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
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
   * 데모 워크스페이스 문서 목록 (공개).
   */
  @Get('docs')
  @ApiOperation({ summary: '데모 문서 목록 (공개)' })
  getDocs() {
    return this.demoService.getDocs();
  }

  /**
   * GET /demo/info
   * 데모 워크스페이스 공개 정보 (personaName, systemPrompt, model, documentCount).
   */
  @Get('info')
  @ApiOperation({ summary: '데모 워크스페이스 공개 정보' })
  getInfo() {
    return this.demoService.getInfo();
  }

  /**
   * PATCH /demo/admin/settings
   * 데모 워크스페이스 설정 변경 (DemoAdminGuard 보호).
   */
  @Patch('admin/settings')
  @UseGuards(DemoAdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '데모 워크스페이스 설정 변경 (관리자 전용)' })
  updateSettings(@Body() dto: DemoSettingsDto) {
    return this.demoService.updateSettings(dto);
  }
}
