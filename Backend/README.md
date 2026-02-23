# LiquiDOT Backend

**Automated Liquidity Management System for Polkadot Asset Hub & Moonbeam**

LiquiDOT is a decentralized application that automates liquidity provision and liquidation protection on the Polkadot network. It leverages **XCM (Cross-Consensus Messaging)** to orchestrate assets between **Asset Hub** (where assets live) and **Moonbeam** (where DeFi logic executes).

## Documentation

| Document | Description |
|----------|-------------|
| [**API Reference**](./docs/API_REFERENCE.md) | Full REST API documentation |
| [**Database Schema**](./docs/DATABASE_SCHEMA.md) | Entity relationships and table definitions |
| [**Investment Algorithm**](./docs/INVESTMENT_ALGORITHM.md) | How the optimization math works |
| [**Architecture**](./docs/ARCHITECTURE.md) | System design and data flows |

## Features

- **Automated Investment**: Users initiate intent on Asset Hub; backend orchestrates XCM to move funds to Moonbeam and provide liquidity.
- **Stop-Loss Protection**: Background workers monitor positions 24/7 with batch pool state optimization and automatically liquidate them if prices fall out of range.
- **XCM Retry & Tracking**: All cross-chain operations use exponential backoff retry with error classification. Transaction hashes (`assetHubTxHash`, `moonbeamTxHash`) tracked on every position.
- **Dashboard API**: Pre-aggregated endpoint (`GET /dashboard/:userId`) returns balance, positions with P&L, recent activity, pool allocations, and portfolio summary.
- **Real-Time SSE**: Server-Sent Events stream (`GET /positions/user/:userId/events`) pushes position status changes to the frontend instantly.
- **RPC Rate Limiting**: Semaphore-based concurrency limiter prevents RPC burst scenarios on both Asset Hub and Moonbeam services.
- **Dual-Stack Auth**: Secure login with both **Ethereum (SIWE)** and **Polkadot (SIWS)** wallets.
- **Activity Tracking**: Real-time transparency into cross-chain operation status with tx hash linking.
- **Portfolio Optimization**: Utility-maximizing allocation algorithm.

## Blockchain & XCM Operations

LiquiDOT's core innovation is its cross-chain liquidity orchestration.

### Architecture — Two-Phase Investment Pipeline

Single-message XCM with asset transfer + Transact is impossible on Moonbeam (ClearOrigin is always injected, causing BadOrigin). LiquiDOT uses a two-phase approach:

1.  **Phase 1 — XCM Asset Transfer** (Asset Hub → Moonbeam):
    - **Custody**: Users deposit DOT into the `AssetHubVault` contract on Asset Hub.
    - **Orchestration**: The backend triggers `dispatchInvestment`, which constructs an XCM V5 message.
    - **XCM Message**: `WithdrawAsset` → `BuyExecution` → `DepositReserveAsset(Wild(All), dest: Moonbeam)`. Inner XCM: `BuyExecution` → `DepositAsset(XCMProxy)`.
    - **Tooling**: `polkadot-api` (P-API) for SCALE encoding and XCM construction.
    - **Cost**: ~0.03 DOT (AH) + ~0.02 DOT (Moonbeam) XCM fees.

2.  **Phase 2 — EVM Execution** (Moonbeam):
    - **Trigger**: Backend relayer calls `receiveAssets()` on XCMProxy via ethers.js.
    - **DeFi Logic**: XCMProxy executes swaps (Algebra DEX), mints LP positions.
    - **Settlement**: Upon liquidation, XCMProxy calls `IPalletXcm.transferAssetsUsingTypeAndThenAddress()` to return DOT to user on Asset Hub. Backend passes `address beneficiary` — contract handles EE-padding and XCM construction internally.

### Verification & Testing
- **Production Mode**: Uses real P-API construction and RPC calls.
- **Test Mode**: Set `XCM_TEST_MODE=true` to use internal mocks (stubs) for XCM messages. This allows testing the backend logic without a live parachain connection.

## Technology Stack

- **Framework**: NestJS 10 (TypeScript)
- **Database**: PostgreSQL (TypeORM)
- **Blockchain**:
    - `ethers.js` v6: Moonbeam (EVM) interactions.
    - `polkadot-api` (P-API): Asset Hub (Substrate) interactions and XCM V5 construction.
    - `@polkadot/api`: Legacy Substrate client (being phased out).
    - `TypeChain`: Type-safe contract bindings (auto-generated from SmartContracts ABI).
- **Infrastructure**: Docker, Terraform (Digital Ocean).

## Installation

