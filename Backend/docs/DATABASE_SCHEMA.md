# Database Schema

This document describes the database structure for the LiquiDOT backend.

## Entity Relationship Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                               DATABASE SCHEMA                              │
└──────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐       ┌─────────────────┐       ┌─────────────────────┐
│      User       │       │   UserPreference │       │     Position        │
├─────────────────┤       ├─────────────────┤       ├─────────────────────┤
│ id (PK)         │──┬──<│ id (PK)         │       │ id (PK)             │
│ walletAddress   │  │    │ userId (FK)     │>──────│ userId (FK)         │>─┐
│ isActive        │  │    │ minApy          │       │ poolId (FK)         │>─┼─┐
│ createdAt       │  │    │ maxPositions    │       │ assetHubPositionId  │  │ │
│ updatedAt       │  │    │ autoInvest...   │       │ moonbeamPositionId  │  │ │
└─────────────────┘  │    │ ...             │       │ baseAsset           │  │ │
                     │    └─────────────────┘       │ amount              │  │ │
                     │                              │ liquidity           │  │ │
                     │                              │ lowerRangePercent   │  │ │
                     │                              │ upperRangePercent   │  │ │
                     │                              │ lowerTick           │  │ │
                     │                              │ upperTick           │  │ │
                     │                              │ entryPrice          │  │ │
                     │                              │ status              │  │ │
                     │                              │ chainId             │  │ │
                     │                              │ returnedAmount      │  │ │
                     │                              │ executedAt          │  │ │
                     │                              │ liquidatedAt        │  │ │
                     │                              │ createdAt           │  │ │
                     │                              │ updatedAt           │  │ │
                     │                              └─────────────────────┘  │ │
                     │                                                       │ │
                     └───────────────────────────────────────────────────────┘ │
                                                                               │
┌─────────────────┐       ┌─────────────────┐                                  │
│      Dex        │       │      Pool       │<─────────────────────────────────┘
├─────────────────┤       ├─────────────────┤
│ id (PK)         │──────<│ id (PK)         │
│ name            │       │ poolAddress     │
│ factoryAddress  │       │ dexId (FK)      │
│ routerAddress   │       │ token0Address   │
│ chainId         │       │ token1Address   │
│ createdAt       │       │ token0Symbol    │
│ updatedAt       │       │ token1Symbol    │
└─────────────────┘       │ fee             │
                          │ liquidity       │
                          │ sqrtPriceX96    │
                          │ tick            │
                          │ volume24h       │
                          │ tvl             │
                          │ apr             │
                          │ chainId         │
                          │ isActive        │
                          │ lastSyncedAt    │
                          │ createdAt       │
                          │ updatedAt       │
                          └─────────────────┘
