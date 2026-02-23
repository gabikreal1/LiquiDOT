import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DashboardService, DashboardResponse } from './dashboard.service';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @ApiOperation({ summary: 'Get aggregated dashboard data for a user' })
  @Get(':userId')
  async getDashboard(@Param('userId') userId: string): Promise<DashboardResponse> {
    return this.dashboardService.getDashboard(userId);
  }
}
