---
icon: database
---

# Data Models

LiquiDOT's database schema is designed to support efficient liquidity management, user preference tracking, and historical analytics.

## Database Technology

* **Primary Database:** PostgreSQL 15+
* **ORM:** TypeORM (NestJS backend)
* **Migration Tool:** TypeORM migrations
* **Backup Strategy:** Daily automated backups

## Schema Overview

```
Users ←→ UserPreferences
  ↓
Positions ←→ Pools ←→ Dexes
  ↓
Coins
```

## Core Tables

### Users

Stores user account information and balance tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing user ID |
| `wallet` | VARCHAR(42) | UNIQUE, NOT NULL | User's wallet address (0x...) |
| `balance` | DECIMAL(36,18) | NOT NULL, DEFAULT 0 | User's current balance |
| `token` | VARCHAR(42) | NOT NULL | Token contract address |
| `user_preferences_id` | INTEGER | FOREIGN KEY | Reference to UserPreferences |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Account creation timestamp |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Indexes:**
* `idx_users_wallet` on `wallet`
* `idx_users_token` on `token`

**Example:**
```sql
INSERT INTO users (wallet, balance, token, user_preferences_id) 
VALUES (
  '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  1000.5,
  '0xabc123...',
  1
);
```

### UserPreferences

Stores user-defined investment strategies and risk parameters.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing preference ID |
| `minimum_apy` | DECIMAL(5,2) | NOT NULL | Minimum acceptable APY (e.g., 5.50%) |
| `max_allocation_per_pool` | DECIMAL(5,2) | NOT NULL | Max % of portfolio per pool (e.g., 25.00%) |
| `user_coins` | TEXT[] | NOT NULL | Array of preferred coin addresses |
| `risk_tolerance` | INTEGER | CHECK (1-5) | Risk level: 1=Very Conservative, 5=Very Aggressive |
| `take_profit` | DECIMAL(5,2) | NOT NULL | Take profit threshold percentage (e.g., 15.00%) |
| `stop_loss` | DECIMAL(5,2) | NOT NULL | Stop loss threshold percentage (e.g., 5.00%) |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Preference creation timestamp |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Constraints:**
* `minimum_apy` must be >= 0
* `max_allocation_per_pool` must be between 0 and 100
* `take_profit` must be > 0
* `stop_loss` must be > 0

**Example:**
```sql
INSERT INTO user_preferences (
  minimum_apy, 
  max_allocation_per_pool, 
  user_coins, 
  risk_tolerance, 
  take_profit, 
  stop_loss
) VALUES (
  8.50,
  20.00,
  ARRAY['0xDOT123...', '0xUSDC456...'],
  3,
  15.00,
  5.00
);
```

### Positions

Tracks individual liquidity provider positions across chains.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing position ID |
| `position_hash` | VARCHAR(66) | UNIQUE, NOT NULL | Blockchain position identifier (bytes32) |
| `user_id` | INTEGER | FOREIGN KEY | Reference to Users |
| `pool_id` | INTEGER | FOREIGN KEY | Reference to Pools |
| `amount1_raw` | NUMERIC(78,0) | NOT NULL | Amount of first token (wei/smallest unit) |
| `amount2_raw` | NUMERIC(78,0) | NOT NULL | Amount of second token (wei/smallest unit) |
| `token_id1` | VARCHAR(42) | NOT NULL | First token contract address |
| `token_id2` | VARCHAR(42) | NOT NULL | Second token contract address |
| `entry_price` | DECIMAL(36,18) | NOT NULL | Price at position entry |
| `current_price` | DECIMAL(36,18) | | Current pool price (updated periodically) |
| `lower_tick` | INTEGER | NOT NULL | Lower tick boundary |
| `upper_tick` | INTEGER | NOT NULL | Upper tick boundary |
| `lower_range_percent` | DECIMAL(5,2) | NOT NULL | Lower range percentage (e.g., -5.00%) |
| `upper_range_percent` | DECIMAL(5,2) | NOT NULL | Upper range percentage (e.g., +10.00%) |
| `stop_loss_raw` | NUMERIC(78,0) | | Position-specific stop loss (wei) |
| `take_profit_raw` | NUMERIC(78,0) | | Position-specific take profit (wei) |
| `status` | VARCHAR(20) | NOT NULL | ACTIVE, CLOSED, LIQUIDATED |
| `chain_id` | INTEGER | NOT NULL | Parachain ID (e.g., 1284 for Moonbeam) |
| `liquidity` | NUMERIC(78,0) | NOT NULL | LP liquidity amount |
| `fees_earned_0` | NUMERIC(78,0) | DEFAULT 0 | Fees earned in token0 |
| `fees_earned_1` | NUMERIC(78,0) | DEFAULT 0 | Fees earned in token1 |
| `timestamp` | TIMESTAMP | DEFAULT NOW() | Position creation time |
| `closed_at` | TIMESTAMP | | Position close timestamp |
| `profit_loss` | DECIMAL(36,18) | | Final P&L at close |

