import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProvidersService } from './providers.service';
import { CreateProviderDto, UpdateProviderDto } from './providers.dto';

@ApiTags('providers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('providers')
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Post()
  @ApiOperation({ summary: 'API Key 등록 (등록 시 validation 수행)' })
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateProviderDto) {
    return this.providersService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: '등록된 provider 목록' })
  findAll(@CurrentUser() user: { id: string }) {
    return this.providersService.findAll(user.id);
  }

  @Get('models')
  @ApiOperation({ summary: '등록된 API 키로 사용 가능한 LLM 모델 목록 조회' })
  @ApiQuery({ name: 'provider', enum: ['openai', 'anthropic', 'gemini'] })
  getModels(
    @CurrentUser() user: { id: string },
    @Query('provider') provider: string,
  ) {
    return this.providersService.getModels(user.id, provider);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Provider 수정' })
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateProviderDto,
  ) {
    return this.providersService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Provider 삭제' })
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.providersService.remove(user.id, id);
  }
}
