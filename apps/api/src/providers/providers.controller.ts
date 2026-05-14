import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProvidersService } from './providers.service';
import type { CreateProviderDto } from '@comit/shared';

@ApiTags('providers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('providers')
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Post()
  @ApiOperation({ summary: 'API Key 등록 (등록 시 validation 수행)' })
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateProviderDto,
  ) {
    return this.providersService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: '등록된 provider 목록' })
  findAll(@CurrentUser() user: { id: string }) {
    return this.providersService.findAll(user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Provider 수정' })
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: Partial<CreateProviderDto>,
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