### Prerequisites
- Node.js v18+
- Docker & Docker Compose
- PostgreSQL

### Local Setup
1.  Clone the repository:
    ```bash
    git clone <repo-url>
    cd liquidot-backend
    ```
2.  Install dependencies:
    ```bash
    pnpm install
    ```
3.  Configure Environment:
    Copy `.env.example` to `.env` and fill in the required values (see Environment Variables below).
    ```bash
    cp .env.example .env
    ```
4.  Run Database:
    ```bash
    docker-compose up -d db
    pnpm run migration:run
    ```
5.  Start Backend:
    ```bash
    pnpm run start:dev
    ```

## How It Works

1. **Data Aggregation** - Pools synced from DEX subgraphs
2. **Opportunity Detection** - Algorithm ranks pools by risk-adjusted returns
3. **Portfolio Optimization** - Utility-maximizing allocation computed
4. **Automated Execution** - Rebalancing via XCM to Moonbeam
5. **Position Monitoring** - Stop-loss and take-profit checks every 30s

See [Investment Algorithm](./docs/INVESTMENT_ALGORITHM.md) for the math.

## Environment Variables

See [`.env.example`](.env.example) for all configuration options. Key variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | API Port (default 3001) | No |
| `DATABASE_URL` | Postgres Connection String | Yes |
| `JWT_SECRET` | Secret for signing auth tokens | Yes |
| `ASSETHUB_RPC_URL` | Asset Hub Node RPC | Yes |
| `MOONBEAM_RPC_URL` | Moonbeam Node RPC | Yes |
| `ASSETHUB_VAULT_ADDRESS` | Contract Address on Asset Hub | Yes |
| `RELAYER_PRIVATE_KEY` | Private Key for transaction execution | Yes |
| `ENABLED_DECISION_EXECUTION`| Set to `true` to enable scheduled jobs | No |
| `XCM_TEST_MODE` | Set `true` to mock XCM message construction | No |
| `MOONBEAM_XCM_PROXY_ADDRESS` | Contract Address on Moonbeam | Yes |
| `STOP_LOSS_CHECK_INTERVAL_MS` | Position monitoring interval | No |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/auth/login/evm` | Login with Ethereum wallet |
| `POST` | `/auth/login/substrate` | Login with Substrate wallet |
| `GET` | `/users/:id/balance` | Get user balance |
| `GET` | `/positions` | List positions |
| `GET` | `/positions/user/:userId/events` | SSE stream of position status changes |
| `POST` | `/preferences/:userId` | Set preferences |
| `POST` | `/investmentDecisions` | Calculate allocation |
| `GET` | `/dashboard/:userId` | Aggregated dashboard (balance, positions, P&L, activity, pools) |

Full API documentation: [docs/API_REFERENCE.md](./docs/API_REFERENCE.md) or `/api/docs` (Swagger).

## Deposits & Position Limits

**Deposits accept DOT only** (native asset on Asset Hub). The system uses USD internally for calculations but all user deposits are in DOT.

### Testnet Configuration Defaults

| Setting | Default | Description |
|---------|---------|-------------|
| Minimum Position Size | 30 DOT (~$45) | Positions below this are skipped |
| Max Positions | 6 | Maximum concurrent LP positions |
| Max Allocation Per Position | $25,000 | Cap per individual position |
| Min Pool TVL | $1,000,000 | Only consider pools with sufficient liquidity |
| Min Pool Age | 14 days | Filter out new/unproven pools |

## Security

- **Authentication**: All user endpoints require a valid JWT via `Authorization: Bearer <token>`.
- **Validation**: All inputs are validated using `class-validator`.
- **Throttling**: (Planned) Rate limiting on public endpoints.

## Deployment & CI/CD

- **Infrastructure**: Provisioned via **Terraform** on DigitalOcean App Platform + Managed PostgreSQL.
  Config in `terraform-do/main.tf`. Both backend and frontend deploy as services in one DO App with path-based routing (`/api` → backend, `/` → frontend).
- **CI**: `.github/workflows/ci.yml` — lint, build, and test on every PR and push to main.
- **CD**: `.github/workflows/deploy.yml` — Terraform plan on PRs, auto-apply on merge to main. Application code deploys automatically via DO `deploy_on_push: true`.
- **DB Migrations**: Auto-run on production startup (`migrationsRun: true`).
- **Secrets**: `DIGITALOCEAN_TOKEN`, `JWT_SECRET`, `RELAYER_PRIVATE_KEY`, and other env vars configured as GitHub Secrets (passed via `TF_VAR_*`).

---
**LiquiDOT Team** &copy; 2026
