Automated Liquidity Management System for Polkadot Asset Hub & Moonbeam

LiquiDOT is a decentralized application that automates liquidity provision and liquidation protection on the Polkadot network. It leverages **XCM (Cross-Consensus Messaging)** to orchestrate assets between **Asset Hub** (where assets live) and **Moonbeam** (where DeFi logic executes).

## � Documentation

| Document | Description |
|----------|-------------|
| [**API Reference**](./docs/API_REFERENCE.md) | Full REST API documentation |
| [**Database Schema**](./docs/DATABASE_SCHEMA.md) | Entity relationships and table definitions |
| [**Investment Algorithm**](./docs/INVESTMENT_ALGORITHM.md) | How the optimization math works |
| [**Architecture**](./docs/ARCHITECTURE.md) | System design and data flows |

## 🚀 Features

- **Automated Investment**: Users initiate intent on Asset Hub; backend orchestrates XCM to move funds to Moonbeam and provide liquidity.
- **Stop-Loss Protection**: Background workers monitor positions 24/7 and automatically liquidate them if prices fall out of range.
- **Dual-Stack Auth**: Secure login with both **Ethereum (SIWE)** and **Polkadot (SIWS)** wallets.
- **Activity Tracking**: Real-time transparency into cross-chain operation status.
- **Portfolio Optimization**: Utility-maximizing allocation algorithm.

## 🔗 Blockchain & XCM Operations

LiquiDOT's core innovation is its cross-chain liquidity orchestration. 

### Architecture
1.  **Asset Hub (Source)**:
    - **Custody**: Users deposit funds into the `AssetHubVault` contract.
    - **Orchestration**: The backend triggers `dispatchInvestment`, which constructs an XCM message.
    - **XCM Message**: Contains `WithdrawAsset` -> `BuyExecution` -> `DepositAsset` (to Proxy) -> `Transact` (call `receiveAssets` on Moonbeam).
    - **Tooling**: We use **ParaSpell** SDK to construct safe, chemically-correct XCM V3/V4 messages.

2.  **Moonbeam (Destination)**:
    - **Execution**: The `XCMProxy` contract receives the assets and the "Investment Intent" (Pool ID, Amounts, etc.).
    - **DeFi Logic**: It executes swaps (via Algebra DEX), mints LP positions, and monitors health.
    - **Settlement**: Upon liquidation, assets are swapped back to base currency and returned to Asset Hub via **XTokens** or raw XCM.

### Verification & Testing
- **Production Mode**: Uses real `ParaSpell` construction and RPC calls.
- **Test Mode**: Set `XCM_TEST_MODE=true` to use internal mocks (stubs) for XCM messages. This allows testing the backend logic without a live parachain connection.

## 🏗️ Technology Stack

- **Framework**: NestJS 10 (TypeScript)
- **Database**: PostgreSQL (TypeORM)
- **Blockchain**:
    - `ethers.js` v6: Moonbeam (EVM) interactions.
    - `@polkadot/api` / `polkadot-api`: Asset Hub (Substrate) interactions.
    - `@paraspell/sdk`: XCM message construction.
    - `TypeChain`: Type-safe contract bindings.
- **Infrastructure**: Docker, Terraform (Digital Ocean).

## � Quick Start

1.  **Install dependencies**:
    ```bash
    npm install
    ```
2.  **Configure Environment**:
    Copy `.env.example` to `.env` and fill in required values.
    ```bash
    cp .env.example .env
    ```
3.  **Run Database**:
    ```bash
    docker-compose up -d db
    npm run migration:run
    ```
4.  **Start Backend**:
    ```bash
    npm run start:dev
    ```

## 🧠 How It Works

1. **Data Aggregation** - Pools synced from DEX subgraphs
2. **Opportunity Detection** - Algorithm ranks pools by risk-adjusted returns
3. **Portfolio Optimization** - Utility-maximizing allocation computed
4. **Automated Execution** - Rebalancing via XCM to Moonbeam
5. **Position Monitoring** - Stop-loss and take-profit checks every 30s

See [Investment Algorithm](./docs/INVESTMENT_ALGORITHM.md) for the math.

## � Environment Variables

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

## � API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/auth/login/evm` | Login with Ethereum wallet |
| `POST` | `/auth/login/substrate` | Login with Substrate wallet |
| `GET` | `/users/:id/balance` | Get user balance |
| `GET` | `/positions` | List positions |
| `POST` | `/preferences/:userId` | Set preferences |
| `POST` | `/investmentDecisions` | Calculate allocation |

Full API documentation: [docs/API_REFERENCE.md](./docs/API_REFERENCE.md) or `/api/docs` (Swagger).

## � Deposits & Position Limits

**Deposits accept DOT only** (native asset on Asset Hub). The system uses USD internally for calculations but all user deposits are in DOT.

### Testnet Configuration Defaults

| Setting | Default | Description |
|---------|---------|-------------|
| Minimum Position Size | 30 DOT (~$45) | Positions below this are skipped |
| Max Positions | 6 | Maximum concurrent LP positions |
| Max Allocation Per Position | $25,000 | Cap per individual position |
| Min Pool TVL | $1,000,000 | Only consider pools with sufficient liquidity |
| Min Pool Age | 14 days | Filter out new/unproven pools |

## � Deployment & CI/CD

- **Infrastructure**: Provisioned via **Terraform** on Digital Ocean.
- **CI/CD**: GitHub Actions triggers `terraform apply` on push to `main`.
- **Secrets**: Requires `DIGITALOCEAN_TOKEN` in GitHub Secrets.

---
**LiquiDOT Team** © 2026
