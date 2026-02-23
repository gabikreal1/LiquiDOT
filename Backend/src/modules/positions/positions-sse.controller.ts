import { Controller, Param, Sse, MessageEvent } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PositionEventBusService, PositionEvent } from './position-event-bus.service';

@ApiTags('positions')
@Controller('positions')
export class PositionsSseController {
  constructor(private readonly positionEventBus: PositionEventBusService) {}

  @ApiOperation({ summary: 'SSE stream of position events for a user' })
  @Sse('user/:userId/events')
  positionEvents(@Param('userId') userId: string): Observable<MessageEvent> {
    return this.positionEventBus.subscribe(userId).pipe(
      map((event: PositionEvent) => ({
        data: JSON.stringify(event),
        type: event.type,
      })),
    );
  }
}
