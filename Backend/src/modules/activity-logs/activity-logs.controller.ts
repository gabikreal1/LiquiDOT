import { Controller, Get, Param, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ActivityLogsService } from './activity-logs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('activity')
@ApiBearerAuth()
@Controller('users/:userId/activity')
@UseGuards(JwtAuthGuard)
export class ActivityLogsController {
    constructor(private readonly service: ActivityLogsService) { }

    /**
     * Get user activity history
     * GET /users/:userId/activity — AUTH + IDOR
     */
    @ApiOperation({ summary: 'Get user activity history' })
    @Get()
    async getUserActivity(
        @Param('userId') userId: string,
        @CurrentUser() currentUser: User,
        @Query('limit') limit = 20,
        @Query('offset') offset = 0,
    ) {
        if (currentUser.id !== userId) throw new ForbiddenException();
        const [logs, count] = await this.service.findByUser(userId, Number(limit), Number(offset));
        return { logs, count };
    }
}
