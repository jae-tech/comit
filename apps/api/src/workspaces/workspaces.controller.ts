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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { WorkspacesService } from './workspaces.service';
import {
  UpdateWorkspaceDto,
  SetActiveProviderDto,
} from './dto/update-workspace.dto';

@ApiTags('workspaces')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  @ApiOperation({ summary: 'Workspace 생성' })
  create(@CurrentUser() user: { id: string }, @Body('name') name: string) {
    return this.workspacesService.create(user.id, name);
  }

  @Get()
  @ApiOperation({ summary: '내 Workspace 목록' })
  findAll(@CurrentUser() user: { id: string }) {
    return this.workspacesService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Workspace 상세' })
  findOne(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.workspacesService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Workspace 페르소나 설정 업데이트' })
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspacesService.update(id, user.id, dto);
  }

  @Patch(':id/provider')
  @ApiOperation({ summary: 'Workspace의 활성 AI Provider 설정' })
  setActiveProvider(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: SetActiveProviderDto,
  ) {
    return this.workspacesService.setActiveProvider(
      id,
      user.id,
      dto.providerId,
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Workspace 삭제 (문서/채팅 기록 포함)' })
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.workspacesService.remove(id, user.id);
  }
}
