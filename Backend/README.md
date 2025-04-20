# Automated Liquidity Pool Investment Backend

A Node.js backend with REST API that reads pool data, analyzes it, and makes investment decisions for liquidity pools based on user preferences received from the frontend.

## Project Structure

- `server.js` - Main server file with API endpoints
- `readPoolDataModule.js` - Module to read and sanitize pool data from raw JSON file
- `poolInvestmentDecisionModule.js` - Module to make investment decisions based on pool data and user preferences
- `data.json` - Raw pool data from the blockchain/protocol
- `sanitizedPoolData.json` - Cleaned and processed pool data
- `decisions/` - Folder containing individual investment decision files

## API Endpoints

### GET /api/health
Health check endpoint to verify the server is running.

**Response**
```json
{
  "status": "ok",
  "message": "Server is running"
}
```

### GET /api/pools
Returns a list of all available liquidity pools with their details.

**Response**
```json
{
  "success": true,
  "data": {
    "pools": [
      {
        "id": "0xb13b281503f6ec8a837ae1a21e86a9cae368fcc5",
        "createdAt": "2023-01-20T12:40:04.000Z",
        "fee": 0.3004,
        "token0": {
          "symbol": "WGLMR",
          "name": "Wrapped GLMR",
          "id": "0xacc15dc74880c9944775448304b263d191c6077f"
        },
        "token1": {
          "symbol": "xcDOT",
          "name": "xcDOT",
          "id": "0xffffffff1fcacbd218edc0eba20fc2308c778080"
        },
        "token0Price": 55.62172608753225,
        "token1Price": 0.01797858625290222,
        "totalValueLockedUSD": 129307.67992424834,
        "totalValueLockedToken0": 1009025.4688181674,
        "totalValueLockedToken1": 16810.10985544,
        "volumeUSD": 316748313.0822657,
        "txCount": 513178,
        "approximateAPR": 268585.6366502277
      }
      // ... more pools
    ]
  }
}
```

### GET /api/decisions
Returns a list of all previously saved investment decisions.

**Response**
```json
{
  "success": true,
  "data": [
    "decision_2025-04-20T08-35-12.000Z_0x123456.json",
    "decision_2025-04-19T14-22-05.000Z_0xabcdef.json"
  ]
}
```

### GET /api/decisions/:filename
Returns a specific investment decision by filename.

**Response**
```json
{
  "success": true,
  "data": {
    "timestamp": "2025-04-20T08:35:12.000Z",
    "userPreferences": {
      "coinLimit": 15,
      "minRequiredApr": 5,
      "minMarketCap": 1000000,
      "stopLossLevel": 10,
      "takeProfitLevel": 25,
      "riskStrategy": "highestMarketCap",
      "userAddress": "0x1234567890abcdef1234567890abcdef12345678"
    },
    "decisions": [
      // ... investment decisions
    ]
  }
}
```

### POST /api/get-investment-decisions
Generates investment decisions based on user preferences.

**Request Body:**
```json
{
  "coinLimit": 5,
  "minRequiredApr": 5,
  "minMarketCap": 10000,
  "stopLossLevel": 10,
  "takeProfitLevel": 20,
  "riskStrategy": "highestApr",
  "userAddress": "0x123...",
  "allowedCoins": ["WGLMR", "xcDOT", "xcUSDT", "xcUSDC", "USDC", "xcMANTA", "STELLA"]
}
```

**Parameters:**
- `coinLimit`: Maximum number of pools to include (required)
- `minRequiredApr`: Minimum APR percentage required (required)
- `minMarketCap`: Minimum market cap required in USD (required)
- `stopLossLevel`: Stop loss percentage (required)
- `takeProfitLevel`: Take profit percentage (required)
- `riskStrategy`: Strategy for selecting pools - "highestApr" or "highestMarketCap" (required)
- `userAddress`: User wallet address (required)
- `allowedCoins`: (Optional) Array of coin symbols to filter by. If provided, only pools that include at least one of these coins will be considered. If empty or not provided, all pools are considered.

