import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ActivityLogsService } from './activity-logs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('activity')
@ApiBearerAuth()
@Controller('users/:userId/activity')
@UseGuards(JwtAuthGuard)
export class ActivityLogsController {
    constructor(private readonly service: ActivityLogsService) { }

    @ApiOperation({ summary: 'Get user activity history' })
    @Get()
    async getUserActivity(
        @Param('userId') userId: string,
        @Query('limit') limit = 20,
        @Query('offset') offset = 0,
    ) {
        const [logs, count] = await this.service.findByUser(userId, Number(limit), Number(offset));
        return { logs, count };
    }
}
