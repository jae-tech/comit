import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsageService } from './usage.service';

@Controller('usage')
@UseGuards(JwtAuthGuard)
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get('summary')
  getSummary(@CurrentUser() user: { id: string }) {
    return this.usageService.getSummary(user.id);
  }

  @Get('daily')
  getDaily(
    @CurrentUser() user: { id: string },
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.usageService.getDaily(user.id, days);
  }

  @Get('sessions')
  getSessions(
    @CurrentUser() user: { id: string },
    @Query('workspaceId') workspaceId?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.usageService.getSessions(user.id, workspaceId, limit);
  }
}
