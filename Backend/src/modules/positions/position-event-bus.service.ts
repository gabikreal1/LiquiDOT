import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';

export interface PositionEvent {
  type: 'CREATED' | 'EXECUTED' | 'LIQUIDATED' | 'FAILED' | 'STATUS_CHANGE' | 'BALANCE_CHANGED';
  positionId: string;
  status: string;
  txHash?: string;
  timestamp: Date;
  balanceDot?: number;
  balanceUsd?: number;
}

@Injectable()
export class PositionEventBusService {
  private readonly logger = new Logger(PositionEventBusService.name);
  private readonly subject = new Subject<PositionEvent & { userId: string }>();

  /**
   * Emit a position event for a specific user
   */
  emit(userId: string, event: PositionEvent): void {
    this.subject.next({ ...event, userId });
    this.logger.debug(`Position event: ${event.type} for position ${event.positionId} (user: ${userId})`);
  }

  /**
   * Subscribe to position events for a specific user
   */
  subscribe(userId: string): Observable<PositionEvent> {
    return this.subject.pipe(
      filter((event) => event.userId === userId),
    );
  }
}