```

---

## Tables

### User

Stores registered users identified by their wallet address.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | auto-generated | Primary key |
| `walletAddress` | VARCHAR(42) | No | - | Ethereum wallet address (lowercase) |
| `isActive` | BOOLEAN | No | true | Whether user account is active |
| `createdAt` | TIMESTAMP | No | now() | Account creation time |
| `updatedAt` | TIMESTAMP | No | now() | Last update time |

**Indexes:**
- Primary key on `id`
- Unique index on `walletAddress`

**Relations:**
- Has many `Position`
- Has many `UserPreference`

---

### UserPreference

Stores investment strategy preferences for each user.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | auto | Primary key |
| `userId` | UUID | No | - | FK to User |
| `minApy` | DECIMAL | No | 8.0 | Minimum acceptable APY (%) |
| `maxPositions` | INT | No | 6 | Max concurrent positions |
| `maxAllocPerPositionUsd` | DECIMAL | No | 25000 | Max $ per position |
| `dailyRebalanceLimit` | INT | No | 8 | Max rebalances per day |
| `expectedGasUsd` | DECIMAL | No | 1.0 | Expected gas cost ($) |
| `lambdaRiskAversion` | DECIMAL | No | 0.5 | Risk aversion (0-1) |
| `thetaMinBenefit` | DECIMAL | No | 0.0 | Min utility improvement |
| `planningHorizonDays` | INT | No | 7 | Planning horizon (days) |
| `minTvlUsd` | DECIMAL | No | 1000000 | Min pool TVL ($) |
| `minPoolAgeDays` | INT | No | 14 | Min pool age (days) |
| `allowedTokens` | TEXT[] | Yes | null | Allowed token symbols |
| `preferredDexes` | TEXT[] | Yes | null | Preferred DEX names |
| `defaultLowerRangePercent` | DECIMAL | No | -5 | Default LP lower bound (%) |
| `defaultUpperRangePercent` | DECIMAL | No | 10 | Default LP upper bound (%) |
| `maxIlLossPercent` | DECIMAL | No | 6 | Max IL loss before exit (%) |
| `minPositionSizeUsd` | DECIMAL | No | 3000 | Min position size ($) |
| `autoInvestEnabled` | BOOLEAN | No | true | Enable auto-investment |
| `investmentCheckIntervalSeconds` | INT | No | 14400 | Check interval (4h) |
| `createdAt` | TIMESTAMP | No | now() | Creation time |
| `updatedAt` | TIMESTAMP | No | now() | Last update time |

**Indexes:**
- Primary key on `id`
- Unique index on `userId`

**Relations:**
- Belongs to `User`

---

### Position

Stores liquidity positions created by the system.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | auto | Primary key |
| `assetHubPositionId` | VARCHAR | Yes | null | Position ID on Asset Hub (XCM reference) |
| `moonbeamPositionId` | VARCHAR | Yes | null | NFT token ID on Moonbeam DEX |
| `userId` | UUID | No | - | FK to User |
| `poolId` | UUID | No | - | FK to Pool |
| `baseAsset` | VARCHAR(42) | No | - | Token address deposited |
| `amount` | DECIMAL | No | - | Amount deposited (wei) |
| `liquidity` | DECIMAL | Yes | null | LP token amount |
| `lowerRangePercent` | DECIMAL | No | - | Lower price range (%) |
| `upperRangePercent` | DECIMAL | No | - | Upper price range (%) |
| `lowerTick` | INT | No | - | Lower tick boundary |
| `upperTick` | INT | No | - | Upper tick boundary |
| `entryPrice` | DECIMAL | Yes | null | Entry price (wei) |
| `status` | ENUM | No | PENDING | Position status |
| `chainId` | INT | No | - | Target chain ID |
| `returnedAmount` | DECIMAL | Yes | null | Amount returned on exit |
| `executedAt` | TIMESTAMP | Yes | null | When position was opened |
| `liquidatedAt` | TIMESTAMP | Yes | null | When position was closed |
| `createdAt` | TIMESTAMP | No | now() | Creation time |
| `updatedAt` | TIMESTAMP | No | now() | Last update time |

**Position Status Enum:**
```typescript
enum PositionStatus {
  PENDING_EXECUTION = 'PENDING_EXECUTION',  // Awaiting XCM execution
  ACTIVE = 'ACTIVE',                        // Position is active
  OUT_OF_RANGE = 'OUT_OF_RANGE',           // Price outside LP range
  LIQUIDATED = 'LIQUIDATED',               // Position closed
  FAILED = 'FAILED'                        // Execution failed
}
```

**Indexes:**
- Primary key on `id`
- Index on `userId`
- Index on `poolId`
- Index on `status`
- Index on `chainId`

**Relations:**
- Belongs to `User`
- Belongs to `Pool`

---

### Pool

Stores DEX liquidity pool information.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | auto | Primary key |
| `poolAddress` | VARCHAR(42) | No | - | Pool contract address |
| `dexId` | UUID | No | - | FK to Dex |
| `token0Address` | VARCHAR(42) | No | - | Token 0 contract address |
| `token1Address` | VARCHAR(42) | No | - | Token 1 contract address |
| `token0Symbol` | VARCHAR(20) | No | - | Token 0 symbol (e.g., "USDC") |
| `token1Symbol` | VARCHAR(20) | No | - | Token 1 symbol (e.g., "WETH") |
| `fee` | INT | No | - | Fee tier (e.g., 3000 = 0.3%) |
| `liquidity` | DECIMAL | Yes | null | Current liquidity |
| `sqrtPriceX96` | VARCHAR | Yes | null | Current sqrt price (Q64.96) |
| `tick` | INT | Yes | null | Current tick |
| `volume24h` | DECIMAL | Yes | null | 24h volume in USD |
| `tvl` | DECIMAL | Yes | null | Total value locked (USD) |
| `apr` | DECIMAL | Yes | null | Estimated APR (%) |
| `chainId` | INT | No | - | Chain ID (e.g., 2004 for Moonbeam) |
| `isActive` | BOOLEAN | No | true | Whether pool is active |
| `lastSyncedAt` | TIMESTAMP | Yes | null | Last data sync time |
| `createdAt` | TIMESTAMP | No | now() | Creation time |
| `updatedAt` | TIMESTAMP | No | now() | Last update time |

**Indexes:**
- Primary key on `id`
- Unique index on (`poolAddress`, `chainId`)
- Index on `dexId`
- Index on `token0Symbol`
- Index on `token1Symbol`
- Index on `apr`
- Index on `tvl`

**Relations:**
- Belongs to `Dex`
- Has many `Position`

---

### Dex

Stores decentralized exchange information.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | auto | Primary key |
| `name` | VARCHAR(50) | No | - | DEX name (e.g., "StellaSwap") |
| `factoryAddress` | VARCHAR(42) | No | - | Factory contract address |
| `routerAddress` | VARCHAR(42) | Yes | null | Router contract address |
| `chainId` | INT | No | - | Chain ID |
| `createdAt` | TIMESTAMP | No | now() | Creation time |
| `updatedAt` | TIMESTAMP | No | now() | Last update time |

**Indexes:**
- Primary key on `id`
- Unique index on (`name`, `chainId`)
- Index on `factoryAddress`

**Relations:**
- Has many `Pool`

---

## Migrations

TypeORM manages migrations. To create and run migrations:

```bash
# Generate a new migration from entity changes
npm run migration:generate -- -n MigrationName

