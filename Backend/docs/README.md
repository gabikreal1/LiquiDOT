# LiquiDOT Backend Documentation

## 📚 Documentation Index

| Document | Description |
|----------|-------------|
| **[README](./README.md)** (this file) | Overview and quick start |
| **[API Reference](./API_REFERENCE.md)** | Complete REST API documentation |
| **[Database Schema](./DATABASE_SCHEMA.md)** | Tables, entities, and relationships |
| **[Investment Algorithm](./INVESTMENT_ALGORITHM.md)** | Math behind the optimization |
| **[Architecture](./ARCHITECTURE.md)** | System design and data flows |
| **[Deployment](./DEPLOYMENT.md)** | Production deployment guide |

---

## Overview

LiquiDOT is an automated DeFi liquidity provision system built on the Polkadot ecosystem. The backend orchestrates cross-chain liquidity management between **Asset Hub** (user funds custody) and **Moonbeam** (DEX interactions), using XCM (Cross-Consensus Messaging) for secure cross-chain communication.

### What Does It Do?

In simple terms, LiquiDOT helps users earn yield on their crypto by automatically:

1. **Finding the best pools** - Scans DEXes on Moonbeam for high-APY liquidity pools
2. **Making smart investment decisions** - Uses a mathematical model to decide when and where to invest
3. **Managing risk** - Monitors positions and automatically exits when prices move against you
4. **Handling everything cross-chain** - Users deposit on Asset Hub, the system invests on Moonbeam

### Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           LiquiDOT Backend                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐  ┌─────────────────────┐  ┌──────────────────────────┐ │
│  │   Users     │  │  Investment Engine  │  │     Stop-Loss Worker     │ │
│  │   Module    │  │  (Decision Making)  │  │   (Position Monitoring)  │ │
│  └─────────────┘  └─────────────────────┘  └──────────────────────────┘ │
│         │                   │                          │                 │
│         ▼                   ▼                          ▼                 │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                      Blockchain Module                               ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ ││
│  │  │ AssetHub    │  │  Moonbeam   │  │   Event     │  │    XCM     │ ││
│  │  │  Service    │  │  Service    │  │  Listener   │  │   Retry    │ ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                    │                           │
                    ▼                           ▼
            ┌───────────────┐          ┌───────────────┐
            │   Asset Hub   │◄──XCM───►│   Moonbeam    │
            │    (Funds)    │          │    (DEXes)    │
            └───────────────┘          └───────────────┘
```

## Core Modules

### 1. Users Module
Handles user registration and balance management.

**Key Features:**
- Users register when they connect their wallet on the frontend
- Balances are cached and updated via blockchain events (event-driven)
- No authentication required for MVP - wallet address is the identifier

### 2. Preferences Module
Stores each user's investment strategy configuration.

**Key Features:**
- Controls min APY, max positions, risk tolerance
- Configures allowed tokens and preferred DEXes
- Sets position range defaults (e.g., -5% to +10%)

### 3. Pools Module
Tracks available liquidity pools from Moonbeam DEXes.

**Key Features:**
- Syncs pool data from subgraphs (Algebra, StellaSwap)
- Stores TVL, APR, volume, and current prices
- Filters pools based on user criteria

### 4. Positions Module
Manages the lifecycle of LP positions.

**Key Features:**
- Tracks positions from creation to liquidation
- Stores on-chain IDs from both Asset Hub and Moonbeam
- Calculates P&L for each position

### 5. Investment Decision Module
The brain of the system - decides when and where to invest.

**Key Features:**
- Implements the mathematical model from `defi_investment_bot_spec.md`
- Runs every 4 hours to evaluate portfolio
- Uses utility function to optimize allocation

### 6. Stop-Loss Worker
Protects users from losses by monitoring positions.

**Key Features:**
- Checks positions every 30 seconds
- Triggers liquidation when price moves out of range
- Take-profit at upper bound, stop-loss at lower bound

### 7. Blockchain Module
Handles all smart contract interactions.

**Key Features:**
- AssetHubService: Deposits, withdrawals, position creation
- MoonbeamService: LP management, swaps, liquidations
- EventListenerService: Listens for on-chain events
- EventPersistenceService: Persists events to database
- TestModeService: Manages test mode synchronization
- XcmRetryService: Handles XCM failures with retry logic

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | NestJS 10.x |
| Language | TypeScript 5.x |
| Database | PostgreSQL + TypeORM |
| Blockchain | ethers.js 6.x |
| Scheduling | @nestjs/schedule |
| HTTP | @nestjs/axios |
| Testing | Jest + Supertest |

## Quick Start

```bash
# Install dependencies
cd Backend
npm install

# Copy environment config
cp .env.example .env
# Edit .env with your values

# Generate TypeChain types (if contracts changed)
npm run typechain

# Run in development
npm run start:dev

# Run in production
npm run build
npm run start:prod
```

## Testing

The backend includes comprehensive unit and integration tests:

```bash
# Run all unit tests
npm test

# Run tests in watch mode (development)
npm run test:watch

# Run tests with coverage report
npm run test:cov

# Run end-to-end tests
npm run test:e2e
```

### Test Coverage

| Module | Coverage |
|--------|----------|
| InvestmentDecisionController | Unit + E2E |
| EventPersistenceService | Unit |
| TestModeService | Unit |
| HealthController | Unit + E2E |
| API Endpoints | E2E |

### Test Files Location

- Unit tests: `src/**/*.spec.ts`
- E2E tests: `test/*.e2e-spec.ts`

## Environment Variables

See `.env.example` for all available configuration options. Key variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `MOONBEAM_RPC_URL` | Moonbeam RPC endpoint | Required |
| `ASSET_HUB_RPC_URL` | Asset Hub RPC endpoint | Required |
| `RELAYER_PRIVATE_KEY` | Wallet for signing transactions | Required |
| `ENABLE_INVESTMENT_WORKER` | Enable auto-investment | `true` |
| `ENABLE_STOP_LOSS_WORKER` | Enable position monitoring | `true` |
| `STOP_LOSS_CHECK_INTERVAL_MS` | How often to check positions | `30000` |

## API Endpoints

The backend exposes a REST API for the frontend. See [API_REFERENCE.md](./docs/API_REFERENCE.md) for the complete specification.

### Quick Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Basic health check |
| `/health/detailed` | GET | Detailed system status |
| `/users` | POST | Register new user |
| `/users/:id/balance` | GET | Get user balance |
| `/positions` | GET | List positions |
| `/positions/:id` | GET | Get position details |
| `/preferences/:userId` | GET/POST/PATCH | Manage preferences |
| `/pools` | GET | List available pools |
| `/pools/top` | GET | Get top pools by APR |

## Database Schema

See [DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md) for the complete ER diagram and table definitions.

## Investment Algorithm

The investment decision engine implements a sophisticated portfolio optimization algorithm. See [INVESTMENT_ALGORITHM.md](./docs/INVESTMENT_ALGORITHM.md) for the mathematical details.

**Key Concepts:**
- **Utility Function**: Balances return vs risk
- **IL Risk Factors**: Adjusts APY based on token volatility
- **Rebalance Conditions**: Only rebalances when profitable after gas

## Deployment

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for production deployment instructions.

**Options:**
- Docker Compose (development/staging)
- AWS ECS (production)
- Kubernetes (coming soon)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## License

MIT License - see [LICENSE](../LICENSE) for details.
