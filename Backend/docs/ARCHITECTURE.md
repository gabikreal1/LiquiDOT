# Architecture Guide

This document provides a deeper look at the LiquiDOT backend architecture, how components interact, and key design decisions.

## System Architecture

```
                                    ┌─────────────────────────────────────┐
                                    │           Frontend (Next.js)         │
                                    │     - Wallet connection (RainbowKit) │
                                    │     - Position monitoring            │
                                    │     - Preference configuration       │
                                    └──────────────────┬──────────────────┘
                                                       │ REST API
                                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                               Backend (NestJS)                                        │
│                                                                                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ UsersController │  │ PositionsCtrl   │  │ PreferencesCtrl │  │  PoolsController│  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │                    │           │
│  ┌────────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐  │
│  │  UsersService   │  │PositionsService │  │PreferencesService│ │  PoolsService   │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │                    │           │
│           └────────────────────┴──────────┬─────────┴────────────────────┘           │
│                                           │                                          │
│                                   ┌───────▼───────┐                                  │
│                                   │   TypeORM     │                                  │
│                                   │  (Database)   │                                  │
│                                   └───────────────┘                                  │
│                                                                                       │
│  ╔═══════════════════════════════════════════════════════════════════════════════╗   │
│  ║                         WORKERS (Scheduled Tasks)                              ║   │
│  ╠═══════════════════════════════════════════════════════════════════════════════╣   │
│  ║  ┌─────────────────────────────┐    ┌─────────────────────────────────────┐   ║   │
│  ║  │  InvestmentDecisionWorker   │    │      StopLossService                │   ║   │
│  ║  │  (Every 4 hours)            │    │      (Every 30 seconds)             │   ║   │
│  ║  │                             │    │                                      │   ║   │
│  ║  │  - Evaluate all users       │    │  - Check position ranges            │   ║   │
│  ║  │  - Build optimal portfolios │    │  - Detect out-of-range              │   ║   │
│  ║  │  - Execute rebalancing      │    │  - Trigger take-profit              │   ║   │
│  ║  └──────────────┬──────────────┘    │  - Handle liquidations              │   ║   │
│  ║                 │                   └──────────────┬────────────────────┬──┘   ║   │
│  ╚═════════════════╪═══════════════════════════════════╪════════════════════╪═════╝   │
│                    │                                   │                    │         │
│           ┌────────▼───────────────────────────────────▼────────────────────▼──┐      │
│           │                    Blockchain Module                               │      │
│           │  ┌──────────────────┐          ┌──────────────────────┐           │      │
│           │  │  AssetHubService │          │   MoonbeamService    │           │      │
│           │  │                  │          │                      │           │      │
│           │  │  - XCM transfers │◄────────►│  - DEX interactions  │           │      │
│           │  │  - Balance reads │          │  - Position NFTs     │           │      │
│           │  │  - Vault contract│          │  - Liquidity ops     │           │      │
│           │  └──────────────────┘          └──────────────────────┘           │      │
│           └────────────────────────────────────────────────────────────────────┘      │
│                                           │                                          │
└───────────────────────────────────────────┼──────────────────────────────────────────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    │                       │                       │
                    ▼                       ▼                       ▼
         ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
         │   Asset Hub      │    │    Moonbeam      │    │   PostgreSQL     │
         │   (Polkadot)     │    │   (EVM Chain)    │    │   (Database)     │
         │                  │    │                  │    │                  │
         │  AssetHubVault   │◄──►│   XCMProxy.sol   │    │  Users, Pools,   │
         │  contract        │XCM │   DEX Contracts  │    │  Positions, etc. │
         └──────────────────┘    └──────────────────┘    └──────────────────┘
```

---

## Module Structure