**Indexes:**
* `idx_positions_user` on `user_id`
* `idx_positions_pool` on `pool_id`
* `idx_positions_status` on `status`
* `idx_positions_hash` on `position_hash`

**Example:**
```sql
INSERT INTO positions (
  position_hash,
  user_id,
  pool_id,
  amount1_raw,
  amount2_raw,
  token_id1,
  token_id2,
  entry_price,
  lower_tick,
  upper_tick,
  lower_range_percent,
  upper_range_percent,
  status,
  chain_id,
  liquidity
) VALUES (
  '0x1234567890abcdef...',
  1,
  5,
  1000000000000000000,  -- 1 DOT
  50000000,              -- 50 USDC
  '0xDOT...',
  '0xUSDC...',
  50.25,
  -887220,
  887220,
  -5.00,
  10.00,
  'ACTIVE',
  1284,
  15000000000
);
```

### Pools

Stores DEX liquidity pool information and analytics.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing pool ID |
| `pool_address` | VARCHAR(42) | UNIQUE, NOT NULL | Pool's contract address |
| `token_id1` | VARCHAR(42) | NOT NULL | First token contract address |
| `token_id2` | VARCHAR(42) | NOT NULL | Second token contract address |
| `volume_24hr` | DECIMAL(36,18) | NOT NULL | 24-hour trading volume (USD) |
| `tvl` | DECIMAL(36,18) | NOT NULL | Total value locked (USD) |
| `fee_tier` | INTEGER | NOT NULL | Fee tier in basis points (e.g., 500 = 0.05%) |
| `apy` | DECIMAL(5,2) | | Annual percentage yield |
| `dex_id` | INTEGER | FOREIGN KEY | Reference to Dexes |
| `tick_spacing` | INTEGER | NOT NULL | Tick spacing for price ranges |
| `current_tick` | INTEGER | | Current price tick |
| `sqrt_price_x96` | NUMERIC(78,0) | | Current sqrt price (Q64.96 format) |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Pool discovery timestamp |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last analytics update |

**Indexes:**
* `idx_pools_address` on `pool_address`
* `idx_pools_dex` on `dex_id`
* `idx_pools_tokens` on `token_id1, token_id2`
* `idx_pools_tvl` on `tvl` (for ranking)

**Example:**
```sql
INSERT INTO pools (
  pool_address,
  token_id1,
  token_id2,
  volume_24hr,
  tvl,
  fee_tier,
  apy,
  dex_id,
  tick_spacing
) VALUES (
  '0xPoolABC123...',
  '0xDOT...',
  '0xUSDC...',
  1250000.50,
  5000000.00,
  500,
  12.50,
  1,
  10
);
```

### Dexes

Stores DEX protocol information and chain mappings.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing DEX ID |
| `dex_name` | VARCHAR(50) | NOT NULL | DEX name (e.g., "Algebra", "Uniswap") |
| `dex_address` | VARCHAR(42) | NOT NULL | DEX router/factory address |
| `chain_id` | INTEGER | NOT NULL | Chain ID (e.g., 1284 for Moonbeam) |
| `chain_name` | VARCHAR(50) | NOT NULL | Human-readable chain name |
| `protocol_type` | VARCHAR(20) | NOT NULL | "UniswapV3", "Algebra", "Curve", etc. |
| `is_active` | BOOLEAN | DEFAULT TRUE | Whether DEX is currently supported |
| `created_at` | TIMESTAMP | DEFAULT NOW() | DEX addition timestamp |

**Indexes:**
* `idx_dexes_chain` on `chain_id`
* `idx_dexes_name` on `dex_name`

**Example:**
```sql
INSERT INTO dexes (
  dex_name,
  dex_address,
  chain_id,
  chain_name,
  protocol_type
) VALUES (
  'Algebra Integral',
  '0xAlgebra123...',
  1284,
  'Moonbeam',
  'Algebra'
);
```

### Coins

