# LiquiDOT Backend

Automated DeFi liquidity management service for Polkadot ecosystem. Optimizes LP positions across Moonbeam DEXes using cross-chain messaging (XCM) from Asset Hub.

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [**README**](./docs/README.md) | Complete backend overview and quick start |
| [**API Reference**](./docs/API_REFERENCE.md) | Full REST API documentation |
| [**Database Schema**](./docs/DATABASE_SCHEMA.md) | Entity relationships and table definitions |
| [**Investment Algorithm**](./docs/INVESTMENT_ALGORITHM.md) | How the optimization math works |
| [**Architecture**](./docs/ARCHITECTURE.md) | System design and data flows |

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Configure your environment (see .env.example for all options)
# Required: DATABASE_URL, MOONBEAM_RPC_URL, PRIVATE_KEY

# Run database migrations
npm run migration:run

# Start development server
npm run start:dev
```

## 🏗️ Tech Stack

- **NestJS 10** - Backend framework
- **TypeORM** - Database ORM with PostgreSQL
- **Ethers.js 6** - Ethereum/Moonbeam interactions
- **P-API (polkadot-api)** - Asset Hub / XCM operations (replaces Polkadot.js)
- **TypeChain** - Type-safe contract bindings

## 📁 Project Structure

```
src/
├── modules/
│   ├── blockchain/           # Chain interactions (Asset Hub, Moonbeam)
│   ├── investment-decision/  # Core optimization algorithm
│   ├── stop-loss-worker/     # Position monitoring
│   ├── pools/                # DEX pool data
│   ├── positions/            # User positions
│   ├── preferences/          # User settings
│   └── users/                # User management
├── health.controller.ts
├── app.module.ts
└── main.ts
```

## 🔧 Environment Variables

See [`.env.example`](.env.example) for all configuration options. Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `MOONBEAM_RPC_URL` | Moonbeam RPC endpoint |
| `ASSET_HUB_RPC_URL` | Asset Hub RPC endpoint |
| `PRIVATE_KEY` | Wallet private key (never commit!) |
| `STOP_LOSS_CHECK_INTERVAL_MS` | Position monitoring interval |

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/users` | Register user |
| `GET` | `/users/:id/balance` | Get user balance |
| `GET` | `/positions` | List positions |
| `GET` | `/positions/:id/pnl` | Get position P&L |
| `POST` | `/preferences/:userId` | Set preferences |
| `GET` | `/pools/top` | Get top pools by APR |

Full API documentation: [docs/API_REFERENCE.md](./docs/API_REFERENCE.md)

## 🧠 How It Works

1. **Data Aggregation** - Pools synced from DEX subgraphs
2. **Opportunity Detection** - Algorithm ranks pools by risk-adjusted returns
3. **Portfolio Optimization** - Utility-maximizing allocation computed
4. **Automated Execution** - Rebalancing via XCM to Moonbeam
5. **Position Monitoring** - Stop-loss and take-profit checks every 30s

See [Investment Algorithm](./docs/INVESTMENT_ALGORITHM.md) for the math.

## 💰 Deposits & Position Limits

**Deposits accept DOT only** (native asset on Asset Hub). The system uses USD internally for calculations but all user deposits are in DOT.

### Testnet Configuration Defaults

| Setting | Default | Description |
|---------|---------|-------------|
| Minimum Position Size | 30 DOT (~$45) | Positions below this are skipped |
| Max Positions | 6 | Maximum concurrent LP positions |
| Max Allocation Per Position | $25,000 | Cap per individual position |
| Min Pool TVL | $1,000,000 | Only consider pools with sufficient liquidity |
| Min Pool Age | 14 days | Filter out new/unproven pools |

### Override via API

Users can customize these defaults through the preferences API:

```bash
POST /preferences/:userId
{
  "minPositionSizeUsd": 100,
  "maxPositions": 4,
  "maxAllocPerPositionUsd": 10000
}
```

See [API Reference](./docs/API_REFERENCE.md) for full documentation.