```
Backend/src/
├── app.module.ts              # Root module, imports all feature modules
├── health.controller.ts       # Health check endpoints
├── main.ts                    # Application entry point
│
└── modules/
    ├── blockchain/            # Chain interactions
    │   ├── services/
    │   │   ├── asset-hub.service.ts      # Asset Hub / XCM operations
    │   │   ├── moonbeam.service.ts       # Moonbeam DEX operations
    │   │   ├── event-listener.service.ts # Blockchain event listening
    │   │   ├── event-persistence.service.ts # Persist events to DB
    │   │   ├── test-mode.service.ts      # Test mode management
    │   │   ├── xcm-builder.service.ts    # XCM message construction
    │   │   └── xcm-retry.service.ts      # Retry logic for XCM
    │   └── blockchain.module.ts
    │
    ├── pools/                 # Liquidity pool data
    │   ├── entities/
    │   │   └── pool.entity.ts
    │   ├── pools.service.ts
    │   ├── pools.controller.ts
    │   └── pools.module.ts
    │
    ├── users/                 # User management
    │   ├── entities/
    │   │   └── user.entity.ts
    │   ├── users.service.ts
    │   ├── users.controller.ts
    │   └── users.module.ts
    │
    ├── positions/             # Position tracking + real-time events
    │   ├── entities/
    │   │   └── position.entity.ts        # Includes assetHubTxHash, moonbeamTxHash
    │   ├── positions.service.ts
    │   ├── positions.controller.ts
    │   ├── positions-sse.controller.ts    # SSE endpoint for real-time position events
    │   ├── position-event-bus.service.ts  # In-memory rxjs Subject per userId
    │   ├── position-sync.service.ts       # Periodic on-chain sync (every 30min)
    │   └── positions.module.ts
    │
    ├── preferences/           # User preferences
    │   ├── entities/
    │   │   └── user-preference.entity.ts
    │   ├── preferences.service.ts
    │   ├── preferences.controller.ts
    │   └── preferences.module.ts
    │
    ├── investment-decision/   # Core algorithm
    │   ├── types/
    │   │   └── investment.types.ts
    │   ├── investment-decision.controller.ts  # REST API
    │   ├── investment-decision.service.ts     # Core logic
    │   ├── investment-decision.worker.ts      # Scheduled task (XCM retry + Phase 2 polling)
    │   └── investment-decision.module.ts
    │
    ├── dashboard/             # Aggregated dashboard API
    │   ├── dashboard.controller.ts   # GET /dashboard/:userId
    │   ├── dashboard.service.ts      # Pre-aggregated portfolio data
    │   └── dashboard.module.ts
    │
    └── stop-loss-worker/      # Position monitoring
        ├── types/
        │   └── stop-loss.types.ts
        ├── stop-loss.service.ts       # Batch pool state optimization (15s cache)
        └── stop-loss.module.ts
```

---

## Key Design Decisions

### 1. Separation of Chains

**Problem**: We operate across two chains (Asset Hub and Moonbeam) with different SDKs.

**Solution**: Dedicated services for each chain:
- `AssetHubService` - Polkadot.js for Asset Hub operations
- `MoonbeamService` - Ethers.js for Moonbeam/EVM operations

XCM messages bridge between them, initiated from Asset Hub.

### 2. Worker-Based Architecture

**Problem**: Investment decisions and position monitoring must run continuously without user interaction.

**Solution**: NestJS scheduled workers:
- `InvestmentDecisionWorker` - Runs every 4 hours
- `StopLossService` - Runs every 30 seconds

Benefits:
- Decoupled from API requests
- Can be scaled independently
- Clear separation of concerns

### 3. Database Locking for Concurrency

**Problem**: Multiple workers might try to liquidate the same position simultaneously.

**Solution**: Database-level locking pattern:
```typescript
async acquireLock(positionId: string): Promise<Position | null> {
  const result = await this.positionRepository
    .createQueryBuilder()
    .update(Position)
    .set({ isLiquidating: true })
    .where('id = :id AND isLiquidating = false', { id: positionId })
    .returning('*')
    .execute();
  
  return result.raw[0] ?? null;
}
```

### 4. Event-Driven Balance Cache

**Problem**: Querying blockchain balances on every request is slow and expensive.

**Solution**: Cache balances and update via events:
```typescript
// Balance is cached in memory
private balanceCache: Map<string, { balance: bigint; timestamp: Date }>;

// Refresh when:
// 1. Cache miss
// 2. Cache older than 5 minutes
// 3. Explicit sync request
```

### 5. Type-Safe Contract Interactions

**Problem**: ABI interactions are error-prone without type checking.

**Solution**: TypeChain generates TypeScript types from ABIs:
```typescript
// Generated types ensure compile-time safety
const vault: AssetHubVault = AssetHubVault__factory.connect(address, signer);
await vault.deposit(amount, recipient); // Fully typed!
```

---

## Data Flow Examples

