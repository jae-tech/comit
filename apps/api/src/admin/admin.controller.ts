import { Controller, Get, UseGuards, Header } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { AdminGuard } from '@/common/guards/admin.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(ThrottlerGuard, JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @Header('Cache-Control', 'private, max-age=30')
  getStats() {
    return this.adminService.getStats();
  }
}
