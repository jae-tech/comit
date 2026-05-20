import {
  Controller,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Header,
  HttpCode,
  HttpStatus,
  UnprocessableEntityException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { AdminGuard } from '@/common/guards/admin.guard';
import { AdminService } from './admin.service';
import { AdminChangePasswordSchema, AdminSetActiveSchema } from '@comit/shared';

@Controller('admin')
@UseGuards(ThrottlerGuard, JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @Header('Cache-Control', 'private, max-age=30')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('keywords')
  @Header('Cache-Control', 'private, max-age=60')
  getKeywords(@Query('limit') limit?: string) {
    const parsed = limit ? parseInt(limit, 10) : undefined;
    return this.adminService.getKeywords(
      parsed && Number.isFinite(parsed) && parsed > 0
        ? Math.min(parsed, 500)
        : 100,
    );
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteUser(id);
  }

  @Patch('users/:id/active')
  @HttpCode(HttpStatus.NO_CONTENT)
  setUserActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const parsed = AdminSetActiveSchema.safeParse(body);
    if (!parsed.success) throw new UnprocessableEntityException('Validation failed');
    return this.adminService.setUserActive(id, parsed.data.isActive);
  }

  @Patch('users/:id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changeUserPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const parsed = AdminChangePasswordSchema.safeParse(body);
    if (!parsed.success) throw new UnprocessableEntityException('Validation failed');
    return this.adminService.changeUserPassword(id, parsed.data.newPassword);
  }
}