# Run pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert
```

---

## Data Types Notes

### Numeric Precision

- **Amounts (wei)**: Stored as DECIMAL(78,0) to handle uint256 values
- **USD values**: Stored as DECIMAL(18,2) for two decimal places
- **Percentages**: Stored as DECIMAL(10,4) for precision

### Addresses

- All Ethereum addresses stored as lowercase VARCHAR(42)
- Includes "0x" prefix

### Arrays

- PostgreSQL native TEXT[] arrays used for `allowedTokens` and `preferredDexes`
- Other databases may use JSON columns

---

## Sample Queries

### Get active positions with P&L calculation

```sql
SELECT 
  p.id,
  p.amount,
  p.status,
  pl.token0Symbol,
  pl.token1Symbol,
  pl.apr
FROM position p
JOIN pool pl ON p."poolId" = pl.id
WHERE p.status = 'ACTIVE'
ORDER BY p."createdAt" DESC;
```

### Get user's total investment

```sql
SELECT 
  u."walletAddress",
  COUNT(p.id) as position_count,
  SUM(p.amount) as total_invested
FROM "user" u
LEFT JOIN position p ON u.id = p."userId"
WHERE u."isActive" = true
GROUP BY u.id, u."walletAddress";
```

### Get top pools by TVL

```sql
SELECT 
  pool.*,
  dex.name as dex_name
FROM pool
JOIN dex ON pool."dexId" = dex.id
WHERE pool."isActive" = true
ORDER BY pool.tvl DESC
LIMIT 10;
```

---

## Backup and Recovery

### Export database

```bash
pg_dump -h localhost -U postgres -d liquidot > backup.sql
```

### Import database

```bash
psql -h localhost -U postgres -d liquidot < backup.sql
```

---

## Performance Considerations

1. **Indexes**: All foreign keys and frequently queried columns are indexed
2. **Pagination**: Use LIMIT/OFFSET for list queries
3. **Caching**: Balance queries are cached to reduce RPC calls
4. **Connection pooling**: TypeORM connection pool is configured via environment variables
