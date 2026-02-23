# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LiquiDOT is a cross-chain automated LP (liquidity provider) manager for the Polkadot ecosystem. Users deposit DOT on Asset Hub, and the system manages LP positions on Moonbeam DEXes (StellaSwap/Algebra Integral) via XCM. Includes stop-loss, take-profit, and automated rebalancing.

## Architecture

**Hub-and-spoke model** across two chains connected by XCM:

- **Asset Hub** — Custody layer. `AssetHubVault` contract holds user DOT, orchestrates XCM via `IXcm` precompile (`0x...a0000`)
- **Moonbeam** — Execution layer. `XCMProxy` contract mints/burns LP positions on Algebra DEX, returns funds via `IPalletXcm` precompile (`0x...081A`) using `transferAssetsUsingTypeAndThenAddress` with DestinationReserve transfer type. Contract converts H160 addresses to AccountId32 via EE-padding internally.
- **Backend (NestJS)** — Decision engine + workers that trigger on-chain operations (operator model)
- **Frontend (Next.js)** — User-facing DApp for deposits, preferences, and position monitoring

Liquidations are **operator-triggered** (backend calls contracts), not automated on-chain.

## Repository Structure

Monorepo with three independent services (no top-level workspace):

| Directory | Stack | Package Manager |
|-----------|-------|-----------------|
| `SmartContracts/` | Solidity 0.8.28 + Hardhat + Foundry | npm |
| `Backend/` | NestJS 10 + TypeORM + PostgreSQL | pnpm |
| `Frontend/` | Next.js 15 + Tailwind + shadcn/ui + Wagmi | pnpm |

## Build & Test Commands

### SmartContracts

```bash
cd SmartContracts
npm install
npm run compile:evm                  # Hardhat compile (artifacts → artifacts-evm/)
npm run compile:polkavm              # PolkaVM compile (separate config)
npm run test:evm                     # Run all Hardhat tests (local)
npm run test:polkavm                 # PolkaVM tests

# Testnet tests (require .env with MOON_PK / ASSET_PK)
npx hardhat test test/AssetHubVault/testnet/1.config-check.test.js --network passethub
npx hardhat test test/XCMProxy/testnet/1.config-check.test.js --network moonbase
npx hardhat test test/AssetHubVault/testnet/**/*.test.js --network passethub
npx hardhat test test/XCMProxy/testnet/**/*.test.js --network moonbase
npx hardhat test test/Integration/testnet/**/*.test.js --network passethub

# Foundry
forge build
forge test
```

Hardhat config: `hardhat.config.js` (EVM) and `hardhat.config.polkavm.js` (PolkaVM). Mocha timeout is 120s for testnet tests.

### Backend

```bash
cd Backend
pnpm install
pnpm run build                       # Compile (runs typechain as prebuild)
pnpm run start:dev                   # Dev server with hot reload (port 3001)
pnpm test                            # Jest unit tests
pnpm run test:e2e                    # E2E tests (uses SQLite in-memory)
pnpm run lint                        # ESLint
pnpm run format                      # Prettier

# Run a single test file
pnpm test -- path/to/file.spec.ts

# Database
pnpm run migration:generate          # Generate migration
pnpm run migration:run               # Run migrations
pnpm run migration:revert            # Revert last migration
```

API docs at `/api/docs` (Swagger). Health check at `/api/health`.

### Frontend

```bash
cd Frontend
pnpm install
pnpm run dev                         # Dev server
pnpm run build                       # Production build
pnpm run lint                        # ESLint
```

## Network Configuration

| Network | Chain ID | Env Key | Use |
|---------|----------|---------|-----|
| Paseo Asset Hub (testnet) | 420420422 | `ASSET_PK` | AssetHubVault testing |
| Moonbase Alpha (testnet) | 1287 | `MOON_PK` | XCMProxy testing |
| Asset Hub (mainnet) | 420420419 | `ASSET_PK` | Production custody |
| Moonbeam (mainnet) | 1284 | `MOON_PK` | Production execution |

## Key Smart Contract Patterns