### User Registration Flow

```
Frontend                    Backend                      Database
   │                           │                            │
   │  POST /users              │                            │
   │  {walletAddress: "0x.."} ─┼──►                         │
   │                           │   Check if user exists     │
   │                           │ ─────────────────────────► │
   │                           │ ◄───────────────────────── │
   │                           │                            │
   │                           │   (if new) Create user     │
   │                           │ ─────────────────────────► │
   │                           │ ◄───────────────────────── │
   │                           │                            │
   │  ◄── {id, walletAddress} ─┼                            │
   │                           │                            │
```

### Investment Decision Flow

```
Scheduler                InvestmentWorker           Services              Blockchain
   │                           │                       │                       │
   │  Trigger (every 4h)       │                       │                       │
   ├──────────────────────────►│                       │                       │
   │                           │                       │                       │
   │                           │  Get active users     │                       │
   │                           ├──────────────────────►│                       │
   │                           │◄─────────────────────┤│                       │
   │                           │                       │                       │
   │                           │  For each user:       │                       │
   │                           │    Get balance        │                       │
   │                           │    ───────────────────┼──────────────────────►│
   │                           │    ◄──────────────────┼───────────────────────│
   │                           │                       │                       │
   │                           │    Get preferences    │                       │
   │                           │    ───────────────────►                       │
   │                           │    ◄──────────────────│                       │
   │                           │                       │                       │
   │                           │    Get candidate pools│                       │
   │                           │    ───────────────────►                       │
   │                           │    ◄──────────────────│                       │
   │                           │                       │                       │
   │                           │  ┌────────────────────┤                       │
   │                           │  │ Calculate optimal  │                       │
   │                           │  │ portfolio          │                       │
   │                           │  └────────────────────┤                       │
   │                           │                       │                       │
   │                           │  If shouldRebalance:  │                       │
   │                           │    Execute trades     │                       │
   │                           │    ───────────────────┼──────────────────────►│
   │                           │    ◄──────────────────┼───────────────────────│
   │                           │                       │                       │
   │                           │    Update positions   │                       │
   │                           │    ───────────────────►                       │
   │                           │                       │                       │
```

### Stop-Loss Monitoring Flow

```
Scheduler              StopLossService            Database            Blockchain
   │                        │                        │                     │
   │  Trigger (30s)         │                        │                     │
   ├───────────────────────►│                        │                     │
   │                        │                        │                     │
   │                        │  Get active positions  │                     │
   │                        ├───────────────────────►│                     │
   │                        │◄──────────────────────┤│                     │
   │                        │                        │                     │
   │                        │  For each position:    │                     │
   │                        │    Get pool tick       │                     │
   │                        │    ──────────────────────────────────────────►
   │                        │    ◄─────────────────────────────────────────│
   │                        │                        │                     │
   │                        │  If out of range:      │                     │
   │                        │    Acquire DB lock     │                     │
   │                        │    ─────────────────────►                    │
   │                        │    ◄────────────────────│                    │
   │                        │                        │                     │
   │                        │    (if lock acquired)  │                     │
   │                        │    Liquidate position  │                     │
   │                        │    ──────────────────────────────────────────►
   │                        │    ◄─────────────────────────────────────────│
   │                        │                        │                     │
   │                        │    Update status       │                     │
   │                        │    ─────────────────────►                    │
   │                        │    Release lock        │                     │
   │                        │    ─────────────────────►                    │
```

---

## Error Handling Strategy

### Blockchain Errors

```typescript
try {
  const tx = await moonbeamService.addLiquidity(...);
  await tx.wait();
} catch (error) {
  if (error.code === 'CALL_EXCEPTION') {
    // Contract reverted - handle gracefully
    position.status = PositionStatus.FAILED;
  } else if (error.code === 'NETWORK_ERROR') {
    // Retry with exponential backoff
    throw new RetryableError(error);
  }
  throw error;
}
```

### XCM Errors

XCM operations use `XcmRetryService.executeWithRetry()` for resilience:
- Error classification: `TRANSIENT` (retryable) vs `PERMANENT` (fail immediately)
- Configurable retry policy (default: 3 attempts with exponential backoff)
- All three event-listener orchestration paths are wrapped (executePendingInvestment, confirmExecution, settleLiquidation)
- Investment worker Phase 2 uses dedicated retry (5 attempts, 3s base delay) with XCM arrival polling
- On exhausted retries: position marked FAILED, error ActivityLog created with calldata for manual recovery