Stores cryptocurrency/token metadata and market information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing coin ID |
| `coin_address` | VARCHAR(42) | UNIQUE, NOT NULL | Token contract address |
| `symbol` | VARCHAR(10) | NOT NULL | Trading symbol (e.g., "DOT", "USDC") |
| `name` | VARCHAR(100) | NOT NULL | Full token name |
| `decimals` | INTEGER | NOT NULL | Number of decimal places (e.g., 18) |
| `market_cap` | DECIMAL(36,2) | | Market capitalization (USD) |
| `latest_price` | DECIMAL(36,18) | | Most recent price (USD) |
| `price_change_24h` | DECIMAL(5,2) | | 24hr price change percentage |
| `chain_id` | INTEGER | NOT NULL | Chain where token exists |
| `is_stablecoin` | BOOLEAN | DEFAULT FALSE | Whether token is a stablecoin |
| `coingecko_id` | VARCHAR(100) | | CoinGecko API identifier |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Token addition timestamp |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last price update |

**Indexes:**
* `idx_coins_address` on `coin_address`
* `idx_coins_symbol` on `symbol`
* `idx_coins_chain` on `chain_id`

**Example:**
```sql
INSERT INTO coins (
  coin_address,
  symbol,
  name,
  decimals,
  market_cap,
  latest_price,
  chain_id,
  coingecko_id
) VALUES (
  '0xDOT123...',
  'DOT',
  'Polkadot',
  10,
  9500000000.00,
  6.75,
  1000,
  'polkadot'
);
```

## Relationships

### One-to-One
* `Users` ↔ `UserPreferences` (each user has one preference set)

### One-to-Many
* `Users` → `Positions` (one user can have many positions)
* `Pools` → `Positions` (one pool can have many positions)
* `Dexes` → `Pools` (one DEX can have many pools)

### Many-to-Many (through arrays)
* `UserPreferences.user_coins` → `Coins` (users can prefer multiple coins)

## Views

### Active Positions View

```sql
CREATE VIEW active_positions_view AS
SELECT 
  p.id,
  p.position_hash,
  u.wallet,
  pool.pool_address,
  c1.symbol AS token1_symbol,
  c2.symbol AS token2_symbol,
  p.amount1_raw::DECIMAL / POWER(10, c1.decimals) AS amount1,
  p.amount2_raw::DECIMAL / POWER(10, c2.decimals) AS amount2,
  p.entry_price,
  p.current_price,
  p.lower_range_percent,
  p.upper_range_percent,
  p.status,
  d.dex_name,
  d.chain_name
FROM positions p
JOIN users u ON p.user_id = u.id
JOIN pools pool ON p.pool_id = pool.id
JOIN coins c1 ON p.token_id1 = c1.coin_address
JOIN coins c2 ON p.token_id2 = c2.coin_address
JOIN dexes d ON pool.dex_id = d.id
WHERE p.status = 'ACTIVE';
```

### Pool Rankings View

```sql
CREATE VIEW pool_rankings_view AS
SELECT 
  p.pool_address,
  c1.symbol || '/' || c2.symbol AS pair,
  p.tvl,
  p.volume_24hr,
  p.apy,
  p.fee_tier,
  d.dex_name,
  d.chain_name,
  (p.volume_24hr / NULLIF(p.tvl, 0)) * 100 AS turnover_ratio
FROM pools p
JOIN coins c1 ON p.token_id1 = c1.coin_address
JOIN coins c2 ON p.token_id2 = c2.coin_address
JOIN dexes d ON p.dex_id = d.id
WHERE p.tvl > 10000
ORDER BY p.apy DESC;
```

## Migrations

Migrations are managed through TypeORM:

```bash
# Generate migration
npm run migration:generate -- -n CreateUsersTable

# Run migrations
npm run migration:run

# Revert migration
npm run migration:revert
```

## Data Types & Precision

### Why NUMERIC(78,0) for Raw Amounts?

Ethereum uses uint256 (256-bit unsigned integers) for token amounts. The maximum value is 2^256 - 1, which is approximately 1.15 × 10^77. PostgreSQL's `NUMERIC(78,0)` can store up to 78 digits, which is sufficient.

### Why DECIMAL(36,18) for Prices?

Provides 18 decimal places of precision (matching Solidity's standard) with a maximum value of 10^18, suitable for most token prices and amounts.

## Backup & Recovery

### Automated Backups

```bash
# Daily backup
pg_dump liquidot > backup_$(date +%Y%m%d).sql

# Compress
gzip backup_$(date +%Y%m%d).sql
```

### Restore

```bash
# Restore from backup
gunzip -c backup_20250101.sql.gz | psql liquidot
```

## Performance Optimization

### Index Strategy
* Index all foreign keys
* Index frequently queried columns (wallet, pool_address)
* Composite index on (user_id, status) for fast active position queries

### Query Optimization
* Use prepared statements
* Implement connection pooling
* Cache frequently accessed data (pool rankings, coin prices)
* Partition large tables (positions) by date

## Next Steps

* [Architecture](architecture.md) - System design overview
* [Smart Contracts](smart-contracts.md) - Contract data structures
* [API Reference](api-reference.md) - API endpoints and queries