- **Test mode**: Both contracts have `setTestMode(true)` to bypass actual XCM calls during development
- **Dual toolchain**: Hardhat for deployment/testnet tests, Foundry for local unit tests. Hardhat uses `viaIR` with optimizer runs=1; Foundry uses runs=200
- **Contract linking**: After deployment, contracts must be linked to each other via helper scripts (`test/helpers/link-contracts.js`)
- **AssetHubVault** is deployed via [Polkadot Remix IDE](https://remix.polkadot.io/), not Hardhat (PolkaVM target)

## Backend Architecture

Key NestJS modules under `src/modules/`:

- `blockchain/` — Core chain integration: `asset-hub.service.ts` (ethers + P-API), `moonbeam.service.ts`, `xcm-builder.service.ts` (P-API / XCM V5), `event-listener.service.ts`, `event-persistence.service.ts`, `xcm-retry.service.ts`, `price.service.ts`, `token-math.service.ts`
- `investment-decision/` — Deterministic optimization in `decision.logic.ts`, runs every 4h. Worker uses XCM retry with Phase 2 polling recovery.
- `stop-loss-worker/` — Monitors positions every 30s with batch pool state optimization (one RPC per unique pool, 15s cache). Triggers liquidations.
- `pools/` — Syncs DEX pool data from Algebra subgraph
- `dashboard/` — Pre-aggregated dashboard API (`GET /dashboard/:userId`) with balance, positions, P&L, activity, pool allocations
- `positions/` — Position CRUD + SSE endpoint (`GET /positions/user/:userId/events`) via `PositionEventBusService` for real-time updates
- `auth/` — JWT auth with SIWE + SIWS (Sign-In with Ethereum/Substrate)
- `preferences/`, `users/`, `activity-logs/`

**Common utilities** under `src/common/`:
- `concurrency-limiter.ts` — Semaphore-based RPC rate limiting (applied to MoonbeamService and AssetHubService, configurable via `MOONBEAM_MAX_CONCURRENT_RPC` / `ASSETHUB_MAX_CONCURRENT_RPC`)

**XCM reliability**: `event-listener.service.ts` wraps all three orchestration paths (executePendingInvestment, confirmExecution, settleLiquidation) with `XcmRetryService.executeWithRetry()` — exponential backoff, error classification (transient/permanent), failure logging + FAILED status marking.

**Transaction hash tracking**: Position entity has `assetHubTxHash` and `moonbeamTxHash` columns. EventPersistenceService persists tx hashes from blockchain events. ActivityLog entries include `txHash`.

**TypeChain bridge**: Contract ABIs from `SmartContracts/artifacts-evm/` generate typed bindings via `pnpm run typechain` (runs automatically as prebuild). Bindings live in `src/types/contracts/`.

**Dual Substrate clients**: Both `@polkadot/api` (legacy) and `polkadot-api` (P-API) are used for Asset Hub interactions.

Workers are toggled via env vars: `ENABLE_INVESTMENT_WORKER`, `ENABLE_STOP_LOSS_WORKER`, `ENABLE_POOL_AGGREGATOR`.

## Infrastructure

- **Production**: DigitalOcean App Platform (Backend + Frontend services) + Managed PostgreSQL (`Backend/terraform-do/`)
- **CI pipeline**: `.github/workflows/ci.yml` — runs backend lint+build+test and frontend lint+build on every PR and push to main
- **CD pipeline**: `.github/workflows/deploy.yml` — Terraform plan (PRs) / apply (main) for infrastructure changes. App code deploys automatically via DO `deploy_on_push: true`.
- **Path-based routing**: Both services share one DO App — `/api` routes to backend (port 3001), `/` routes to frontend (port 3000)
- **Docker**: `Backend/Dockerfile` (pnpm, multi-stage), `Frontend/Dockerfile` (Next.js standalone, multi-stage), `Backend/docker-compose.yml` for local PostgreSQL
- **Local subgraph**: `Backend/local-dev/graph-node/docker-compose.yml` for local Algebra subgraph indexing
- **DB migrations**: Auto-run on production startup via `migrationsRun: true` in TypeORM config

## XCM Investment Pipeline

**Two-phase flow** (single-message Transact is impossible due to ClearOrigin):

1. **Phase 1 (XCM)**: `WithdrawAsset → BuyExecution → DepositReserveAsset` on Asset Hub. Deposits xcDOT to XCMProxy on Moonbeam. ~0.05 DOT total XCM overhead.
2. **Phase 2 (EVM)**: Backend relayer calls `receiveAssets()` on Moonbeam XCMProxy directly via ethers.js.

Liquidation return path: XCMProxy calls `IPalletXcm.transferAssetsUsingTypeAndThenAddress()` to send DOT back to user on Asset Hub. Contract handles EE-padding of H160→AccountId32 and XCM construction internally — backend just passes `address beneficiary`.

## Deployments

### Mainnet

| Contract | Network | Address |
|----------|---------|---------|
| XCMProxy | Moonbeam (1284) | `0x0cfb7CE7D66C7CdAe5827074C5f5A62223a0c230` |

### Testnet

| Contract | Network | Address |
|----------|---------|---------|
| AssetHubVault | Paseo Asset Hub | `0x68e86F267C5C37dd4947ef8e5823eBAeAf93Fde6` |
| XCMProxy | Moonbase Alpha | `0x7f4b3620d6Ffcc15b11ca8679c57c076DCE109d1` |
