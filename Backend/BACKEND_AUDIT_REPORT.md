# LiquiDOT Backend Security Audit Report

**Date:** 2026-02-24
**Scope:** `Backend/src/` — NestJS backend service
**Auditor:** Automated static analysis + manual code review
**Codebase commit:** `07a14b5` (main)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [File Structure](#2-file-structure)
3. [Data Flow Diagrams](#3-data-flow-diagrams)
4. [Security Findings](#4-security-findings)
5. [Detailed Analysis by Module](#5-detailed-analysis-by-module)
6. [Recommendations](#6-recommendations)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         LiquiDOT Backend                            │
│                     NestJS 10 + TypeORM + PostgreSQL                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────┐  ┌───────────┐  ┌────────────┐  ┌───────────────┐  │
│  │   Auth     │  │  Users    │  │ Positions  │  │  Dashboard    │  │
│  │ (JWT+SIWE) │  │  (CRUD)  │  │ (CRUD+SSE) │  │ (Aggregated)  │  │
│  └─────┬─────┘  └─────┬─────┘  └──────┬─────┘  └───────┬───────┘  │
│        │              │               │                │           │
│  ┌─────┴──────────────┴───────────────┴────────────────┴─────┐     │
│  │                    PostgreSQL (TypeORM)                     │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │                  Blockchain Module                          │     │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │     │
│  │  │ AssetHub     │  │ Moonbeam     │  │ XCM Builder      │ │     │
│  │  │ Service      │  │ Service      │  │ (P-API + ethers) │ │     │
│  │  │ (ethers.js)  │  │ (ethers.js)  │  │                  │ │     │
│  │  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘ │     │
│  │         │                 │                    │           │     │
│  │  ┌──────┴─────┐  ┌───────┴──────┐  ┌─────────┴─────────┐ │     │
│  │  │ Event      │  │ Event        │  │ XCM Retry         │ │     │
│  │  │ Listener   │  │ Persistence  │  │ Service            │ │     │
│  │  └────────────┘  └──────────────┘  └───────────────────┘ │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐   │
│  │ Investment       │  │ Stop-Loss        │  │ Pool Scanner    │   │
│  │ Decision Worker  │  │ Worker           │  │ (Subgraph)      │   │
│  │ (Cron: 4h)      │  │ (Interval: 30s)  │  │ (Cron: 10min)   │   │
│  └──────────────────┘  └──────────────────┘  └─────────────────┘   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  External Dependencies:                                             │
│  • Asset Hub RPC (WSS) — Custody chain                             │
│  • Moonbeam RPC (HTTPS/WSS) — Execution chain                     │
│  • CoinGecko API — DOT price oracle                                │
│  • Algebra Subgraph (Goldsky) — Pool data                          │
└─────────────────────────────────────────────────────────────────────┘
```

### Request Flow

```
                    ┌──────────┐
                    │ Frontend │
                    └────┬─────┘
                         │ HTTPS
                    ┌────▼─────┐
                    │ DO App   │
                    │ Platform │
                    │ /api/*   │
                    └────┬─────┘
                         │
              ┌──────────▼──────────┐
              │   NestJS Backend    │
              │   (port 3001)       │
              │                     │
              │  ValidationPipe     │  ← whitelist + transform
              │  CORS               │  ← configurable origin
              │  /api prefix        │
              └──────────┬──────────┘
                         │
           ┌─────────────┼─────────────┐
           │             │             │
     ┌─────▼──────┐ ┌───▼────┐ ┌──────▼──────┐
     │ REST API   │ │  SSE   │ │  Workers    │
     │ Controllers│ │ Stream │ │ (Cron/Int)  │
     └────────────┘ └────────┘ └─────────────┘
```

### Investment Pipeline (Two-Phase XCM Flow)

```
 User Deposit                Backend Decision              XCM Phase 1                XCM Phase 2
 ──────────                  ─────────────────             ───────────                ───────────

 ┌───────────┐  deposit()   ┌─────────────────┐          ┌────────────┐            ┌────────────┐
 │ User DOT  │────────────►│ AssetHubVault   │──XCM────►│ Moonbeam   │            │ XCMProxy   │
 │ on Asset  │              │ (custody)       │  msg     │ xcDOT      │            │ (LP mint)  │
 │ Hub       │              └─────────────────┘          │ arrives    │            └──────┬─────┘
 └───────────┘                                           └──────┬─────┘                  │
                                                                │                        │
                                                                │  Backend polls         │
                                                                │  getPendingPosition()  │
                                                                │  every 5s × 12         │
                                                                ▼                        │
                                                         callReceiveAssets()──────────►  │
                                                         (Phase 2 EVM call)              │
                                                                                         ▼
                                                                                   executePending
                                                                                   Investment()
                                                                                         │
                                                                                    LP Position
                                                                                    Minted on
                                                                                    Algebra DEX
```

### Liquidation Return Path

```
 Stop-Loss Trigger          Moonbeam                      XCM Return               Asset Hub
 ─────────────────          ────────                      ──────────               ──────────

 ┌───────────────┐         ┌────────────┐               ┌────────────┐          ┌────────────┐
 │ Position out  │────────►│ liquidate  │──────────────►│ IPalletXcm │─────────►│ User DOT   │
 │ of range      │         │ SwapAnd    │  collect LP   │ transfer   │  XCM     │ credited   │
 │ (worker)      │         │ Return()   │  swap→base    │ reserve    │  msg     │ on AH      │
 └───────────────┘         └────────────┘               └────────────┘          └────────────┘
                                                                                      │
                                                                              settleLiquidation()
                                                                              (Event Listener)
```

---

## 2. File Structure

```
Backend/
├── .dockerignore
├── .env.example                    # Environment template (88 lines)
├── docker-compose.yml              # Local PostgreSQL
├── Dockerfile                      # Multi-stage, non-root user
├── package.json                    # pnpm, NestJS 10
├── pnpm-lock.yaml
├── tsconfig.json
│
├── src/
│   ├── main.ts                     # Bootstrap: CORS, ValidationPipe, Swagger
│   ├── app.module.ts               # Root module: all imports
│   ├── health.controller.ts        # GET /api/health
│   ├── health.controller.spec.ts
│   │
│   ├── config/
│   │   └── typeorm.config.ts       # PostgreSQL config (synchronize in dev, migrations in prod)
│   │
│   ├── common/
│   │   ├── concurrency-limiter.ts  # Semaphore-based RPC rate limiter
│   │   ├── token-math.ts           # BigInt ↔ decimal conversion utilities
│   │   └── token-math.spec.ts
│   │
│   ├── migrations/
│   │   ├── 1708000000000-InitialSchema.ts
│   │   └── 1740300000000-AddPositionTxHashes.ts
│   │
│   ├── modules/
│   │   ├── auth/                           # JWT + SIWE/SIWS authentication
│   │   │   ├── auth.module.ts              #   Module config (JWT secret, 1d expiry)
│   │   │   ├── auth.controller.ts          #   POST /auth/login/evm, /auth/login/substrate
│   │   │   ├── auth.service.ts             #   Signature verification + user creation
│   │   │   ├── jwt.strategy.ts             #   Passport JWT strategy
│   │   │   └── jwt-auth.guard.ts           #   Guard (defined but rarely applied)
│   │   │
│   │   ├── users/                          # User CRUD
│   │   │   ├── users.module.ts
│   │   │   ├── users.controller.ts         #   GET/POST /users, /users/:id/*
│   │   │   ├── users.service.ts            #   CRUD + balance cache
│   │   │   └── entities/
│   │   │       └── user.entity.ts          #   id, walletAddress, isActive
│   │   │
│   │   ├── positions/                      # Position lifecycle management
│   │   │   ├── positions.module.ts
│   │   │   ├── positions.controller.ts     #   REST CRUD + liquidate endpoint
│   │   │   ├── positions-sse.controller.ts #   SSE /positions/user/:userId/events
│   │   │   ├── positions.service.ts        #   CRUD + on-chain sync + liquidation
│   │   │   ├── position-sync.service.ts    #   Cron sync (every 30min)
│   │   │   ├── position-event-bus.service.ts #  RxJS Subject per userId
│   │   │   ├── position-events.service.ts  #   Blockchain event → DB persistence
│   │   │   ├── position-events.service.spec.ts
│   │   │   └── entities/
│   │   │       └── position.entity.ts      #   Full position schema (23 columns)
│   │   │
│   │   ├── preferences/                    # User investment preferences
│   │   │   ├── preferences.module.ts
│   │   │   ├── preferences.controller.ts   #   CRUD /preferences/:userId
│   │   │   ├── preferences.service.ts
│   │   │   ├── dto/
│   │   │   │   └── upsert-preferences.dto.ts
│   │   │   └── entities/
│   │   │       └── user-preference.entity.ts #  30+ config fields
│   │   │
│   │   ├── pools/                          # DEX pool data
│   │   │   ├── pools.module.ts
│   │   │   ├── pools.controller.ts         #   GET /pools, /pools/top, /pools/search
│   │   │   ├── pools.service.ts            #   CRUD + filters
│   │   │   ├── pool-scanner.service.ts     #   Subgraph polling (every 10min)
│   │   │   ├── dto/
│   │   │   │   └── pools-query.dto.ts
│   │   │   ├── abis/
│   │   │   │   └── algebra.abi.ts          #   ERC20 + Algebra pool ABIs
│   │   │   └── entities/
│   │   │       ├── pool.entity.ts          #   Pool schema (token0, token1, APR, TVL)
│   │   │       └── dex.entity.ts           #   DEX registry
│   │   │
│   │   ├── dashboard/                      # Pre-aggregated dashboard API
│   │   │   ├── dashboard.module.ts
│   │   │   ├── dashboard.controller.ts     #   GET /dashboard/:userId
│   │   │   └── dashboard.service.ts        #   Aggregates positions, P&L, activity
│   │   │
│   │   ├── activity-logs/                  # Audit trail
│   │   │   ├── activity-logs.module.ts
│   │   │   ├── activity-logs.controller.ts #   GET /users/:userId/activity (AUTH!)
│   │   │   ├── activity-logs.service.ts
│   │   │   └── entities/
│   │   │       └── activity-log.entity.ts  #   type, status, txHash, details (JSON)
│   │   │
│   │   ├── blockchain/                     # Core chain integration
│   │   │   ├── blockchain.module.ts
│   │   │   ├── blockchain.controller.ts    #   GET /api/blockchain/supported-tokens
│   │   │   ├── blockchain-diagnostics.controller.ts  # GET /blockchain/diagnostics
│   │   │   ├── blockchain-diagnostics.service.ts
│   │   │   ├── index.ts
│   │   │   ├── abis/
│   │   │   │   ├── AssetHubVault.abi.ts    #   AH contract ABI
│   │   │   │   └── XCMProxy.abi.ts         #   Moonbeam contract ABI (115 entries)
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   ├── papi/                       # polkadot-api integration
│   │   │   │   ├── papi.module.ts
│   │   │   │   ├── papi-client.service.ts  #   WS client lifecycle
│   │   │   │   ├── papi.types.ts
│   │   │   │   ├── papi.constants.ts
│   │   │   │   └── papi-client.service.spec.ts
│   │   │   └── services/
│   │   │       ├── asset-hub.service.ts    #   AH contract ops (1156 lines)
│   │   │       ├── moonbeam.service.ts     #   MB contract ops (1215 lines)
│   │   │       ├── event-listener.service.ts #  Orchestration engine (497 lines)
│   │   │       ├── event-persistence.service.ts # Event → DB (498 lines)
│   │   │       ├── xcm-builder.service.ts  #   XCM V5 message builder (573 lines)
│   │   │       ├── xcm-retry.service.ts    #   Retry with backoff (302 lines)
│   │   │       ├── price.service.ts        #   CoinGecko DOT price (71 lines)
│   │   │       ├── token-math.service.ts   #   Token conversion (132 lines)
│   │   │       ├── test-mode.service.ts
│   │   │       ├── index.ts
│   │   │       ├── moonbeam.service.supported-tokens.spec.ts
│   │   │       ├── event-persistence.service.spec.ts
│   │   │       ├── test-mode.service.spec.ts
│   │   │       └── token-math.service.spec.ts
│   │   │
│   │   ├── investment-decision/            # Automated portfolio optimizer
│   │   │   ├── investment-decision.module.ts
│   │   │   ├── investment-decision.service.ts  # Decision logic (1067 lines)
│   │   │   ├── investment-decision.worker.ts   # Cron worker (346 lines)
│   │   │   ├── investment-decision.controller.spec.ts
│   │   │   ├── investment-decision.service.spec.ts
│   │   │   ├── dto/
│   │   │   │   ├── run-decision.dto.ts
│   │   │   │   ├── preview-allocation.dto.ts
│   │   │   │   └── execute-decision.dto.ts
│   │   │   └── types/
│   │   │       ├── index.ts
│   │   │       └── investment.types.ts     #   Constants, interfaces, risk tiers
│   │   │
│   │   └── stop-loss-worker/               # Position range monitoring
│   │       ├── stop-loss-worker.module.ts
│   │       ├── stop-loss-worker.service.ts #   Simple worker (Cron: 1min)
│   │       ├── stop-loss.service.ts        #   Full worker (Interval: 30s)
│   │       ├── index.ts
│   │       └── types/
│   │           ├── index.ts
│   │           └── stop-loss.types.ts
│   │
│   └── types/
│       └── contracts/                      # TypeChain generated bindings
│           ├── common.ts
│           ├── index.ts
│           ├── contracts/                  # Contract type bindings
│           │   ├── V1(Current)/
│           │   │   ├── AssetHubVault.sol/
│           │   │   ├── XCMProxy.sol/
│           │   │   ├── XcmExecuteAdapter.sol/
│           │   │   └── xcm/
│           │   ├── test/
│           │   └── SimpleTest.ts
│           ├── factories/                  # Contract factory bindings
│           └── @cryptoalgebra/             # Algebra DEX interface bindings
│
├── test/                                   # E2E tests
│   └── app.e2e-spec.ts
│
├── terraform-do/                           # DigitalOcean infrastructure
│   └── *.tf
│
└── local-dev/                              # Local development tools
    └── graph-node/
        └── docker-compose.yml              # Local Algebra subgraph
```

**Line counts by module:**

| Module | Lines | Files |
|--------|-------|-------|
| `blockchain/services/` | ~4,444 | 8 |
| `investment-decision/` | ~1,413 | 3 |
| `positions/` | ~818 | 7 |
| `stop-loss-worker/` | ~509 | 2 |
| `users/` | ~349 | 3 |
| `pools/` | ~350 | 4 |
| `dashboard/` | ~203 | 2 |
| `auth/` | ~147 | 4 |
| `preferences/` | ~300 | 3 |
| `activity-logs/` | ~120 | 3 |
| **Total (src/)** | **~8,653** | **~50** |

---

## 3. Data Flow Diagrams

### 3.1 Authentication Flow

```
Client                    Backend                           Database
──────                    ───────                           ────────

  │  POST /auth/login/evm   │                                │
  │  { address, message,    │                                │
  │    signature }          │                                │
  │─────────────────────────►│                                │
  │                          │ ethers.verifyMessage()         │
  │                          │ ←── recovered address          │
  │                          │                                │
  │                          │ findOrCreate(address)          │
  │                          │───────────────────────────────►│
  │                          │ ◄── User entity                │
  │                          │                                │
  │                          │ jwtService.sign({              │
  │                          │   walletAddress, sub: id       │
  │                          │ })                             │
  │  { access_token, user } │                                │
  │◄─────────────────────────│                                │
  │                          │                                │

  ⚠ NO nonce verification    ⚠ NO message parsing
  ⚠ Replay attacks possible  ⚠ Full user entity returned
```

### 3.2 Stop-Loss Monitoring Flow

```
                        Every 30 seconds
                              │
                    ┌─────────▼──────────┐
                    │ StopLossService     │
                    │ monitorPositions()  │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │ Query DB: ACTIVE   │
                    │ positions (batch   │
                    │ size: 50)          │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │ Group by pool,     │
                    │ prefetch pool      │
                    │ states (15s cache) │
                    └─────────┬──────────┘
                              │
                  ┌───────────┼───────────┐
                  │                       │
          In Range (skip)        Out of Range
                                         │
                              ┌──────────▼──────────┐
                              │ DB Lock: ACTIVE →   │
                              │ OUT_OF_RANGE        │
                              │ (conditional update)│
                              └──────────┬──────────┘
                                         │
                              ┌──────────▼──────────┐
                              │ liquidateSwapAnd    │
                              │ Return() on         │
                              │ Moonbeam            │
                              └──────────┬──────────┘
                                         │
                              ┌──────────▼──────────┐
                              │ Update: LIQUIDATED  │
                              │ + liquidatedAt      │
                              └─────────────────────┘
                                    │
                         On failure: │
                    ┌────────────────▼────────────────┐
                    │ retryCount++ (max 3)            │
                    │ exponential backoff              │
                    │ if max retries: FAILED + alert   │
                    └─────────────────────────────────┘
```

### 3.3 Entity Relationship Diagram

```
┌─────────────────┐     ┌──────────────────────┐     ┌──────────────┐
│     users        │     │      positions        │     │    pools     │
├─────────────────┤     ├──────────────────────┤     ├──────────────┤
│ id          (PK)│◄────│ userId          (FK) │     │ id      (PK) │
│ walletAddress   │  1:N│ poolId          (FK) │────►│ poolAddress  │
│ isActive        │     │ assetHubPositionId   │  N:1│ token0Symbol │
│ createdAt       │     │ moonbeamPositionId   │     │ token1Symbol │
│ updatedAt       │     │ baseAsset            │     │ apr          │
└────────┬────────┘     │ amount               │     │ tvl          │
         │              │ liquidity            │     │ volume24h    │
         │              │ status (enum)        │     │ fee          │
         │              │ lowerTick/upperTick  │     │ isActive     │
         │              │ entryPrice           │     │ dexId   (FK) │
         │              │ returnedAmount       │     └──────┬───────┘
         │              │ retryCount           │            │
         │              │ assetHubTxHash       │     ┌──────▼───────┐
         │              │ moonbeamTxHash       │     │    dexes     │
         │              │ createdAt/updatedAt  │     ├──────────────┤
         │              └──────────────────────┘     │ id      (PK) │
         │                                           │ name         │
         │  1:N  ┌──────────────────────┐            │ routerAddress│
         └──────►│  user_preferences    │            │ factoryAddr  │
                 ├──────────────────────┤            └──────────────┘
                 │ id              (PK) │
                 │ userId          (FK) │     ┌──────────────────────┐
                 │ minApy               │     │   activity_logs      │
                 │ maxPositions         │     ├──────────────────────┤
                 │ maxAllocPerPosition  │     │ id              (PK) │
                 │ dailyRebalanceLimit  │     │ userId               │
                 │ lambdaRiskAversion   │     │ type (enum)          │
                 │ autoInvestEnabled    │     │ status (enum)        │
                 │ rebalanceCountToday  │     │ positionId           │
                 │ lastRebalanceDate    │     │ txHash               │
                 │ allowedTokens (JSON) │     │ details (JSON)       │
                 │ preferredDexes (JSON)│     │ createdAt            │
                 │ ... (30+ fields)     │     └──────────────────────┘
                 └──────────────────────┘
```

---

## 4. Security Findings

### Summary

| Severity | Count | Category |
|----------|-------|----------|
| **CRITICAL** | 5 | Authentication/Authorization bypass, fund theft |
| **HIGH** | 6 | Key management, data exposure, missing validation |
| **MEDIUM** | 8 | Business logic, reliability, configuration |
| **LOW/INFO** | 11 | Hardening, best practices, type safety |

---

### CRITICAL Findings

#### C-1: Unauthenticated Liquidation with Recipient Override — FUND THEFT

**Files:** `positions.controller.ts:92-97`, `positions.service.ts:238-303`
**Impact:** Direct fund theft

`POST /positions/:id/liquidate` accepts an optional `recipientAddress` in the body. No authentication guard is applied. An attacker can:

1. Call `GET /positions/active` to enumerate all active positions
2. Call `POST /positions/{id}/liquidate` with `{ recipientAddress: "attacker_wallet" }`
3. The position is liquidated and funds are sent to the attacker's address via XCM

```typescript
// positions.controller.ts:92 — NO @UseGuards()
@Post(':id/liquidate')
async liquidatePosition(
  @Param('id') id: string,
  @Body() body?: { baseAsset?: string; recipientAddress?: string }, // ← attacker controls this
): Promise<Position> {
  return this.positionsService.liquidate(id, body);
}
```

```typescript
// positions.service.ts:262 — beneficiary is caller-controlled
const beneficiary = opts?.recipientAddress || position.userId;
```

**Fix:** Add `@UseGuards(JwtAuthGuard)`, verify `req.user.id === position.userId`, remove `recipientAddress` parameter (always use `position.userId`).

---

#### C-2: No Authentication on API Endpoints

**Files:** `users.controller.ts`, `positions.controller.ts`, `positions-sse.controller.ts`, `dashboard.controller.ts`, `preferences.controller.ts`, `pools.controller.ts`
**Impact:** Full data exposure, unauthorized state changes

`JwtAuthGuard` is defined but applied on **only 1 of 7 controllers** (`activity-logs.controller.ts`). All other endpoints are publicly accessible:

| Endpoint | Risk |
|----------|------|
| `GET /users` | List all users (enumeration) |
| `POST /users/:id/deactivate` | Disable any user account (DoS) |
| `GET /positions/active` | See all positions across all users |
| `POST /positions/:id/liquidate` | Liquidate any position (C-1) |
| `GET /positions/user/:userId/events` (SSE) | Eavesdrop on real-time events |
| `GET /dashboard/:userId` | Full financial dashboard of any user |
| `PATCH /preferences/:userId` | Modify any user's investment settings |
| `DELETE /preferences/:userId` | Delete any user's preferences |

**Fix:** Apply `@UseGuards(JwtAuthGuard)` to all controllers. Add ownership checks (IDOR prevention).

---

#### C-3: Hardcoded JWT Fallback Secret

**Files:** `jwt.strategy.ts:16`, `auth.module.ts:17`
**Impact:** JWT forgery — full authentication bypass

```typescript
// jwt.strategy.ts:16
secretOrKey: configService.get<string>('JWT_SECRET') || 'DEV_SECRET_DO_NOT_USE',
```

If `JWT_SECRET` is not set in the environment, the application silently uses the hardcoded string `'DEV_SECRET_DO_NOT_USE'`. Any attacker who reads the source code (public repo) can forge valid JWTs for any user:

```
Header: { "alg": "HS256" }
Payload: { "sub": "target-user-uuid", "walletAddress": "0x..." }
Secret: "DEV_SECRET_DO_NOT_USE"
```

**Fix:** Fail startup if `JWT_SECRET` is not set. Use `configService.getOrThrow<string>('JWT_SECRET')`.

---

#### C-4: No Replay Attack Protection on Authentication

**Files:** `auth.service.ts:21-61`
**Impact:** Indefinite session hijacking

The code itself admits: `"Note: In a real app we'd verify the nonce in the message to prevent replay attacks"` (line 32).

Neither EVM nor Substrate authentication flows validate:
- Nonce (to prevent replay)
- Timestamp (to prevent old signatures)
- Domain/URI (to prevent cross-site signature reuse)
- Chain ID (to prevent cross-chain signature reuse)

An intercepted signature can be replayed forever to obtain fresh JWTs.

**Fix:** Implement proper SIWE (EIP-4361) message parsing with nonce verification. Store and invalidate nonces server-side.

---

#### C-5: Single Relayer Private Key Controls Both Chains

**Files:** `moonbeam.service.ts:223`, `asset-hub.service.ts:205`
**Impact:** Complete protocol compromise if key leaked

Both `MoonbeamService` and `AssetHubService` use the same `RELAYER_PRIVATE_KEY` environment variable. This single key can:
- Execute pending investments on Moonbeam
- Confirm executions on Asset Hub
- Liquidate any position
- Settle liquidations
- Add/remove supported tokens
- Pause/unpause contracts

**Fix:** Use separate keys per chain. Use HSM/KMS for production. Implement key rotation capability.

---

### HIGH Findings

#### H-1: Default Database Credentials in Code

**File:** `config/typeorm.config.ts:8-9`
**Impact:** Database access if defaults are used

```typescript
username: process.env.DATABASE_USER || 'liquidot',
password: process.env.DATABASE_PASSWORD || 'liquidot123',
```

Hardcoded fallback credentials. If environment variables are not set, the application connects with predictable credentials.

**Fix:** Fail startup if `DATABASE_PASSWORD` is not explicitly set in production.

---

#### H-2: Schema Auto-Sync in Non-Production

**File:** `config/typeorm.config.ts:12`

```typescript
synchronize: process.env.NODE_ENV !== 'production',
```

`synchronize: true` auto-modifies the database schema. In staging/test environments, this can silently drop columns or tables. Combined with H-1, if `NODE_ENV` is accidentally unset in production, schema changes happen automatically.

**Fix:** Use `synchronize: false` always. Use migrations exclusively.

---

#### H-3: Zero Slippage Protection on All Liquidations

**Files:** `positions.service.ts:282-284`, `stop-loss.service.ts:290`, `stop-loss-worker.service.ts:57-58`
**Impact:** MEV sandwich attack vulnerability

Every liquidation call passes `minAmountOut0: 0n, minAmountOut1: 0n`:

```typescript
await this.moonbeamService.liquidateSwapAndReturn({
  minAmountOut0: 0n,  // ← no slippage protection
  minAmountOut1: 0n,  // ← no slippage protection
  limitSqrtPrice: 0n, // ← no price limit
});
```

While the contract has a `defaultSlippageBps`, an MEV bot can still exploit the difference between the contract's default and an optimal minimum.

**Fix:** Calculate minimum amounts based on current pool state minus acceptable slippage before sending.

---

#### H-4: CORS Defaults to Wildcard

**File:** `main.ts:11-14`

```typescript
app.enableCors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
});
```

If `CORS_ORIGIN` is not set, all origins are accepted **with credentials**. This is a dangerous combination that allows any website to make authenticated requests to the API.

**Fix:** Fail startup if `CORS_ORIGIN` is not explicitly set in production.

---

#### H-5: Fire-and-Forget Orchestration — Lost Operations

**File:** `event-listener.service.ts:352-460`
**Impact:** XCM operations lost on crash

Critical orchestration operations (`executePendingInvestment`, `confirmExecution`, `settleLiquidation`) are triggered as fire-and-forget promises from event handlers:

```typescript
// Inside event callback — if process crashes, operation is lost
this.xcmRetryService.executeWithRetry(
  () => this.moonbeamService.executePendingInvestment(positionId),
).then(result => { ... }).catch(err => { ... });
```

If the process crashes between receiving the event and completing the operation, the operation is permanently lost. There is no persistent job queue.

**Fix:** Use a persistent job queue (BullMQ/Redis) for critical operations. Mark operations as pending in DB before starting.

---

#### H-6: CoinGecko Price Oracle — No Redundancy or Manipulation Protection

**File:** `price.service.ts:18-63`
**Impact:** Price manipulation affects investment decisions

Single CoinGecko free-tier API call with:
- No API key (strict rate limits)
- No fetch timeout (can hang indefinitely)
- No multiple source validation
- Stale price fallback (serves cached price indefinitely if API is down)

A MITM attack or DNS poisoning could feed manipulated prices, affecting investment decisions.

**Fix:** Add fetch timeout. Use multiple price sources. Add circuit breaker. Validate price change bounds.

---

### MEDIUM Findings

#### M-1: No Rate Limiting on Any Endpoint

**Files:** All controllers
**Impact:** DoS, brute-force

No `@Throttle()` decorator or rate limiting middleware is applied anywhere. Endpoints like `POST /auth/login/*` and SSE streams are particularly vulnerable.

**Fix:** Add `@nestjs/throttler` with appropriate limits per endpoint class.

---

#### M-2: No Input Validation on DTOs

**Files:** `auth.controller.ts:5-9`, `users.controller.ts:12-14`
**Impact:** Invalid data persistence, potential errors

`LoginDto` and `CreateUserDto` are plain classes without `class-validator` decorators. While `ValidationPipe` with `whitelist: true` is applied globally (good), the DTOs lack `@IsString()`, `@IsNotEmpty()`, `@IsEthereumAddress()` etc. decorators, so the pipe has nothing to validate against.

**Fix:** Add proper validation decorators to all DTOs.

---

#### M-3: Race Conditions in Event Persistence

**File:** `event-persistence.service.ts`
**Impact:** Duplicate or inconsistent records

Position creation from blockchain events uses find-then-create without transactions:

```typescript
let position = await this.positionRepository.findOne({...});
if (!position) {
  position = this.positionRepository.create({...});
  await this.positionRepository.save(position);
}
```

Concurrent events for the same position could create duplicates.

**Fix:** Use `UPSERT` / `ON CONFLICT` or DB transactions with row-level locks.

---

#### M-4: Unbounded Position Iteration

**File:** `moonbeam.service.ts:470`
**Impact:** DoS via RPC overload

`getActivePositions()` iterates from 1 to `positionCounter` with sequential RPC calls. If the counter grows large, this creates massive RPC load:

```typescript
for (let i = 1; i <= counter; i++) {
  const pos = await this.getPosition(i);
  if (pos && pos.status === 'Active') { ... }
}
```

**Fix:** Add pagination. Use batch RPC (multicall). Add upper bound limit.

---

#### M-5: XCM Byte Extraction Fragility

**File:** `xcm-builder.service.ts:335-340`
**Impact:** Silent XCM corruption on runtime upgrade

XCM bytes are extracted by stripping the first 2 bytes (call index) and last N bytes (compact-encoded weights) from P-API's encoded `PolkadotXcm.execute()` call. This relies on exact encoding assumptions:

```typescript
// Strip 2-byte call index
const xcmBytes = encodedCall.slice(4);
// Strip compact weights from the end
const compactLen = this.compactEncodingLength(gasLimit);
return xcmBytes.slice(0, -(compactLen * 2));
```

If the runtime or P-API changes the encoding format, XCM messages will be silently corrupted.

**Fix:** Add runtime version checks. Add XCM byte validation (decode-reencode check). Add integration test.

---

#### M-6: `dryRunXcm` Does Not Actually Dry-Run

**File:** `xcm-builder.service.ts:401`
**Impact:** False confidence in XCM validity

The method named `dryRunXcm` only validates XCM assembly and returns hardcoded fee estimates. It does not call the chain's `DryRunApi`:

```typescript
// Always returns success if building succeeds
return { success: true, estimatedFees: '500000000' };
```

**Fix:** Call `DryRunApi.dryRunXcm()` for actual validation. Make fee estimates dynamic.

---

#### M-7: 24-Hour JWT Expiry, No Refresh Token

**File:** `auth.module.ts:18`
**Impact:** Long token lifetime for DeFi app

JWTs expire after 24 hours with no refresh token mechanism. A stolen token is valid for a full day. No token revocation mechanism exists.

**Fix:** Reduce to 15-30 minutes. Implement refresh tokens. Add token revocation (blacklist).

---

#### M-8: Inconsistent RPC Rate Limiting

**Files:** `moonbeam.service.ts`, `asset-hub.service.ts`
**Impact:** RPC provider throttling

Some methods use `rpcLimiter` (e.g., `isPositionOutOfRange`, `getPosition`, `getUserBalance`) but most do not (e.g., `getActivePositions`, `getUserPositions`, `getPoolState`). This inconsistency can lead to RPC rate limiting under load.

**Fix:** Apply `rpcLimiter` to all RPC calls consistently.

---

### LOW/INFO Findings

#### L-1: Swagger Enabled in Production

**File:** `main.ts:29-36`

Swagger documentation is served at `/api/docs` in all environments. This exposes the full API surface to attackers.

**Fix:** Conditionally enable Swagger: `if (process.env.NODE_ENV !== 'production')`.

---

#### L-2: No Helmet Middleware

**File:** `main.ts`

No security headers middleware (Helmet.js). Missing headers: `X-Content-Type-Options`, `Strict-Transport-Security`, `X-Frame-Options`, etc.

**Fix:** Add `app.use(helmet())`.

---

#### L-3: Substrate Address Not Normalized

**File:** `auth.service.ts:79`

Substrate addresses are stored as provided without SS58 normalization. The same account encoded with different SS58 prefixes creates duplicate user records.

**Fix:** Normalize to hex public key or canonical SS58 prefix before storage.

---

#### L-4: Full User Entity Returned on Login

**File:** `auth.service.ts:68-71`

The login response includes the full User entity with all relations (positions, preferences), leaking potentially sensitive data.

**Fix:** Return only `{ access_token, userId, walletAddress }`.

---

#### L-5: No SSE Connection Limits

**File:** `positions-sse.controller.ts`

No maximum concurrent SSE connections per user or globally. An attacker could exhaust server connection capacity.

**Fix:** Add connection limit per userId. Add global connection limit. Add idle timeout.

---

#### L-6: Pool Search Loads All Then Filters Client-Side

**File:** `pools.controller.ts:53-62`

`GET /pools/search?token=X` loads ALL pools from DB, then filters in-memory:

```typescript
const pools = await this.poolsService.findAll({});
return pools.filter(p => p.token0Symbol.includes(token));
```

**Fix:** Use SQL `LIKE` or `ILIKE` query.

---

#### L-7: Activity Log Details Stored as JSON

**File:** `activity-log.entity.ts`

The `details` column is `type: 'json'` and can contain arbitrary data including error messages and calldata. Error messages could potentially contain sensitive information.

**Fix:** Sanitize error messages before storing. Define a strict schema for `details`.

---

#### L-8: Docker Image Uses `corepack prepare pnpm@latest`

**File:** `Dockerfile:6, 26`

Using `@latest` in Docker builds is non-deterministic and could introduce supply chain risks.

**Fix:** Pin to a specific pnpm version.

---

#### L-9: TypeScript Strict Checks Disabled

**File:** `tsconfig.json:15-17`

```json
"strictNullChecks": false,
"noImplicitAny": false,
"strictBindCallApply": false,
```

All strict TypeScript checks are disabled. This weakens the compiler's ability to catch null dereferences, implicit `any` types, and other bugs that could have security implications (e.g., bypassing checks when a value is unexpectedly null).

**Fix:** Enable `strictNullChecks` and `noImplicitAny` at minimum.

---

#### L-10: Unauthenticated Health/Diagnostics Endpoints Expose Internal State

**Files:** `health.controller.ts`, `blockchain-diagnostics.controller.ts`

- `GET /health/detailed` exposes heap memory usage, uptime, DB latency
- `GET /health/test-mode` reveals whether XCM validation is disabled
- `GET /blockchain/diagnostics` exposes precompile addresses and raw RPC error messages

**Fix:** Restrict detailed health and diagnostics endpoints to authenticated admin access.

---

#### L-11: ConcurrencyLimiter Has No Queue Bound or Timeout

**File:** `common/concurrency-limiter.ts`

The semaphore queue array has no maximum size and queued items wait indefinitely. Under load, this could cause unbounded memory growth or deadlocked chains of requests.

**Fix:** Add `maxQueueSize` with rejection when full. Add per-item timeout.

---

## 5. Detailed Analysis by Module

### 5.1 Auth Module

| Aspect | Status |
|--------|--------|
| Signature verification | EVM: `ethers.verifyMessage` (correct). Substrate: `signatureVerify` (correct) |
| Message parsing (SIWE) | **Missing** — no nonce, domain, timestamp, chain ID |
| JWT signing | HMAC-SHA256 via passport-jwt (standard) |
| JWT secret | **Hardcoded fallback** — `'DEV_SECRET_DO_NOT_USE'` |
| Token expiry | 24 hours (too long for DeFi) |
| Refresh tokens | **Missing** |
| Token revocation | **Missing** |
| Guard application | **Applied to 1/7 controllers** (`activity-logs` only) |

### 5.2 Blockchain Module

| Aspect | Status |
|--------|--------|
| Private key storage | Environment variable (acceptable for MVP) |
| Key separation | **Single key for both chains** |
| RPC rate limiting | Partial (ConcurrencyLimiter on some methods) |
| Error handling | Consistent try/catch + re-throw |
| Event listeners | Fire-and-forget orchestration (**no persistent queue**) |
| XCM building | P-API based, fragile byte extraction |
| XCM retry | Exponential backoff with error classification (good) |
| Price oracle | Single source (CoinGecko), no timeout, no redundancy |
| Transaction signing | Via ethers.js Wallet (standard) |
| Input validation | **Missing** — no address format checks before RPC |

### 5.3 Workers

| Worker | Schedule | Concurrency Guard | Failure Handling |
|--------|----------|-------------------|------------------|
| Investment Decision | Cron: every hour (service) + every 4h (worker) | `isProcessing` flag | Log + continue next user |
| Stop-Loss (simple) | Cron: every minute | `isProcessing` flag | Log + continue next position |
| Stop-Loss (full) | Interval: 30s | `isProcessing` flag + DB lock | Retry with exponential backoff (max 3), then FAILED + alert |
| Pool Scanner | Cron: every 10min | Not visible | Log error |
| Position Sync | Cron: every 30min | Not visible | Skip failed users |

### 5.4 Database

| Aspect | Status |
|--------|--------|
| ORM | TypeORM with parameterized queries — **no SQL injection found** |
| Schema sync | `synchronize: true` in non-production (**risky**) |
| Migrations | Two migrations, auto-run in production |
| Connection security | No SSL configuration visible |
| Credentials | **Hardcoded fallback** in `typeorm.config.ts` |
| Sensitive data encryption | **None** — amounts stored in plaintext |

### 5.5 Docker / Infrastructure

| Aspect | Status |
|--------|--------|
| Non-root user | Yes (`USER nestjs`, UID 1001) |
| Multi-stage build | Yes (builder + production) |
| Health check | Yes (HTTP check on `/api/health`) |
| Secrets in image | None (env vars at runtime) |
| Base image | `node:20-alpine` (minimal attack surface) |
| Dependency pinning | `pnpm install --frozen-lockfile` (good) |
| pnpm version | `@latest` (**non-deterministic**) |

---

## 6. Recommendations

### Immediate (Pre-Production)

1. **Apply `@UseGuards(JwtAuthGuard)` to ALL controllers** — except health check and auth login endpoints.

2. **Add IDOR protection** — verify `req.user.id === param.userId` on every user-specific endpoint.

3. **Remove `recipientAddress` from liquidation endpoint** — always use `position.userId` as beneficiary.

4. **Fail startup if critical env vars are missing** — `JWT_SECRET`, `DATABASE_PASSWORD`, `RELAYER_PRIVATE_KEY`, `CORS_ORIGIN`.

5. **Implement SIWE (EIP-4361) message parsing** — validate nonce, domain, timestamp, chain ID.

### Short-Term (Before Mainnet)

6. **Separate relayer keys per chain** — use distinct `ASSETHUB_RELAYER_KEY` and `MOONBEAM_RELAYER_KEY`.

7. **Add rate limiting** (`@nestjs/throttler`) to all endpoints.

8. **Add Helmet.js** for security headers.

9. **Calculate slippage-adjusted minimums** before liquidation calls instead of passing zero.

10. **Implement persistent job queue** (BullMQ + Redis) for critical XCM orchestration.

11. **Add multiple price sources** and cross-validation for DOT price.

12. **Disable Swagger in production.**

13. **Set `synchronize: false` always** — use migrations exclusively.

### Medium-Term (Operational Hardening)

14. **Implement refresh tokens** with short-lived access tokens (15min).

15. **Add DB connection SSL** for production PostgreSQL.

16. **Add request logging and audit trail** for all state-changing operations.

17. **Implement proper alerting** for failed liquidations (Slack/PagerDuty integration).

18. **Add integration tests** for XCM byte encoding/decoding round-trips.

19. **Add monitoring** for RPC rate limits, event listener health, worker execution times.

20. **Consider HSM/KMS** for production private key management.

---

## Positive Security Patterns Found

- **No SQL injection** — all ORM queries use parameterized bindings
- **No `eval`/`exec`/dynamic code execution** anywhere in the codebase
- **No hardcoded private keys** — all from environment variables
- **ValidationPipe with whitelist** applied globally (`main.ts`)
- **Conditional DB update for concurrency** in liquidation (`positions.service.ts:265`)
- **Exponential backoff with error classification** in XCM retry
- **Pool state batch caching** (15s TTL) in stop-loss worker
- **Worker `isProcessing` guards** prevent overlapping executions
- **Non-root Docker user** with health check
- **CSPRNG for position IDs** via `ethers.randomBytes(32)`
- **Activity logging** for critical operations with tx hashes
