import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWorkspaceDto {
  @ApiPropertyOptional({ description: 'AI 페르소나 이름', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  personaName?: string;

  @ApiPropertyOptional({ description: '시스템 프롬프트 (null이면 기본값 사용)', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  systemPrompt?: string;
}
