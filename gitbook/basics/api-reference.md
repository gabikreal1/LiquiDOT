---
icon: code
---

# API Reference

API documentation for LiquiDOT backend services, smart contract ABIs, and integration endpoints.

## Overview

LiquiDOT provides multiple APIs for different purposes:

* **REST API** - Backend services and data aggregation
* **Smart Contract ABI** - Direct blockchain interaction
* **WebSocket API** - Real-time updates (future)
* **GraphQL API** - Flexible data queries (future)

## REST API

**Base URL:** `https://api.liquidot.xyz/v1` (testnet: `https://testnet-api.liquidot.xyz/v1`)

### Authentication

```bash
# API Key in header
curl -H "X-API-Key: your_api_key" https://api.liquidot.xyz/v1/positions
```

### Endpoints

#### User Endpoints

**GET /users/:wallet**
Get user information and balance

**Example:**
```bash
curl https://api.liquidot.xyz/v1/users/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

**Response:**
```json
{
  "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "balance": {
    "DOT": "1250.50",
    "USDC": "5000.00"
  },
  "preferences": {
    "minAPY": 10,
    "riskTolerance": 3,
    "maxAllocationPerPool": 25
  },
  "activePositions": 5
}
```

---

**PUT /users/:wallet/preferences**
Update user investment preferences

**Body:**
```json
{
  "minAPY": 12,
  "maxAllocationPerPool": 20,
  "riskTolerance": 4,
  "preferredAssets": ["DOT", "USDC", "WETH"],
  "stopLoss": 5,
  "takeProfit": 15
}
```

#### Position Endpoints

**GET /positions**
List all positions for authenticated user

**Query Parameters:**
* `status` - Filter by status (ACTIVE, CLOSED, LIQUIDATED)
* `chain` - Filter by chain ID
* `limit` - Results per page
* `offset` - Pagination offset

**Example:**
```bash
curl "https://api.liquidot.xyz/v1/positions?status=ACTIVE&limit=10"
```

**Response:**
```json
{
  "positions": [
    {
      "id": "0x1234...abcd",
      "user": "0x742d...",
      "pool": "DOT/USDC",
      "chain": "Moonbeam",
      "status": "ACTIVE",
      "entryPrice": 50.25,
      "currentPrice": 51.80,
      "pnl": 150.50,
      "pnlPercent": 3.0,
      "feesEarned": 45.25,
      "liquidity": "15000000000",
      "lowerRange": -5,
      "upperRange": 10,
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ],
  "total": 5,
  "page": 1
}
```

---

**GET /positions/:id**
Get detailed position information

---

**POST /positions/:id/close**
Manually close a position

#### Pool Endpoints

**GET /pools**
List available liquidity pools

**Query Parameters:**
* `chain` - Filter by chain
* `minTVL` - Minimum TVL
* `minAPY` - Minimum APY
* `assets` - Comma-separated asset list

**Example:**
```bash
curl "https://api.liquidot.xyz/v1/pools?chain=moonbeam&minAPY=10"
```

**Response:**
```json
{
  "pools": [
    {
      "address": "0xPool123...",
      "pair": "DOT/USDC",
      "dex": "Algebra",
      "chain": "Moonbeam",
      "tvl": 2500000,
      "volume24h": 450000,
      "apy": 12.5,
      "feeTier": 500,
      "currentTick": 276324
    }
  ]
}
```

---

**GET /pools/:address/analytics**
Get detailed pool analytics and historical data

#### DEX Endpoints

**GET /dexes**
List supported DEXes

**Response:**
```json
{
  "dexes": [
    {
      "name": "Algebra Integral",
      "chain": "Moonbeam",
      "protocolType": "Algebra",
      "isActive": true,
      "totalPools": 45,
      "totalTVL": 15000000
    }
  ]
}
```

## Smart Contract ABIs

### Asset Hub Vault ABI

**Key Functions:**

```solidity
// Deposit funds
function deposit(uint256 amount, address asset) external

// Withdraw funds
function withdraw(uint256 amount, address asset) external

// Get user balance
function getUserBalance(address user, address asset) 
    external view returns (uint256)

// Get active investments
function getActiveInvestments(address user) 
    external view returns (Investment[] memory)
```

**Full ABI:** Available in `SmartContracts/artifacts/contracts/AssetHubVault.sol/AssetHubVault.json`

### XCM Proxy ABI

**Key Functions:**

```solidity
// Get active positions
function getActivePositions() 
    external view returns (Position[] memory)

// Get position details
function getPositionDetails(bytes32 positionId) 
    external view returns (PositionDetails memory)

// Execute liquidation (authorized only)
function executeFullLiquidation(bytes32 positionId, uint8 liquidationType) 
    external
```

**Full ABI:** Available in `SmartContracts/artifacts/contracts/XCMProxy.sol/XCMProxy.json`

## JavaScript SDK (Future)

```javascript
import { LiquiDOT } from '@liquidot/sdk';

// Initialize
const liquidot = new LiquiDOT({
  network: 'moonbase',
  apiKey: 'your_api_key'
});

// Connect wallet
await liquidot.connect(walletProvider);

// Deposit
await liquidot.deposit('DOT', '100');

// Create position
await liquidot.createPosition({
  pool: '0xPool123...',
  baseAsset: 'DOT',
  amount: '100',
  lowerRange: -5,
  upperRange: 10
});

// Monitor positions
const positions = await liquidot.getPositions({ status: 'ACTIVE' });
```

## WebSocket API (Future)

**Real-time updates:**

```javascript
const ws = new WebSocket('wss://api.liquidot.xyz/v1/ws');

// Subscribe to position updates
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'positions',
  filter: { user: '0x742d...' }
}));

// Receive updates
ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log('Position updated:', update);
};
```

## Rate Limits

| Tier | Requests/minute | WebSocket connections |
|------|----------------|----------------------|
| Free | 60 | 5 |
| Pro | 600 | 50 |
| Enterprise | Unlimited | Unlimited |

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid API key |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

## Next Steps

* [Smart Contracts](smart-contracts.md) - Contract documentation
* [Architecture](architecture.md) - System design
* [Testing Guide](testing-guide.md) - API testing

*Full API reference coming soon...*
