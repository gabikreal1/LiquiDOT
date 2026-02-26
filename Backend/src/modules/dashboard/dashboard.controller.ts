import { Controller, Get, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService, DashboardResponse } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Get aggregated dashboard data for a user
   * GET /dashboard/:userId — AUTH + IDOR
   */
  @ApiOperation({ summary: 'Get aggregated dashboard data for a user' })
  @UseGuards(JwtAuthGuard)
  @Get(':userId')
  async getDashboard(@Param('userId') userId: string, @CurrentUser() currentUser: User): Promise<DashboardResponse> {
    if (currentUser.id !== userId) throw new ForbiddenException();
    return this.dashboardService.getDashboard(userId);
  }
}
