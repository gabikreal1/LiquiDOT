import { Controller, Param, Sse, MessageEvent, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PositionEventBusService, PositionEvent } from './position-event-bus.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('positions')
@ApiBearerAuth()
@Controller('positions')
export class PositionsSseController {
  constructor(private readonly positionEventBus: PositionEventBusService) {}

  /**
   * SSE stream of position events for a user
   * GET /positions/user/:userId/events — AUTH + IDOR
   */
  @ApiOperation({ summary: 'SSE stream of position events for a user' })
  @UseGuards(JwtAuthGuard)
  @Sse('user/:userId/events')
  positionEvents(@Param('userId') userId: string, @CurrentUser() currentUser: User): Observable<MessageEvent> {
    if (currentUser.id !== userId) throw new ForbiddenException();
    return this.positionEventBus.subscribe(userId).pipe(
      map((event: PositionEvent) => ({
        data: JSON.stringify(event),
        type: event.type,
      })),
    );
  }
}
