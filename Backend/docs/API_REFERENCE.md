# API Reference

<<<<<<< Updated upstream
This document describes all REST API endpoints exposed by the LiquiDOT backend.

## Base URL

```
Development: http://localhost:3001
Production: https://api.liquidot.io
```

## Authentication

**MVP**: No authentication required. User identification is done via wallet address.

**Future**: Wallet signature verification will be added for sensitive operations.

---

## Health Endpoints

### GET /health

Basic health check for load balancers.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-30T12:00:00.000Z",
  "service": "liquidot-backend",
  "version": "1.0.0"
}
```

### GET /health/detailed

Detailed system status for monitoring.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-30T12:00:00.000Z",
  "service": "liquidot-backend",
  "version": "1.0.0",
  "checks": {
    "database": {
      "status": "ok",
      "latencyMs": 2
    },
    "uptime": 86400,
    "memoryUsage": {
      "heapUsed": 128,
      "heapTotal": 256,
      "rss": 312
    }
  }
}
```

---

### GET /health/test-mode

Get test mode synchronization status across backend and smart contracts.

**Response:**
```json
{
  "backendTestMode": true,
  "xcmProxyTestMode": true,
  "assetHubTestMode": true,
  "synchronized": true,
  "lastSyncTime": "2026-01-30T12:00:00.000Z"
}
```

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `backendTestMode` | boolean | Backend test mode flag |
| `xcmProxyTestMode` | boolean \| null | XCMProxy contract test mode (null if not connected) |
| `assetHubTestMode` | boolean \| null | AssetHubVault contract test mode (null if not connected) |
| `synchronized` | boolean | Whether all systems have matching test mode |
| `lastSyncTime` | string \| null | Last time test mode was synced to contracts |

**Notes:**
- Test mode is auto-enabled when `NODE_ENV=development` or `TEST_MODE=true`
- In test mode, XCM validation is skipped in contracts

---

## Users Endpoints

### POST /users

Register a new user. Called when user connects wallet on frontend.

**Request Body:**
```json
{
  "walletAddress": "0x1234567890abcdef1234567890abcdef12345678"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid-here",
  "walletAddress": "0x1234567890abcdef1234567890abcdef12345678",
  "isActive": true,
  "createdAt": "2026-01-30T12:00:00.000Z",
  "updatedAt": "2026-01-30T12:00:00.000Z"
}
```

**Notes:**
- If user already exists, returns existing user (idempotent)
- Wallet address is normalized to lowercase

---

### GET /users

List all users.

**Response:**
```json
[
  {
    "id": "uuid-1",
    "walletAddress": "0x1234...",
    "isActive": true,
    "createdAt": "2026-01-30T12:00:00.000Z"
  }
]
```

---

### GET /users/:id

Get user by ID.

**Parameters:**
- `id` (path) - User UUID

**Response:**
```json
{
  "id": "uuid-here",
  "walletAddress": "0x1234...",
  "isActive": true,
  "createdAt": "2026-01-30T12:00:00.000Z",
  "updatedAt": "2026-01-30T12:00:00.000Z",
  "positions": [...],
  "preferences": [...]
}
```

**Errors:**
- `404 Not Found` - User not found

---

### GET /users/wallet/:address

Get user by wallet address.

**Parameters:**
- `address` (path) - Ethereum wallet address

**Response:** Same as GET /users/:id

---

### GET /users/:id/balance

Get user's current balance.

**Response:**
```json
{
  "userId": "uuid-here",
  "walletAddress": "0x1234...",
  "balanceWei": "1000000000000000000",
  "balanceUsd": 1000.00,
  "lastSyncedAt": "2026-01-30T12:00:00.000Z"
}
```

**Notes:**
- Balance is cached and updated via blockchain events
- Use POST /users/:id/balance/sync to force refresh

---

### POST /users/:id/balance/sync

Force sync balance from blockchain.

**Response:** Same as GET /users/:id/balance

---

### POST /users/:id/deactivate

Deactivate a user account.

**Response:** Updated user object with `isActive: false`

---

### POST /users/:id/reactivate

Reactivate a user account.

**Response:** Updated user object with `isActive: true`

---

## Positions Endpoints

### GET /positions