### Database Errors

- Transactions for multi-step operations
- Optimistic locking where appropriate
- Graceful degradation on connection issues

---

## Security Considerations

### Wallet Security
- Private keys stored in environment variables
- Never logged or exposed via API
- Consider HSM/KMS for production

### Input Validation
- All API inputs validated with class-validator
- Wallet addresses normalized to lowercase
- Numeric bounds enforced

### Rate Limiting
- Daily rebalance limits per user
- Burst protection (max 2/hour)
- API rate limiting (future)

### Database Security
- Parameterized queries (TypeORM handles this)
- No raw SQL exposure
- Connection encryption in production

---

## Monitoring & Observability

### Health Checks

```
GET /health            → Simple "ok" for load balancers
GET /health/detailed   → Full system status
GET /health/test-mode  → Test mode synchronization status
```

### Logging

Structured logging with log levels:
```typescript
this.logger.log('Processing user', { userId, capital });
this.logger.warn('Rate limit approaching', { userId, count });
this.logger.error('Liquidation failed', { positionId, error });
```

### Metrics (Future)

Planned metrics:
- Portfolio APY distribution
- Rebalance frequency histogram
- Position success/failure rates
- XCM success rates
- Database query latencies

---

## Event Persistence Architecture

The `EventPersistenceService` bridges blockchain events to database state:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BlockchainEventListenerService                    │
│  ┌─────────────────┐            ┌─────────────────────────────────┐ │
│  │  AssetHub Events │            │      Moonbeam Events           │ │
│  │  - Deposit       │            │  - AssetsReceived              │ │
│  │  - Withdrawal    │            │  - PendingPositionCreated      │ │
│  │  - Investment    │            │  - PositionExecuted            │ │
│  │  - Execution     │            │  - PositionLiquidated          │ │
│  │  - Liquidation   │            │  - PendingPositionCancelled    │ │
│  └────────┬─────────┘            └─────────────┬───────────────────┘ │
│           │                                    │                     │
│           └────────────────┬───────────────────┘                     │
│                            │                                         │
└────────────────────────────┼─────────────────────────────────────────┘
                             │ registerCallbacks()
                             ▼
┌────────────────────────────────────────────────────────────────────┐
│                    EventPersistenceService                          │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │                    Event Handlers                               ││
│  │  handleDeposit()           → Create/update User + ActivityLog  ││
│  │  handleInvestmentInitiated() → Create Position + assetHubTxHash││
│  │  handleExecutionConfirmed()  → Update Position (ACTIVE)        ││
│  │  handleMoonbeamPositionExecuted() → Set moonbeamTxHash         ││
│  │  handlePositionLiquidated()  → Update Position (LIQUIDATED)    ││
│  │  handleLiquidationSettled()  → Create ActivityLog + txHash     ││
│  │  handlePendingPositionCancelled() → Update Position (FAILED)   ││
│  └────────────────────────────────────────────────────────────────┘│
│                            │                                        │
│                            ├──► PositionEventBusService (SSE)       │
│                            │                                        │
└────────────────────────────┼────────────────────────────────────────┘
                             │ TypeORM Repositories
                             ▼
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │  ┌───────────┐  │
                    │  │   Users   │  │
                    │  │ Positions │  │
                    │  │   Pools   │  │
                    │  │ActivityLog│  │
                    │  └───────────┘  │
                    └─────────────────┘
```

**Position State Machine:**
```
  PENDING ──► ACTIVE ──► LIQUIDATION_PENDING ──► LIQUIDATED
     │                                               ▲
     └──► FAILED ────────────────────────────────────┘
```

---

## Testing Strategy

### Unit Tests
- Service methods in isolation
- Mock database repositories
- Mock blockchain services
- Test files: `*.spec.ts`

### Integration Tests
- Database operations with test database
- Full API endpoint testing
- Test files: `test/*.e2e-spec.ts`

**Run Tests:**
```bash
pnpm test           # Unit tests
pnpm run test:cov   # With coverage
pnpm run test:e2e   # End-to-end tests
```
- Worker execution paths

### E2E Tests (Future)
- Full flow from API to blockchain
- Testnet deployments
- Simulated market conditions
