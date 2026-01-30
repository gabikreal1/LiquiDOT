# Stop-Loss Worker

## Overview

The Stop-Loss Worker continuously monitors active LP positions on Moonbeam and automatically triggers liquidation when positions move outside the user's configured price range. This protects users from impermanent loss and implements automated risk management.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Stop-Loss Worker                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │   Scheduler  │───▶│   Position   │───▶│   Liquidation    │  │
│  │  (Interval)  │    │   Monitor    │    │    Executor      │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
│         │                   │                     │              │
│         ▼                   ▼                     ▼              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │ Positions DB │    │ MoonbeamSvc  │    │ MoonbeamService  │  │
│  │ (ACTIVE)     │    │ .isOutOfRange│    │ .liquidateSwap   │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Core Responsibilities

1. **Position Monitoring** - Poll active positions at regular intervals
2. **Range Check** - Call `MoonbeamService.isPositionOutOfRange()` for each position
3. **Liquidation Trigger** - When out of range, call `MoonbeamService.liquidateSwapAndReturn()`
4. **Status Updates** - Update Position status in DB (ACTIVE → LIQUIDATED)
5. **Settlement Tracking** - Listen for `LiquidationCompleted` events
6. **AssetHub Settlement** - Call `AssetHubService.settleLiquidation()` after XCM arrives

## Data Flow

```
1. Scheduler triggers every N seconds (e.g., 30s)
2. Query positions WHERE status = 'ACTIVE'
3. For each position:
   a. Call MoonbeamService.isPositionOutOfRange(moonbeamPositionId)
   b. If outOfRange = true:
      - Update position status to OUT_OF_RANGE
      - Build XCM destination bytes for AssetHub
      - Call MoonbeamService.liquidateSwapAndReturn(params)
      - Update position status to LIQUIDATED
4. Listen for LiquidationCompleted event from Moonbeam
5. After XCM transfer completes (assets arrive at AssetHub):
   a. Call AssetHubService.settleLiquidation(positionId, amount)
   b. Update user balance
   c. Mark position as fully settled
```

## Configuration

| Env Variable | Default | Description |
|--------------|---------|-------------|
| `ENABLE_STOP_LOSS_WORKER` | `true` | Enable/disable the worker |
| `STOP_LOSS_CHECK_INTERVAL_MS` | `30000` | Check interval (30 seconds) |
| `STOP_LOSS_BATCH_SIZE` | `50` | Max positions to check per run |
| `LIQUIDATION_SLIPPAGE_BPS` | `100` | Slippage tolerance (1%) |

## Position States

```
PENDING_EXECUTION → ACTIVE → OUT_OF_RANGE → LIQUIDATED
                      ↓
                   FAILED (if execution fails)
```

## Implementation Decisions (Confirmed)

### ✅ Decision 1: Monitoring Frequency
**Answer:** Configurable via environment variable

- Default: `STOP_LOSS_CHECK_INTERVAL_MS=30000` (30 seconds)
- Can be adjusted per deployment needs
- Higher frequency = better protection, higher costs

---

### ✅ Decision 2: Liquidation Execution
**Answer:** Protocol pays gas, deduct from user's returned amount

- Relayer executes all liquidations
- Gas cost deducted from user's returned funds
- Transparent fee shown in transaction logs

---

### ✅ Decision 3: Settlement Flow
**Answer:** Polling + XCM tracking

- Poll user balance after XCM is sent
- Track XCM message status via relay chain
- Update position status upon confirmation

---

### ✅ Decision 4: Failed Liquidation Handling
**Answer:** Alert for manual intervention

- On failure, send alert notification
- Manual review required
- Position stays in OUT_OF_RANGE until resolved

---

### ✅ Decision 5: Take-Profit Implementation
**Answer:** Upper bound of concentrated liquidity range

- When price reaches the upper tick of the LP position range, trigger take-profit
- Same liquidation flow as stop-loss, but for profitable exits
- Uses existing `isPositionOutOfRange()` - position is "out of range" at either bound

---

### ✅ Decision 6: Multiple Liquidation Sources
**Answer:** Simple DB lock for MVP

- Mark position as `LIQUIDATING` in DB before calling contract
- Prevents double-liquidation if both worker and manual trigger fire
- Simple and safe approach

---

## Proposed Service Structure

```typescript
// stop-loss.service.ts
@Injectable()
export class StopLossService {
  // Core methods
  async checkAndLiquidatePositions(): Promise<LiquidationResult[]>
  async checkPositionRange(position: Position): Promise<RangeCheckResult>
  async executeLiquidation(position: Position): Promise<LiquidationResult>
  async settleLiquidation(position: Position, amount: bigint): Promise<void>
  
  // Helpers
  async buildLiquidationParams(position: Position): Promise<LiquidateParams>
  async updatePositionStatus(positionId: string, status: PositionStatus): Promise<void>
}

// stop-loss.worker.ts (Scheduler)
@Injectable()
export class StopLossWorker {
  @Interval(30000) // Every 30 seconds
  async handleInterval(): Promise<void>
}
```

## Event Handling

```typescript
// Events to listen for:
// From Moonbeam XCMProxy:
- LiquidationCompleted(positionId, assetHubPositionId, user, baseAsset, totalReturned)
- AssetsReturned(token, user, destination, amount, positionId)
- XcmTransferAttempt(token, dest, amount, success, errorData)

// From AssetHub (if implemented):
- LiquidationSettled(positionId, user, receivedAmount, expectedAmount)
```

## Dependencies

- `PositionsService` - Query/update position records
- `MoonbeamService` - Check range, execute liquidation
- `AssetHubService` - Settle liquidation on AssetHub
- `XcmRetryService` - Handle failed XCM operations
- `BlockchainEventListenerService` - Listen for completion events
- `@nestjs/schedule` - Interval scheduling

## Edge Cases to Handle

1. **Position already liquidated** - Check on-chain state before executing
2. **XCM fails mid-flight** - Retry logic with XcmRetryService
3. **Price moves back in range** - Don't cancel mid-liquidation
4. **Multiple workers running** - Database locking to prevent double-liquidation
5. **Gas price spikes** - Dynamic gas estimation or gas budget limits

## Next Steps

1. Answer clarifying questions above
2. Implement `StopLossService`
3. Implement `StopLossWorker` with interval scheduler
4. Add event listeners for liquidation completion
5. Implement settlement flow
6. Integration tests with mock positions