List all positions with optional filters.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | string | Filter by user ID |
| `poolId` | string | Filter by pool ID |
| `status` | string | Filter by status (PENDING_EXECUTION, ACTIVE, OUT_OF_RANGE, LIQUIDATED, FAILED) |
| `limit` | number | Max results (default: 20) |
| `offset` | number | Pagination offset |

**Response:**
```json
[
  {
    "id": "uuid-here",
    "assetHubPositionId": "0x...",
    "moonbeamPositionId": "12345",
    "userId": "user-uuid",
    "poolId": "pool-uuid",
    "baseAsset": "0x...",
    "amount": "1000000000000000000000",
    "liquidity": "5000000000000000000",
    "lowerRangePercent": -5,
    "upperRangePercent": 10,
    "lowerTick": -100,
    "upperTick": 200,
    "entryPrice": "1000000000000000000",
    "status": "ACTIVE",
    "chainId": 2004,
    "returnedAmount": null,
    "executedAt": "2026-01-30T12:00:00.000Z",
    "liquidatedAt": null,
    "createdAt": "2026-01-30T11:00:00.000Z",
    "updatedAt": "2026-01-30T12:00:00.000Z",
    "pool": { ... }
  }
]
```

---

### GET /positions/active

Get all active positions across all users.

**Response:** Array of positions with status ACTIVE

---

### GET /positions/user/:userId

Get all positions for a specific user.

**Response:** Array of positions

---

### GET /positions/user/:userId/active

Get active positions for a specific user.

**Response:** Array of positions with status ACTIVE or PENDING_EXECUTION

---

### GET /positions/:id

Get single position by ID.

**Response:** Position object with relations

**Errors:**
- `404 Not Found` - Position not found

---

### GET /positions/:id/pnl

Get profit/loss calculation for a position.

**Response:**
```json
{
  "positionId": "uuid-here",
  "entryAmountUsd": 1000.00,
  "currentValueUsd": 1050.00,
  "feesEarnedUsd": 15.00,
  "ilLossUsd": 5.00,
  "netPnLUsd": 60.00,
  "netPnLPercent": 6.0
}
```

---

### POST /positions/:id/sync

Sync position with on-chain state.

**Response:** Updated position object

---

### GET /positions/pool/:poolId

Get all positions in a specific pool.

**Response:** Array of positions

---

## Preferences Endpoints

### GET /preferences/defaults

Get default preference values for new users.

**Response:**
```json
{
  "minApy": 8.0,
  "maxPositions": 6,
  "maxAllocPerPositionUsd": 25000,
  "dailyRebalanceLimit": 8,
  "expectedGasUsd": 1.0,
  "lambdaRiskAversion": 0.5,
  "thetaMinBenefit": 0.0,
  "planningHorizonDays": 7,
  "minTvlUsd": 1000000,
  "minPoolAgeDays": 14,
  "allowedTokens": ["USDC", "USDT", "WETH", "WGLMR", "xcDOT"],
  "preferredDexes": [],
  "defaultLowerRangePercent": -5,
  "defaultUpperRangePercent": 10,
  "maxIlLossPercent": 6.0,
  "minPositionSizeUsd": 3000,
  "autoInvestEnabled": true,
  "investmentCheckIntervalSeconds": 14400
}
```

---

### GET /preferences/:userId

Get preferences for a user.

**Response:** UserPreference object or `null` if not set

---

### GET /preferences/:userId/effective

Get effective preferences with defaults applied.

**Response:** Same structure as GET /preferences/defaults

---

### POST /preferences/:userId

Create preferences for a user.

**Request Body:**
```json
{
  "minApy": 10.0,
  "maxPositions": 4,
  "allowedTokens": ["USDC", "WETH"],
  "autoInvestEnabled": true
}
```

All fields are optional. Defaults are applied for missing fields.

**Response:** `201 Created` - UserPreference object

**Errors:**
- `400 Bad Request` - Preferences already exist (use PATCH instead)
- `400 Bad Request` - Validation error

---

### PATCH /preferences/:userId

Update preferences for a user.

**Request Body:** Same as POST, all fields optional

**Response:** Updated UserPreference object

**Notes:**
- If preferences don't exist, they are created

