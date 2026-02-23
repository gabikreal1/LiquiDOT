# LiquiDOT Frontend Design Document

> **Handoff document for frontend development.**
> Covers every page, component, and field the UI must expose.
> Web3 wallet integration is handled separately — this document focuses on UI structure, data display, and user flows.

---

## Table of Contents

1. [Tech Stack & Conventions](#tech-stack--conventions)
2. [Navigation & Layout](#navigation--layout)
3. [Landing Page](#1-landing-page)
4. [Dashboard](#2-dashboard)
5. [Strategy Configuration](#3-strategy-configuration)
6. [Pool Explorer](#4-pool-explorer)
7. [Position Detail](#5-position-detail)
8. [Activity History](#6-activity-history)
9. [Settings & Account](#7-settings--account)
10. [API Reference](#api-reference)
11. [Type Definitions](#type-definitions)
12. [Status Enums](#status-enums)

---

## Tech Stack & Conventions

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Styling | Tailwind CSS + shadcn/ui components |
| State | React Query (TanStack Query) for server state |
| Real-time | Server-Sent Events (SSE) for position updates |
| Icons | Lucide React |
| Charts | Recharts (or similar) |
| Auth | SIWE (Sign-In with Ethereum) / SIWS (Sign-In with Substrate) — separate integration doc |

**Design tokens (shadcn defaults):**
- Positive P&L: `text-green-500`
- Negative P&L: `text-red-500`
- Pending states: `text-yellow-500`
- Muted/secondary text: `text-muted-foreground`
- Cards: `<Card>` with subtle border, rounded-lg

**API base:** `NEXT_PUBLIC_API_URL` env var (empty string in production for same-domain `/api/...` routing).

---

## Navigation & Layout

### Top Navigation Bar

```
┌──────────────────────────────────────────────────────────────────────┐
│  [Logo] LiquiDOT          Home  Dashboard  Pools  Activity          │
│                                                    [Connect Wallet]  │
└──────────────────────────────────────────────────────────────────────┘
```

| Item | Route | Visibility |
|------|-------|------------|
| Home (Landing) | `/` | Always |
| Dashboard | `/dashboard` | Authenticated |
| Pools | `/pools` | Always (read-only for guests) |
| Activity | `/activity` | Authenticated |
| Connect Wallet | — | When disconnected |
| Wallet badge + avatar | — | When connected (shows truncated address) |

**Mobile:** Hamburger menu collapsing nav items. Wallet button always visible.

### Footer

```
┌──────────────────────────────────────────────────────────────────────┐
│  LiquiDOT © 2026                                                     │
│  Docs  ·  GitHub  ·  Twitter  ·  Discord                            │
│  Built on Polkadot                                                   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 1. Landing Page

**Route:** `/`

The landing page is the public-facing marketing page. No authentication required.

### Hero Section

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│              Automated Liquidity Management                          │
│                 for the Polkadot Ecosystem                           │
│                                                                      │
│  Deposit DOT. Set your strategy. Let LiquiDOT optimize              │
│  your LP positions across chains — with built-in                     │
│  stop-loss, take-profit, and automated rebalancing.                  │
│                                                                      │
│          [Get Started]          [View Pools →]                       │
│                                                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                     │
│  │  $2.4M+    │  │   12+      │  │   24/7     │                     │
│  │  TVL       │  │   Pools    │  │  Monitored │                     │
│  └────────────┘  └────────────┘  └────────────┘                     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

- **"Get Started"** → scrolls to connect-wallet CTA or `/dashboard` if connected
- **"View Pools"** → `/pools`
- Stats row: Pull live data from `GET /api/pools` (count, sum TVL) and health check. Can be static/cached.

### How It Works Section

Four-step visual flow with icons and brief copy.

```
┌──────────────────────────────────────────────────────────────────────┐
│                      How It Works                                    │
│                                                                      │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐      │
│  │  1       │    │  2       │    │  3       │    │  4       │      │
│  │ Deposit  │ →  │Configure │ →  │ Auto-LP  │ →  │ Earn &   │      │
│  │  DOT     │    │ Strategy │    │ Positions│    │ Protect  │      │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘      │
│                                                                      │
│  Deposit DOT      Set risk         LiquiDOT       Stop-loss &       │
│  on Asset Hub.    tolerance,       finds optimal   take-profit       │
│                   APY targets,     pools and        trigger           │
│                   token prefs.     mints LP.        automatically.    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Supported Chains Section

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Cross-Chain Coverage                               │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐                         │
│  │  Asset Hub        │  │  Moonbeam         │                        │
│  │  [chain logo]     │  │  [chain logo]     │                        │
│  │  Custody Layer    │  │  Execution Layer  │                        │
│  │  Secure DOT       │  │  Algebra DEX /    │                        │
│  │  deposit &        │  │  StellaSwap       │                        │
│  │  accounting       │  │  LP positions     │                        │
│  │                   │  │                   │                        │
│  │  ● LIVE           │  │  ● LIVE           │                        │
│  └──────────────────┘  └──────────────────┘                         │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐                         │
│  │  Hydration        │  │  Astar            │                        │
│  │  [chain logo]     │  │  [chain logo]     │                        │
│  │  Multi-asset      │  │  WASM + EVM       │                        │
│  │  DEX & Omnipool   │  │  dApp Hub         │                        │
│  │                   │  │                   │                        │
│  │  ○ COMING SOON    │  │  ○ PLANNED        │                        │
│  └──────────────────┘  └──────────────────┘                         │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

- **Asset Hub** — LIVE (green dot). Custody layer.
- **Moonbeam** — LIVE (green dot). Execution layer. Algebra / StellaSwap Pulsar.
- **Hydration** — COMING SOON (yellow dot). Omnipool integration planned.
- **Astar** — PLANNED (grey dot). WASM + EVM dApp hub.

### Features Grid

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Key Features                                  │
│                                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐                   │
│  │  Stop-Loss &        │  │  Asymmetric Ranges   │                  │
│  │  Take-Profit        │  │                      │                  │
│  │                     │  │  Different stop-loss  │                  │
│  │  Auto-exit when     │  │  and take-profit      │                  │
│  │  price breaches     │  │  percentages. Express │                  │
│  │  your thresholds.   │  │  directional views.   │                  │
│  │  24/7 monitoring.   │  │                      │                  │
│  └─────────────────────┘  └─────────────────────┘                   │
│                                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐                   │
│  │  Smart Rebalancing  │  │  Risk-Adjusted       │                  │
│  │                     │  │  Pool Scoring         │                  │
│  │  Only rebalances    │  │                      │                  │
│  │  when profitable    │  │  IL risk factored     │                  │
│  │  after gas costs.   │  │  into APY scoring.    │                  │
│  │  Cost-benefit       │  │  Filters by TVL,      │                  │
│  │  analysis on every  │  │  age, token trust.    │                  │
│  │  action.            │  │                      │                  │
│  └─────────────────────┘  └─────────────────────┘                   │
│                                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐                   │
│  │  Cross-Chain via    │  │  Secure Custody      │                  │
│  │  XCM                │  │                      │                  │
│  │                     │  │  Funds held on        │                  │
│  │  Native Polkadot    │  │  Asset Hub. Only      │                  │
│  │  messaging. No      │  │  move when actively   │                  │
│  │  bridges. No        │  │  providing liquidity. │                  │
│  │  wrapped tokens.    │  │                      │                  │
│  └─────────────────────┘  └─────────────────────┘                   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Live Pool Preview Section

Show top 5 pools from `GET /api/pools/top?limit=5` in a compact table.

```
┌──────────────────────────────────────────────────────────────────────┐
│                     Top Performing Pools                              │
│                                                                      │
│  Pool            APR        TVL           Volume 24h     Fee         │
│  ─────────────   ────────   ───────────   ───────────   ────        │
│  xcDOT/WGLMR    18.42%     $2,340,000    $456,000      0.30%       │
│  xcDOT/USDC     14.87%     $1,890,000    $312,000      0.30%       │
│  WGLMR/USDC     12.15%     $5,120,000    $890,000      0.05%       │
│  WETH/USDC      11.20%     $8,200,000    $1,240,000    0.30%       │
│  WBTC/USDC       9.85%     $3,450,000    $567,000      0.30%       │
│                                                                      │
│                      [Explore All Pools →]                           │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### CTA Section

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│         Ready to optimize your liquidity?                            │
│                                                                      │
│         Connect your wallet to get started.                          │
│                                                                      │
│                    [Connect Wallet]                                   │
│                                                                      │
│    Supports: Talisman · SubWallet · Polkadot.js · MetaMask          │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Deployment Addresses (Collapsible)

Small footer section above the main footer. Collapsed by default.

```
┌──────────────────────────────────────────────────────────────────────┐
│  ▶ Contract Addresses                                                │
│                                                                      │
│  (expanded:)                                                         │
│  Mainnet                                                             │
│    XCMProxy (Moonbeam 1284): 0x0cfb7CE7D66C7CdAe5827074C5f5A62...  │
│                                                                      │
│  Testnet                                                             │
│    AssetHubVault (Paseo): 0x68e86F267C5C37dd4947ef8e5823eBAe...     │
│    XCMProxy (Moonbase 1287): 0x7f4b3620d6Ffcc15b11ca8679c57c0...    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Dashboard

**Route:** `/dashboard`
**Auth:** Required (redirect to `/` if not connected)
**Data:** `GET /api/dashboard/{userId}` + SSE at `GET /api/positions/user/{userId}/events`

### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Dashboard                                            [⚙ Strategy]  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                    Portfolio Overview                            │ │
│  │                                                                 │ │
│  │  Available     Total Invested   Current Value     Total P&L     │ │
│  │  150.50 DOT    $500.00          $550.00           +$50.00       │ │
│  │  ($1,053.50)                                      (+10.00%)     │ │
│  │                                                                 │ │
│  │  Active: 2     Pending: 1                                       │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────┐ ┌──────────────────────────────┐ │
│  │       Pool Allocations         │ │      Recent Activity         │ │
│  │                                │ │                              │ │
│  │      [Donut Chart]             │ │  Investment   Confirmed      │ │
│  │                                │ │  0x1234...cdef  30m ago      │ │
│  │  xcDOT/WGLMR   $375           │ │                              │ │
│  │  xcDOT/USDC    $175           │ │  Liquidation  Failed         │ │
│  │                                │ │  —              2h ago       │ │
│  │                                │ │                              │ │
│  │                                │ │  Withdrawal   Pending        │ │
│  │                                │ │  —              just now     │ │
│  └────────────────────────────────┘ └──────────────────────────────┘ │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                       Positions                                 │ │
│  │                                                                 │ │
│  │  Pool          Amount       Value     P&L       Status   Tx    │ │
│  │  ───────────   ──────────   ───────   ───────   ──────   ───── │ │
│  │  xcDOT/WGLMR  50.00 DOT    $375.00   +7.14%    Active   AH|MB│ │
│  │  xcDOT/USDC   30.00 DOT    $210.00   -2.33%    Pending  —  — │ │
│  │                                                                 │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Portfolio Overview Card

| Field | Source | Format |
|-------|--------|--------|
| Available Balance (DOT) | `data.user.balanceDot` | `{n}.XX DOT` |
| Available Balance (USD) | `data.user.balanceUsd` | `($X,XXX.XX)` muted |
| Total Invested | `data.summary.totalInvestedUsd` | `$X,XXX.XX` |
| Current Value | `data.summary.totalCurrentValueUsd` | `$X,XXX.XX` |
| Total P&L (USD) | `data.summary.totalPnlUsd` | `+$XX.XX` or `-$XX.XX` |
| Total P&L (%) | `data.summary.totalPnlPercent` | `+XX.XX%` or `-XX.XX%` |
| Active count | `data.summary.activePositionCount` | Badge: `Active: N` |
| Pending count | `data.summary.pendingPositionCount` | Badge: `Pending: N` (hide if 0) |

**Color rules:** Positive P&L → `text-green-500`. Negative → `text-red-500`. Zero → default.

### Positions Table

| Column | Source | Format | Notes |
|--------|--------|--------|-------|
| Pool | `position.poolName` | String | e.g. `xcDOT/WGLMR` |
| Amount | `position.amountDot` | `XX.XX DOT` | |
| Value | `position.currentValueUsd` | `$XXX.XX` | |
| P&L | `position.pnlPercent` | `+X.XX%` / `-X.XX%` | Green/red |
| Status | `position.status` | `<PositionStatusBadge>` | See status badge spec |
| AH Tx | `position.assetHubTxHash` | Truncated `0x1234...cdef` | Link to explorer. `—` if null |
| MB Tx | `position.moonbeamTxHash` | Truncated `0xabcd...7890` | Link to explorer. `—` if null |

**Row click** → navigates to `/dashboard/positions/{id}` (position detail page).

**Empty state:** "No positions yet. Configure your strategy to get started." with link to `/dashboard/strategy`.

### Pool Allocations (Donut Chart)

- Filter `data.pools` where `userAllocationUsd > 0`
- Each slice: pool `name` + `$userAllocationUsd`
- Color palette: 6 distinct HSL colors
- Empty state: "No active allocations."

### Recent Activity Feed

- Shows latest 20 items from `data.recentActivity`
- Each item: type label, status badge, truncated `txHash`, relative timestamp
- ScrollArea with `max-h-[280px]`
- Empty state: "No recent activity."

### Real-Time Updates (SSE)

Connect to `GET /api/positions/user/{userId}/events` on mount. On any event (`CREATED`, `EXECUTED`, `LIQUIDATED`, `FAILED`, `STATUS_CHANGE`), invalidate the dashboard query cache to trigger a refetch.

---

## 3. Strategy Configuration

**Route:** `/dashboard/strategy`
**Auth:** Required
**Data:** `GET /api/users/{userId}/preferences` (read), `PUT /api/users/{userId}/preferences` (save)

This is the most field-heavy page. It maps 1:1 to the `UserPreference` entity. Group fields into logical sections with progressive disclosure (basic → advanced).

### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Strategy Configuration                                              │
│  Configure how LiquiDOT manages your liquidity positions.            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─── Investment Strategy ───────────────────────────────────────┐   │
│  │                                                               │   │
│  │  Minimum APY Target          [    8.00   ] %                  │   │
│  │  Max Concurrent Positions    [    6      ]                    │   │
│  │  Max Allocation Per Position [  25,000   ] USD                │   │
│  │  Min Position Size           [    45     ] USD                │   │
│  │                                                               │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─── Position Ranges ───────────────────────────────────────────┐   │
│  │                                                               │   │
│  │  Default Stop-Loss           [   -5      ] %                  │   │
│  │  Default Take-Profit         [   +10     ] %                  │   │
│  │                                                               │   │
│  │  ┌───────────────────────────────────────────────────┐        │   │
│  │  │            Visual Range Indicator                  │        │   │
│  │  │                                                   │        │   │
│  │  │    -5%          Entry Price           +10%        │        │   │
│  │  │     ├──────────────●──────────────────────┤       │        │   │
│  │  │     SL                                    TP      │        │   │
│  │  └───────────────────────────────────────────────────┘        │   │
│  │                                                               │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─── Pool Filters ─────────────────────────────────────────────┐   │
│  │                                                               │   │
│  │  Minimum TVL                 [ 1,000,000 ] USD                │   │
│  │  Minimum Pool Age            [   14      ] days               │   │
│  │                                                               │   │
│  │  Allowed Tokens (multi-select chips):                         │   │
│  │  [xcDOT] [WGLMR] [USDC] [USDT] [WETH] [WBTC] [+ Add]       │   │
│  │                                                               │   │
│  │  Preferred DEXes (multi-select):                              │   │
│  │  [Algebra] [StellaSwap] [+ Add]                               │   │
│  │                                                               │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─── Safety & Risk ────────────────────────────────────────────┐   │
│  │                                                               │   │
│  │  Max IL Loss Before Exit     [   6.00    ] %                  │   │
│  │  Daily Rebalance Limit       [    8      ]                    │   │
│  │  Expected Gas Cost           [   1.00    ] USD                │   │
│  │                                                               │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─── Automation ────────────────────────────────────────────────┐   │
│  │                                                               │   │
│  │  Auto-Invest Enabled         [  Toggle: ON  ]                 │   │
│  │  Check Interval              [  4 hours     ] ▼               │   │
│  │                                                               │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ▶ Advanced Parameters (collapsed by default)                        │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │                                                               │   │
│  │  Risk Aversion (λ)           [───●──────] 0.50                │   │
│  │  Min Benefit Threshold (θ)   [───●──────] 0.00                │   │
│  │  Planning Horizon            [   7      ] days                │   │
│  │                                                               │   │
│  │  ℹ️ These parameters tune the investment optimization         │   │
│  │  algorithm. Defaults work well for most users.                │   │
│  │                                                               │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│                               [Save Strategy]                        │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Complete Field Specification

#### Section: Investment Strategy

| Field | Key | Type | Default | Input | Validation | Help Text |
|-------|-----|------|---------|-------|------------|-----------|
| Minimum APY Target | `minApy` | decimal | 8.00 | Number input + `%` suffix | >= 0 | Pools below this threshold are filtered out |
| Max Concurrent Positions | `maxPositions` | int | 6 | Number input | 1–20 | How many pools to invest in simultaneously |
| Max Allocation Per Position | `maxAllocPerPositionUsd` | decimal | 25000 | Number input + `USD` suffix | > 0 | Caps single-pool exposure |
| Min Position Size | `minPositionSizeUsd` | decimal | 45 | Number input + `USD` suffix | > 0 | Positions below this are skipped |

#### Section: Position Ranges

| Field | Key | Type | Default | Input | Validation | Help Text |
|-------|-----|------|---------|-------|------------|-----------|
| Default Stop-Loss | `defaultLowerRangePercent` | int | -5 | Number input + `%` suffix (negative) | -50 to 0 | Automatic exit below this price drop |
| Default Take-Profit | `defaultUpperRangePercent` | int | 10 | Number input + `%` suffix (positive) | 0 to 100 | Automatic exit above this price gain |

**Visual range indicator:** A horizontal bar showing the asymmetric range. Entry price at center. Left side = stop-loss (red zone). Right side = take-profit (green zone). Updates as user drags slider or types values.

#### Section: Pool Filters

| Field | Key | Type | Default | Input | Validation | Help Text |
|-------|-----|------|---------|-------|------------|-----------|
| Minimum TVL | `minTvlUsd` | decimal | 1000000 | Number input + `USD` suffix | >= 0 | Only consider pools with this TVL or higher |
| Minimum Pool Age | `minPoolAgeDays` | int | 14 | Number input + `days` suffix | >= 0 | Filters out brand-new, unproven pools |
| Allowed Tokens | `allowedTokens` | string[] | null | Multi-select chips | — | Both tokens in a pair must be allowed. `null` = all tokens |
| Preferred DEXes | `preferredDexes` | string[] | null | Multi-select chips | — | Restrict to specific DEXes. `null` = all DEXes |

**Token chip options:** `xcDOT`, `WGLMR`, `USDC`, `USDT`, `WETH`, `WBTC`, `DAI`, `GLMR`
**DEX chip options:** `Algebra`, `StellaSwap` (more to come with Hydration/Astar)

#### Section: Safety & Risk

| Field | Key | Type | Default | Input | Validation | Help Text |
|-------|-----|------|---------|-------|------------|-----------|
| Max IL Loss Before Exit | `maxIlLossPercent` | decimal | 6.00 | Number input + `%` suffix | 0–50 | Won't exit positions with IL above this (avoids locking in loss) |
| Daily Rebalance Limit | `dailyRebalanceLimit` | int | 8 | Number input | 1–50 | Prevents excessive trading in volatile markets |
| Expected Gas Cost | `expectedGasUsd` | decimal | 1.00 | Number input + `USD` suffix | > 0 | Estimated gas per transaction for profitability check |

#### Section: Automation

| Field | Key | Type | Default | Input | Validation | Help Text |
|-------|-----|------|---------|-------|------------|-----------|
| Auto-Invest Enabled | `autoInvestEnabled` | boolean | true | Toggle switch | — | When off, system only monitors existing positions |
| Check Interval | `investmentCheckIntervalSeconds` | int | 14400 | Dropdown | — | How often the system re-evaluates your portfolio |

**Check Interval dropdown options:**

| Label | Value (seconds) |
|-------|----------------|
| Every 1 hour | 3600 |
| Every 2 hours | 7200 |
| Every 4 hours (default) | 14400 |
| Every 8 hours | 28800 |
| Every 12 hours | 43200 |
| Every 24 hours | 86400 |

#### Section: Advanced Parameters (Collapsed)

| Field | Key | Type | Default | Input | Validation | Help Text |
|-------|-----|------|---------|-------|------------|-----------|
| Risk Aversion (λ) | `lambdaRiskAversion` | decimal | 0.50 | Slider 0.00–1.00 | 0–1 | 0 = risk-neutral, 1 = very risk-averse |
| Min Benefit Threshold (θ) | `thetaMinBenefit` | decimal | 0.00 | Number input | >= 0 | Minimum net utility gain to trigger rebalance |
| Planning Horizon | `planningHorizonDays` | int | 7 | Number input + `days` suffix | 1–90 | Time horizon for rebalancing profit calculations |

### Preset Strategies (Optional Quick-Start)

Offer 3 preset buttons above the form that auto-fill values:

| Preset | minApy | SL | TP | λ | maxPositions |
|--------|--------|-----|-----|-----|-------------|
| **Conservative** | 5% | -3% | +8% | 0.80 | 3 |
| **Balanced** | 10% | -5% | +15% | 0.50 | 6 |
| **Aggressive** | 20% | -10% | +30% | 0.20 | 10 |

Clicking a preset fills the form but doesn't save — user still reviews and clicks "Save Strategy".

---

## 4. Pool Explorer

**Route:** `/pools`
**Auth:** Not required (public)
**Data:** `GET /api/pools` with query params

### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Pool Explorer                                                       │
│                                                                      │
│  ┌─── Filters ──────────────────────────────────────────────────┐   │
│  │  Search: [____________]  Min TVL: [________]  Token: [_____] │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  Pool            Token Pair     APR       TVL          Volume 24h   │
│  ──────────────  ───────────    ────────  ───────────  ───────────  │
│  xcDOT/WGLMR    xcDOT / WGLMR  18.42%    $2,340,000   $456,000    │
│  xcDOT/USDC     xcDOT / USDC   14.87%    $1,890,000   $312,000    │
│  WGLMR/USDC     WGLMR / USDC   12.15%    $5,120,000   $890,000    │
│  WETH/USDC      WETH / USDC    11.20%    $8,200,000   $1,240,000  │
│  ...                                                                 │
│                                                                      │
│  Showing 1-10 of 24            [◀ Prev]  [Next ▶]                  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Table Columns

| Column | Source | Format | Sortable |
|--------|--------|--------|----------|
| Pool | `token0Symbol/token1Symbol` | String | Yes |
| APR | `apr` | `XX.XX%` | Yes (default desc) |
| TVL | `tvl` | `$X,XXX,XXX` | Yes |
| Volume 24h | `volume24h` | `$X,XXX,XXX` | Yes |
| Fee | `fee` | `X.XX%` (fee / 10000) | Yes |

### Filters

| Filter | API Param | Input |
|--------|-----------|-------|
| Search by token | `token` query (uses `/pools/search`) | Text input |
| Min TVL | `minTvl` | Number input |
| Min APR | `minApr` | Number input |

### Pagination

- Default: 10 per page
- API params: `limit` + `offset`

---

## 5. Position Detail

**Route:** `/dashboard/positions/{id}`
**Auth:** Required
**Data:** `GET /api/positions/{id}` + `GET /api/positions/{id}/pnl`

### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← Back to Dashboard                                                 │
│                                                                      │
│  Position: xcDOT/WGLMR                          Status: [Active]    │
│                                                                      │
│  ┌─── Overview ─────────────────────────────────────────────────┐   │
│  │                                                               │   │
│  │  Amount Invested     50.00 DOT                                │   │
│  │  Chain               Moonbeam (1284)                          │   │
│  │  Pool                xcDOT/WGLMR                              │   │
│  │  Created             Feb 1, 2026 12:00 PM                     │   │
│  │  Executed            Feb 1, 2026 12:05 PM                     │   │
│  │                                                               │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─── Range ────────────────────────────────────────────────────┐   │
│  │                                                               │   │
│  │  Stop-Loss           -5%                                      │   │
│  │  Take-Profit         +10%                                     │   │
│  │  Entry Price         $7.50                                    │   │
│  │  Lower Tick          -1234                                    │   │
│  │  Upper Tick          +5678                                    │   │
│  │                                                               │   │
│  │  ┌───────────────────────────────────────────────────┐        │   │
│  │  │     -5%      ●  Current Price        +10%        │        │   │
│  │  │      ├────────▼─────────────────────────┤         │        │   │
│  │  └───────────────────────────────────────────────────┘        │   │
│  │                                                               │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─── P&L Breakdown ───────────────────────────────────────────┐   │
│  │                                                               │   │
│  │  Entry Value (USD)          $350.00                           │   │
│  │  Current Value (USD)        $375.00                           │   │
│  │  Fees Earned (USD)          $12.50                            │   │
│  │  IL Loss (USD)              -$2.00                            │   │
│  │  ─────────────────────────────────                            │   │
│  │  Net P&L                    +$25.00  (+7.14%)                 │   │
│  │                                                               │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─── Transactions ─────────────────────────────────────────────┐   │
│  │                                                               │   │
│  │  Asset Hub Tx   0x1234...cdef   [View on Explorer ↗]         │   │
│  │  Moonbeam Tx    0xabcd...7890   [View on Explorer ↗]         │   │
│  │                                                               │   │
│  │  AH Position ID    0x9876...1234                              │   │
│  │  Moonbeam NFT ID   42                                         │   │
│  │                                                               │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Field Mapping

| Display Field | Source | Format |
|---------------|--------|--------|
| Amount | `position.amount` | Convert from wei to DOT (÷ 10^10) |
| Chain | `position.chainId` | Map: 1284→"Moonbeam", 1287→"Moonbase Alpha" |
| Pool | Join from pool data | `token0Symbol/token1Symbol` |
| Created | `position.createdAt` | Formatted date |
| Executed | `position.executedAt` | Formatted date or `—` |
| Stop-Loss | `position.lowerRangePercent` | `{n}%` |
| Take-Profit | `position.upperRangePercent` | `+{n}%` |
| Entry Price | `position.entryPrice` | Convert from wei |
| Lower/Upper Tick | `position.lowerTick`, `position.upperTick` | Integer |
| AH Tx | `position.assetHubTxHash` | Truncated, link to Subscan |
| MB Tx | `position.moonbeamTxHash` | Truncated, link to Moonscan |
| AH Position ID | `position.assetHubPositionId` | Truncated bytes32 |
| MB NFT ID | `position.moonbeamPositionId` | Integer |

### P&L Breakdown (from `/positions/{id}/pnl`)

| Field | Source | Format |
|-------|--------|--------|
| Entry Value | `pnl.entryAmountUsd` | `$XXX.XX` |
| Current Value | `pnl.currentValueUsd` | `$XXX.XX` |
| Fees Earned | `pnl.feesEarnedUsd` | `$XX.XX` |
| IL Loss | `pnl.ilLossUsd` | `-$XX.XX` (always shown as loss) |
| Net P&L | `pnl.netPnLUsd` | `+$XX.XX` / `-$XX.XX` |
| Net P&L % | `pnl.netPnLPercent` | `+X.XX%` / `-X.XX%` |

### Explorer Links

| Chain | Explorer | URL Pattern |
|-------|----------|-------------|
| Moonbeam (1284) | Moonscan | `https://moonscan.io/tx/{hash}` |
| Moonbase (1287) | Moonscan Testnet | `https://moonbase.moonscan.io/tx/{hash}` |
| Paseo Asset Hub | Subscan | `https://paseo-assethub.subscan.io/extrinsic/{hash}` |

---

## 6. Activity History

**Route:** `/activity`
**Auth:** Required
**Data:** `GET /api/dashboard/{userId}` → `recentActivity` array (or dedicated activity endpoint if added)

### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Activity History                                                    │
│                                                                      │
│  ┌─── Filters ──────────────────────────────────────────────────┐   │
│  │  Type: [All ▼]     Status: [All ▼]                           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  ● Investment     Confirmed     0x1234...cdef     30m ago    │   │
│  │    Amount: 50 DOT → xcDOT/WGLMR pool                        │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │  ● Liquidation    Failed        —                  2h ago    │   │
│  │    Position out of range, retry scheduled                    │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │  ● Withdrawal     Pending       —                  just now  │   │
│  │    Withdrawal of 20 DOT requested                            │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │  ● Auto-Rebalance Confirmed     0x5678...9abc     1d ago    │   │
│  │    Moved from xcDOT/USDC to xcDOT/WGLMR                     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Activity Types

| Type | Badge Color | Icon |
|------|------------|------|
| `INVESTMENT` | Blue | ArrowDownRight |
| `WITHDRAWAL` | Orange | ArrowUpRight |
| `LIQUIDATION` | Red | AlertTriangle |
| `AUTO_REBALANCE` | Purple | RefreshCw |
| `ERROR` | Red/destructive | XCircle |

### Activity Statuses

| Status | Badge Variant |
|--------|--------------|
| `PENDING` | outline (yellow) |
| `SUBMITTED` | secondary |
| `CONFIRMED` | default (green) |
| `FAILED` | destructive (red) |

### Activity Item Fields

| Field | Source | Notes |
|-------|--------|-------|
| Type | `activity.type` | Badge with icon |
| Status | `activity.status` | Badge with color |
| Tx Hash | `activity.txHash` | Truncated, link to explorer. `—` if null |
| Timestamp | `activity.createdAt` | Relative: "just now", "30m ago", "2h ago", or full date |
| Details | `activity.details` | JSON — render relevant fields as subtitle text |

---

## 7. Settings & Account

**Route:** `/dashboard/settings`
**Auth:** Required

Minimal page for account info (wallet address, user ID, join date). Strategy config lives on its own page.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Account                                                             │
│                                                                      │
│  Wallet Address     0x1234567890abcdef1234567890abcdef12345678       │
│  User ID            a1b2c3d4-e5f6-7890-abcd-ef1234567890            │
│  Member Since       February 1, 2026                                 │
│  Status             Active                                           │
│                                                                      │
│                     [Disconnect Wallet]                               │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## API Reference

### Endpoints Used by Frontend

| Method | Endpoint | Auth | Page |
|--------|----------|------|------|
| `POST` | `/api/auth/login/evm` | No | Connect wallet |
| `POST` | `/api/auth/login/substrate` | No | Connect wallet |
| `POST` | `/api/users` | No | Registration |
| `GET` | `/api/dashboard/{userId}` | Yes | Dashboard |
| `GET` | `/api/positions/user/{userId}/events` | Yes | Dashboard (SSE) |
| `GET` | `/api/positions/{id}` | Yes | Position detail |
| `GET` | `/api/positions/{id}/pnl` | Yes | Position detail |
| `GET` | `/api/pools` | No | Pool explorer |
| `GET` | `/api/pools/top?limit=5` | No | Landing page |
| `GET` | `/api/pools/search?token={symbol}` | No | Pool explorer |
| `GET` | `/api/health` | No | Health indicator |

### Preferences API (to be added or via user module)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/users/{userId}/preferences` | Load current strategy |
| `PUT` | `/api/users/{userId}/preferences` | Save strategy |

---

## Type Definitions

### DashboardData

```typescript
interface DashboardData {
  user: {
    id: string
    walletAddress: string
    balanceDot: number
    balanceUsd: number
  }
  positions: Array<{
    id: string
    poolName: string
    status: string
    amountDot: number
    currentValueUsd: number
    pnlUsd: number
    pnlPercent: number
    assetHubTxHash: string | null
    moonbeamTxHash: string | null
    createdAt: string
    executedAt: string | null
  }>
  recentActivity: Array<{
    type: string
    status: string
    txHash: string | null
    details: any
    createdAt: string
  }>
  pools: Array<{
    id: string
    name: string
    apr: string
    tvl: string
    userAllocationUsd: number
  }>
  summary: {
    totalInvestedUsd: number
    totalCurrentValueUsd: number
    totalPnlUsd: number
    totalPnlPercent: number
    activePositionCount: number
    pendingPositionCount: number
  }
}
```

### PoolData

```typescript
interface PoolData {
  id: string
  poolAddress: string
  token0Symbol: string
  token1Symbol: string
  apr: string
  tvl: string
  volume24h: string
  fee: number
}
```

### UserPreference (save payload)

```typescript
interface UserPreference {
  // Investment Strategy
  minApy: number                      // default: 8.0
  maxPositions: number                // default: 6
  maxAllocPerPositionUsd: number      // default: 25000
  minPositionSizeUsd: number          // default: 45

  // Position Ranges
  defaultLowerRangePercent: number    // default: -5
  defaultUpperRangePercent: number    // default: 10

  // Pool Filters
  minTvlUsd: number                   // default: 1000000
  minPoolAgeDays: number              // default: 14
  allowedTokens: string[] | null      // default: null (all)
  preferredDexes: string[] | null     // default: null (all)

  // Safety
  maxIlLossPercent: number            // default: 6.0
  dailyRebalanceLimit: number         // default: 8
  expectedGasUsd: number              // default: 1.0

  // Automation
  autoInvestEnabled: boolean          // default: true
  investmentCheckIntervalSeconds: number  // default: 14400

  // Advanced
  lambdaRiskAversion: number          // default: 0.5
  thetaMinBenefit: number             // default: 0.0
  planningHorizonDays: number         // default: 7
}
```

### PositionPnL

```typescript
interface PositionPnL {
  positionId: string
  entryAmountUsd: number
  currentValueUsd: number
  feesEarnedUsd: number
  ilLossUsd: number
  netPnLUsd: number
  netPnLPercent: number
}
```

---

## Status Enums

### PositionStatus

| Value | Display | Badge Variant | Color |
|-------|---------|---------------|-------|
| `PENDING_EXECUTION` | Pending | outline | yellow |
| `ACTIVE` | Active | default | green |
| `OUT_OF_RANGE` | Out of Range | secondary | orange |
| `LIQUIDATION_PENDING` | Liquidating | secondary | yellow |
| `LIQUIDATED` | Liquidated | outline | grey |
| `FAILED` | Failed | destructive | red |

### ActivityType

| Value | Display | Color |
|-------|---------|-------|
| `INVESTMENT` | Investment | blue |
| `WITHDRAWAL` | Withdrawal | orange |
| `LIQUIDATION` | Liquidation | red |
| `AUTO_REBALANCE` | Rebalance | purple |
| `ERROR` | Error | red |

### ActivityStatus

| Value | Display | Color |
|-------|---------|-------|
| `PENDING` | Pending | yellow |
| `SUBMITTED` | Submitted | blue |
| `CONFIRMED` | Confirmed | green |
| `FAILED` | Failed | red |