**Note:**
When `allowedCoins` is provided, the backend will only include pools where at least one of the tokens in the pool matches a symbol from the allowedCoins list.

**Response**
```json
{
  "success": true,
  "data": {
    "filename": "decision_2025-04-20T08-35-12.000Z_0x123456.json",
    "timestamp": "2025-04-20T08:35:12.000Z",
    "userPreferences": {
      "coinLimit": 15,
      "minRequiredApr": 5,
      "minMarketCap": 1000000,
      "stopLossLevel": 10,
      "takeProfitLevel": 25,
      "riskStrategy": "highestMarketCap",
      "userAddress": "0x1234567890abcdef1234567890abcdef12345678"
    },
    "decisions": [
      {
        "poolId": "0xb13b281503f6ec8a837ae1a21e86a9cae368fcc5",
        "pairName": "WGLMR/xcDOT",
        "token0": {
          "symbol": "WGLMR",
          "address": "0xacc15dc74880c9944775448304b263d191c6077f"
        },
        "token1": {
          "symbol": "xcDOT",
          "address": "0xffffffff1fcacbd218edc0eba20fc2308c778080"
        },
        "approximateAPR": 268585.6366502277,
        "totalValueLockedUSD": 129307.67992424834,
        "stopLoss": 10,
        "takeProfit": 25,
        "proportion": 11.231829072712506
      }
      // ... more decisions
    ]
  }
}
```

## How It Works

### 1. Receiving User Preferences

The system receives user preferences via an API endpoint from the frontend:
- `coinLimit`: Maximum number of pools to invest in
- `minRequiredApr`: Minimum APR requirement
- `minMarketCap`: Minimum market cap requirement
- `stopLossLevel`: Stop loss percentage
- `takeProfitLevel`: Take profit percentage
- `riskStrategy`: Strategy for investment (highestMarketCap or highestApr)
- `userAddress`: User's blockchain address

### 2. Processing Pool Data

The system reads raw pool data from the blockchain/protocol and:
- Extracts essential information about each pool
- Calculates approximate APR based on volume and TVL
- Sorts pools by APR
- Saves cleaned data to a sanitized file
- Makes this data available via API endpoint

### 3. Making Investment Decisions

Based on user preferences and sanitized pool data, the system:
- Filters pools by minimum APR
- Removes pools with unrealistic APRs or very low liquidity
- Applies user's risk strategy (highest market cap or highest APR)
- Selects top pools within coin limit
- Calculates investment proportions based on pool metrics
- Sets stop loss and take profit levels
- Saves the investment decision to a unique file in the decisions folder
- Returns investment decisions via API endpoint

### 4. Storage of Investment Decisions

Each investment decision is:
- Saved as a separate JSON file in the `decisions/` folder
- Named with timestamp and a portion of the user's address
- Available for retrieval later via the GET endpoints

## Installation and Usage

1. Install dependencies:
   ```
   npm install
   ```

2. Start the server:
   ```
   npm start
   ```

   For development with auto-restart:
   ```
   npm run dev
   ```

3. The server will run on port 3001 by default. You can change this by setting the PORT environment variable.

## Example API Usage

### Get investment decisions
```bash
curl -X POST http://localhost:3001/api/get-investment-decisions \
  -H "Content-Type: application/json" \
  -d '{
    "coinLimit": 15,
    "maxDecisions": 5,
    "minRequiredApr": 5,
    "minMarketCap": 1000000,
    "stopLossLevel": 10,
    "takeProfitLevel": 25,
    "riskStrategy": "highestMarketCap",
    "userAddress": "0x1234567890abcdef1234567890abcdef12345678"
  }'
```

### List previous decisions
```bash
curl http://localhost:3001/api/decisions
```

### Get a specific decision
```bash
curl http://localhost:3001/api/decisions/decision_2025-04-20T08-35-12.000Z_0x123456.json
```

## Next Steps

- Integrate with smart contracts to execute investments
- Implement stop loss and take profit monitoring
- Add automated rebalancing
- Create a frontend interface for user preference input and visualization 