---

### DELETE /preferences/:userId

Delete preferences for a user.

**Response:** `204 No Content`

**Errors:**
- `404 Not Found` - Preferences not found

---

### POST /preferences/:userId/auto-invest

Toggle auto-invest setting.

**Request Body:**
```json
{
  "enabled": true
}
```

**Response:** Updated UserPreference object

---

## Investment Decisions Endpoints

These endpoints calculate optimal investment allocations using the portfolio optimization algorithm.

### POST /investmentDecisions

Calculate investment decisions for a user. This is the main endpoint used by the frontend.

**Request Body:**
```json
{
  "walletAddress": "0x1234567890abcdef1234567890abcdef12345678",
  "depositAmount": 1000,
  "selectedDepositCoin": "USDC",
  "preferences": {
    "minApy": 8,
    "maxAllocation": 25,
    "allowedTokens": ["DOT", "USDC", "GLMR", "USDT"],
    "riskStrategy": "moderate",
    "slTpRange": [-10, 20],
    "lambdaRiskAversion": 0.5
  }
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `walletAddress` | string | Yes | User's wallet address |
| `depositAmount` | number | No | Amount to invest in USD |
| `selectedDepositCoin` | string | No | Deposit token symbol |
| `preferences.minApy` | number | No | Minimum acceptable APY (%) |
| `preferences.maxAllocation` | number | No | Max allocation per pool (%) |
| `preferences.allowedTokens` | string[] | No | Allowed token symbols |
| `preferences.riskStrategy` | string | No | "conservative" \| "moderate" \| "aggressive" |
| `preferences.slTpRange` | [number, number] | No | [stopLoss, takeProfit] percentages |
| `preferences.lambdaRiskAversion` | number | No | Risk aversion (0-1, higher = more risk-averse) |

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Investment decisions calculated successfully",
  "decisions": [
    {
      "poolId": "pool-123",
      "pairName": "DOT/USDC",
      "token0": {
        "symbol": "DOT",
        "address": "0x1234...",
        "decimals": 10,
        "riskTier": "tier2"
      },
      "token1": {
        "symbol": "USDC",
        "address": "0x5678...",
        "decimals": 6,
        "riskTier": "tier1"
      },
      "approximateAPR": 18.5,
      "totalValueLockedUSD": 1000000,
      "stopLoss": -10,
      "takeProfit": 20,
      "proportion": 50,
      "poolAddress": "0xpool...",
      "dex": "Algebra",
      "fee": 3000,
      "realApy": 17.5,
      "effectiveApy": 16.8,
      "ilRiskFactor": 0.05,
      "utilityScore": 0.92,
      "allocationUsd": 500,
      "volume24hUsd": 50000,
      "poolAgeDays": 120
    }
  ],
  "metadata": {
    "totalCapitalUsd": 1000,
    "currentWeightedApy": 12.5,
    "idealWeightedApy": 18.3,
    "apyImprovement": 5.8,
    "estimatedGasUsd": 5,
    "profit30dUsd": 45,
    "netProfit30dUsd": 40,
    "calculatedAt": "2026-01-30T12:00:00.000Z",
    "currentUtility": 0.8,
    "targetUtility": 0.95,
    "netUtilityGain": 0.15,
    "shouldRebalance": true,
    "rebalancesToday": 0,
    "dailyRebalanceLimit": 3
  },
  "actions": {
    "toWithdraw": [],
    "toAdd": [...]
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "No deposit amount specified. Please enter an amount to invest.",
  "decisions": []
}
```

**Risk Strategy Mapping:**
| Strategy | Lambda (Risk Aversion) | Description |
|----------|------------------------|-------------|
| conservative | 0.8 | Prefers stable, lower-risk pools |
| moderate | 0.5 | Balanced risk/reward |
| aggressive | 0.2 | Maximizes APY, higher risk tolerance |

---

### GET /investmentDecisions/wallet/:address

Get investment recommendations for a wallet based on current on-chain balance.

**Parameters:**
- `address` (path) - Wallet address

**Response:** Same as POST /investmentDecisions

---

### GET /investmentDecisions/active/:address

Get active positions with rebalancing recommendations.

**Parameters:**
- `address` (path) - Wallet address

