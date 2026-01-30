# Investment Decision Worker

## Overview

The Investment Decision Worker is a scheduled background service that automatically analyzes available liquidity pools and executes investments based on user preferences. This is the core automation engine that makes LiquiDOT "hands-off" for users.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Investment Decision Worker                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │   Scheduler  │───▶│  Pool Matcher │───▶│ Investment Exec  │  │
│  │  (Cron Job)  │    │    Engine     │    │     Service      │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
│         │                   │                     │              │
│         ▼                   ▼                     ▼              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │ User Prefs   │    │  Pools DB    │    │ AssetHubService  │  │
│  │   (DB)       │    │              │    │ .dispatchInvest  │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Core Responsibilities

1. **Scheduled Execution** - Run at configurable intervals (default: every hour)
2. **User Preference Matching** - For each user with `autoInvestEnabled=true`, find pools matching their criteria
3. **Pool Scoring** - Rank matched pools by APR, TVL, volume
4. **Investment Execution** - Call `AssetHubService.dispatchInvestment()` for selected pools
5. **Position Tracking** - Create Position records in DB with `PENDING_EXECUTION` status
6. **Event Handling** - Listen for `InvestmentInitiated` events to confirm dispatch

## Data Flow

```
1. Scheduler triggers worker (every N seconds based on user preference)
2. Query users WHERE autoInvestEnabled = true
3. For each user:
   a. Get user's available balance on AssetHub
   b. Get user's preferences (minApr, minTvl, preferredTokens, ranges)
   c. Query pools matching criteria
   d. Score and rank pools
   e. Select top pool(s) within allocation limits
   f. Call dispatchInvestment() with calculated parameters
   g. Create Position record with status=PENDING_EXECUTION
4. Listen for InvestmentInitiated event
5. Update Position with assetHubPositionId
```

## Configuration

| Env Variable | Default | Description |
|--------------|---------|-------------|
| `ENABLE_INVESTMENT_WORKER` | `true` | Enable/disable the worker |
| `INVESTMENT_CHECK_INTERVAL_MS` | `3600000` | Global check interval (1 hour) |
| `MAX_INVESTMENTS_PER_RUN` | `10` | Max investments per worker run |
| `MIN_INVESTMENT_AMOUNT` | `1000000000000` | Min investment in wei (1 DOT) |

## Implementation Decisions (Confirmed)

### ✅ Decision 1: Investment Allocation Strategy
**Answer:** Defined in strategy spec (`defi_investment_bot_spec.md`)

From the strategy:
- `max_positions`: Maximum concurrent positions (e.g., 6)
- `max_alloc_per_pos_usd`: Maximum allocation per position
- Greedy allocation from top-scored pools
- Minimum position size: $3,000 (skip smaller allocations)

---

### ✅ Decision 2: User Balance Source
**Answer:** Hybrid

- Cache balance in DB for quick reads
- Verify on-chain before executing any investment
- Update cache on deposit/withdrawal events

---

### ✅ Decision 3: Investment Trigger
**Answer:** Take from strategy spec

From the strategy:
- **Execution frequency**: Every 3-4 hours or on trigger
- Rebalance conditions based on utility improvement formula
- Daily rebalance limit (default: 8)

---

### ✅ Decision 4: Concurrent Positions
**Answer:** Multiple positions allowed, one position per pool

- Users can have up to `max_positions` active positions
- Only one position per pool per user
- Multiple pools allowed simultaneously

---

### ✅ Decision 5: Re-Investment After Liquidation
**Answer:** Auto re-invest

- Returned funds automatically become available for next investment cycle
- Strategy engine will include them in next rebalancing decision
- No manual intervention required

---

## Proposed Service Structure

```typescript
// investment-decision.service.ts
@Injectable()
export class InvestmentDecisionService {
  // Core methods
  async runInvestmentCycle(): Promise<void>
  async findEligibleUsers(): Promise<User[]>
  async matchPoolsForUser(user: User, prefs: UserPreference): Promise<Pool[]>
  async scoreAndRankPools(pools: Pool[], prefs: UserPreference): Promise<ScoredPool[]>
  async executeInvestment(user: User, pool: Pool, amount: bigint, prefs: UserPreference): Promise<Position>
  
  // Helpers
  async getUserAvailableBalance(user: User): Promise<bigint>
  async calculateInvestmentAmount(user: User, pool: Pool, prefs: UserPreference): Promise<bigint>
}

// investment-decision.worker.ts (Scheduler)
@Injectable()
export class InvestmentDecisionWorker {
  @Cron('0 * * * *') // Every hour
  async handleCron(): Promise<void>
}
```

## Dependencies

- `PoolsService` - Query pool data
- `UsersService` - Query user data  
- `PreferencesService` - Query user preferences
- `PositionsService` - Create/update position records
- `AssetHubService` - Execute on-chain investment
- `@nestjs/schedule` - Cron scheduling

## Next Steps

1. Answer clarifying questions above
2. Implement `InvestmentDecisionService`
3. Implement `InvestmentDecisionWorker` with cron
4. Add event listener for `InvestmentInitiated` → update Position
5. Integration tests