**Response:** Same as POST /investmentDecisions

---

## Pools Endpoints

### GET /pools

List pools with optional filters.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `minTvl` | number | Minimum TVL in USD |
| `minApr` | number | Minimum APR percentage |
| `minVolume` | number | Minimum 24h volume in USD |
| `limit` | number | Max results |
| `offset` | number | Pagination offset |

**Response:**
```json
[
  {
    "id": "uuid-here",
    "poolAddress": "0x...",
    "dexId": "dex-uuid",
    "token0Address": "0x...",
    "token1Address": "0x...",
    "token0Symbol": "USDC",
    "token1Symbol": "WETH",
    "fee": 3000,
    "liquidity": "1000000000000000000000000",
    "sqrtPriceX96": "...",
    "tick": 100,
    "volume24h": "1500000.00",
    "tvl": "5000000.00",
    "apr": "12.5000",
    "chainId": 2004,
    "isActive": true,
    "lastSyncedAt": "2026-01-30T12:00:00.000Z",
    "dex": {
      "id": "dex-uuid",
      "name": "StellaSwap",
      "factoryAddress": "0x..."
    }
  }
]
```

---

### GET /pools/top

Get top pools by APR.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 10 | Number of pools to return |

**Response:** Array of pools sorted by APR descending

---

### GET /pools/search

Search pools by token symbol.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `token` | string | Token symbol to search (e.g., "USDC") |

**Response:** Array of pools containing the token

---

### GET /pools/:id

Get pool details.

**Response:** Pool object with relations

**Errors:**
- `404 Not Found` - Pool not found

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "statusCode": 400,
  "message": "Validation failed: minApy must be between 0 and 1000",
  "error": "Bad Request"
}
```

### Common Error Codes

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Invalid input |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Server Error |

---

## Rate Limiting

Currently no rate limiting is implemented. This will be added in future versions.

---

## Pagination

List endpoints support pagination via `limit` and `offset` query parameters:

```
GET /positions?limit=20&offset=40
```

This returns results 41-60.

---

## Changelog

### v1.0.0 (January 2026)
- Initial release
- User, Position, Preference, and Pool endpoints
- Health check endpoints
=======
LiquiDOT Backend API allows the frontend to manage authentication, preferences, investment decisions, and activity history.

**Base URL**: `/api`

## Authentication

### `POST /auth/login/evm`
Login with an Ethereum (EVM) wallet signature (SIWE).
- **Body**:
  ```json
  {
    "address": "0x123...",
    "message": "Sign in to LiquiDOT...",
    "signature": "0xabc..."
  }
  ```
- **Response**: `{ "access_token": "jwt...", "user": { ... } }`

### `POST /auth/login/substrate`
Login with a Polkadot (Substrate) wallet signature (SIWS).
- **Body**:
  ```json
  {
    "address": "5GrwvaEF...",
    "message": "Sign in to LiquiDOT...",
    "signature": "0xabc..."
  }
  ```
- **Response**: `{ "access_token": "jwt...", "user": { ... } }`

---

## Activity Logs

### `GET /users/:userId/activity`
Fetch the history of cross-chain operations.
- **Headers**: `Authorization: Bearer <token>`
- **Query Params**:
    - `limit` (default 20)
    - `offset` (default 0)
- **Response**:
  ```json
  {
    "logs": [
      {
        "id": "uuid",
        "type": "INVESTMENT",
        "status": "SUBMITTED",
        "txHash": "0x123...",
        "createdAt": "2024-01-01T12:00:00Z"
      }
    ],
    "count": 10
  }
  ```

---

## User Preferences

### `POST /users/:id/preferences`
Save user investment preferences (risk range, target assets).
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
  ```json
  {
    "riskLevel": "low",
    "baseAsset": "DOT",
    "targetPools": ["0xabc..."]
  }
  ```

### `GET /users/:id/preferences`
Get current preferences.

---

## Investment Decisions

### `POST /users/:id/decision/execute`
Manually trigger the investment decision engine for a user.
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `{ "status": "success", "decisions": [...] }`

---

## Health Check
- `GET /health`: Returns `{ status: 'ok' }`
>>>>>>> Stashed changes
