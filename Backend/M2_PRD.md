# LiquiDOT Backend — Milestone 2 (Core Backend) PRD Addendum

**Status:** Draft (M2 readiness)

This document is a focused PRD for the grant **Milestone 2: Core Backend** deliverable: **Pool Data Aggregator** + **Investment Decision Worker** + **Web3 interaction layer** + **tests**.

It is derived from:
- `gitbook/_archived/roadmap.md` (Milestone 2 deliverables)
- `Backend/PRD.md` (feature requirements FR1–FR4)

---

## 🎯 Milestone 2 deliverables (from grant)

### A) LP Data Aggregator Service
- Real-time pool data collection
- Multi-DEX support (Algebra initial)
- TVL, volume, APY calculations
- Historical data storage
- API endpoints for frontend

### B) Investment Decision Worker
- User preference matching algorithm
- Risk-adjusted pool scoring
- Position sizing logic
- Rebalancing triggers
- Contract interaction layer

### C) PostgreSQL Database
- Schema implementation
- Migration system
- Indexing optimization
- Backup automation

---

## ✅ Acceptance criteria (what “done” means)

### Aggregator (AC-A)
- **AC-A1** Aggregator ingests pool data from Algebra subgraph (Moonbeam) on a schedule.
- **AC-A2** Persists pools into Postgres with normalized schema (Pool + Dex).
- **AC-A3** Calculates **APR** from fee snapshots; stores TVL and volume.
- **AC-A4** Exposes API to list pools with filtering (min TVL/APR/volume).
- **AC-A5** Has automated tests validating:
  - GraphQL query parsing
  - APR calculation correctness
  - DB upsert behavior

### Investment Decision (AC-B)
- **AC-B1** Fetches eligible pools from DB and filters by user preferences.
- **AC-B2** Produces deterministic “decision output” containing chosen pool(s) + allocation weights.
- **AC-B3** Implements at least one risk strategy (e.g., highest APR / balanced) with clear rules.
- **AC-B4** Produces “execution params” for contracts (chainId, poolId, amount, ranges).
- **AC-B5** Integration with chain interaction layer:
  - **Builds XCM message** using `XcmBuilderService` (can be mocked via `XCM_TEST_MODE`).
  - Calls the contract interaction service (e.g., `AssetHubService.dispatchInvestmentWithXcm`).
- **AC-B6** Has tests validating:
  - scoring + ranking
  - allocation math
  - preference filtering
  - interaction calls are made with correct params (mocked)

### Web3 interaction (AC-C)
- **AC-C1** EVM contract interaction services work (ethers.js) for Moonbeam + AssetHubVault.
- **AC-C2** PAPI integration exists in backend as a dedicated module/service (Substrate RPC connectivity).
- **AC-C3** “Mock mode” exists for testnets/infrastructure instability:
  - `XCM_TEST_MODE=true` returns deterministic bytes for message building.

---

## Current state in repo (gap analysis)

### Pool Aggregator
- Implemented: `src/modules/pools/pool-scanner.service.ts`
  - Pulls Algebra subgraph via GraphQL
  - Calculates 24h fees from hourly snapshots and derives APR
  - Saves pools into DB
- Gaps to address for M2 readiness:
  - Replace `setInterval()` with `@nestjs/schedule` cron job (testable + lifecycle-safe)
  - Add unit tests for APR calculation and DB upsert
  - Add e2e-ish test for GraphQL response parsing (mocked)

### Investment Decision Worker
- Incomplete: `src/modules/investment-decision/investment-decision.module.ts` is currently empty.
- Needs implementation:
  - Decision service / worker
  - Preference filters (min APR/allowed coins)
  - Scoring strategies
  - Downstream call into `AssetHubService.dispatchInvestmentWithXcm()`

### Web3
- EVM services exist: `AssetHubService`, `MoonbeamService`
- XCM builder exists: `XcmBuilderService` (supports `XCM_TEST_MODE`)
- PAPI client added: `src/modules/blockchain/papi/PapiClientService`

---

## Functional specification

### Pool Aggregator contract
**Inputs:**
- `ALGEBRA_SUBGRAPH_URL`
- (optional) dex address config

**Outputs:**
- Updated `pools` table entries

**Error modes:**
- Subgraph unavailable: keep last data, log error, retry next interval.

### Investment Decision contract
**Inputs:**
- User preferences (risk profile, min APR, allowed tokens, amount)
- Current pool snapshots from DB

**Outputs:**
- Decision list: `[{ poolAddress, chainId, amount, lowerRangePercent, upperRangePercent, score }]`

**Execution:**
- Calls:
  - `XcmBuilderService.dryRunXcm()` (optional)
  - `AssetHubService.dispatchInvestmentWithXcm()`

---

## 📌 Investment Decision Logic (from provided materials)

This section translates the provided “Portfolio Rebalancing Logic” into an implementation-ready backend spec that fits the existing Backend PRD requirements (**FR1.1–FR1.7**) and this addendum’s acceptance criteria (**AC-B1–AC-B6**).

### Decision inputs (what must be supported)

#### User-configurable parameters
- `minApyPct` (e.g. `8` for 8%)
- `allowedTokens` (token symbols; can be interpreted as either “pair must be made of allowed tokens” or “base tokens allowed”)
- `maxPositions` (e.g. 6)
- `maxAllocPerPosUsd` (e.g. 25_000)
- `dailyRebalanceLimit` (default 8)
- `expectedGasUsd` (default 1.0, or live estimate)
- `riskAversionLambda` (optional, for the mathematical utility framework; if not provided, defaults per strategy)

#### Bot/runtime state
- `totalCapitalUsd`
- `currentPositions[]` (from DB; includes pool id/address, DEX, pair, allocationUsd, currentApyPct)
- `rebalancesToday` (rolling 24h or UTC-day counter)

### Pool eligibility filters (AC-B1)

Candidate pools MUST satisfy:
- Pair tokens are allowed (implementation detail: tokenize pair into `token0Symbol/token1Symbol` and ensure both are included in `allowedTokens`).
- DEX is in the enabled list.
- `apy30dAvgPct >= minApyPct * 0.95` (volatility tolerance).
- `tvlUsd >= 1_000_000`.
- `ageDays >= 14`.

### Effective APY and IL risk heuristic (AC-B3)

For each candidate, compute:
$$\text{effective\_apy} = \text{apy30dAvg} \cdot (1 - \text{il\_risk\_factor})$$

Default IL risk factors (heuristic, deterministic):
- 0.00 — stable/stable
- 0.08 — bluechip/volatile (ETH/BTC vs stable)
- 0.18 — mid-cap
- 0.30 — other

Notes:
- If the pool metadata does not contain a “category”, infer it from token symbols.
- This heuristic is intentionally simple (no ML), matching the provided materials.

### Ideal portfolio construction (greedy) (AC-B2, AC-B4)

1) Sort candidates by `effectiveApyPct` descending.
2) Allocate greedily:
- Up to `maxPositions` pools.
- `allocUsd = min(maxAllocPerPosUsd, remainingCapitalUsd)`.
- Skip allocations `< 3000` USD (not worth gas).
- If remainder `> 3000` USD, add remainder to the most liquid stable pool (e.g., USDC/USDT with highest TVL).

Decision Output shape (deterministic):
- `decisionId` (timestamp + hash of inputs)
- `idealPositions[]`: `{ poolId|poolAddress, dex, pair, allocUsd, effectiveApyPct, score }`
- `actions`: `{ toWithdraw[], toAdd[], toAdjust[] }`
- `estimatedGasTotalUsd`, `profit30dUsd`, `netProfit30dUsd`
- `shouldExecute` boolean + `reasons[]`

### Compare current vs ideal (rebalance diff)

Define:
- `toWithdraw`: pools not in ideal OR where allocation delta > 5%
- `toAdd`: new pools OR increased allocations
- `toAdjust`: reduced allocations in existing pools

Allocation delta rule:
$$\Delta_{alloc} = \frac{|alloc_{ideal} - alloc_{current}|}{alloc_{current}}$$

### Costs and net benefit threshold (AC-B2)

Estimated rebalance transaction cost:
$$\text{gas} = (|toWithdraw| \cdot 1.8 \cdot expectedGasUsd) + (|toAdd| \cdot 1.6 \cdot expectedGasUsd)$$

Estimated 30-day profit uplift:
- `currentWeightedApyPct = sum(allocUsd * currentApyPct) / totalCapitalUsd`
- `idealWeightedApyPct = sum(allocUsd * effectiveApyPct) / totalCapitalUsd`
$$\text{profit}_{30d} = \frac{(ideal - current)}{100} \cdot totalCapitalUsd \cdot \frac{30}{365}$$

Net 30-day profit:
$$\text{netProfit}_{30d} = \text{profit}_{30d} - \text{gas}$$

### Execution condition (AC-B5)

Execute only if ALL conditions hold:
1) `rebalancesToday < dailyRebalanceLimit`
2) `netProfit30dUsd > estimatedGasTotalUsd * 4`
3) `idealWeightedApyPct >= currentWeightedApyPct + 0.7`

Safeguards:
- If `idealWeightedApyPct < currentWeightedApyPct`: never execute.
- If any `toWithdraw` position has IL > 6%: delay exit (requires a measurable IL signal; until available, treat as a TODO and gate this check behind a feature flag).
- Max 2 rebalances/hour (anti-clustering).

### Mapping to mathematical framework (utility model)

We can interpret the practical logic in terms of a general utility:
$$U = \sum_i w_i \cdot (R_i - \lambda S_i - F_i^{proto})$$

Where:
- $R_i$ corresponds to pool APR/apy estimates (here `apy30dAvgPct`).
- $S_i$ corresponds to risk (here approximated via `il_risk_factor`, plus optional volatility inputs later).
- $F_i^{proto}$ and $C^{tx}$ correspond to protocol/tx costs (here approximated using `expectedGasUsd` multipliers).

Rebalance rule:
$$\Delta U^{net} = (U_{target} - U_{current}) \cdot \frac{T}{1\,year} - C_{total}^{tx} \ge \theta$$

Implementation note:
- For M2, we implement the practical rule as a deterministic proxy for the above (equivalent intent, fewer variables).
- We can add an alternative “utility strategy” later that directly computes $U$ using $\lambda$.

---

## 🧪 Decision test matrix (add to CI)

Unit tests (pure functions where possible):
- Filter logic: allowed tokens, min APY tolerance (0.95), TVL >= 1m, age >= 14.
- IL risk factor mapping from token pair categories.
- Effective APY calculation.
- Greedy portfolio builder respects `maxPositions`, `maxAllocPerPosUsd`, and skips < 3000.
- Cost estimate formula matches spec (1.6/1.8 multipliers).
- Weighted APY and profit30d/netProfit30d calculations.
- Execution condition thresholds (daily cap, 4x gas, +0.7% APY).

Integration-ish tests (DB + mocks):
- Seed pools + preferences -> deterministic decision output stable snapshot.
- Verify calls made to `XcmBuilderService` and `AssetHubService.dispatchInvestmentWithXcm()` with expected params when `shouldExecute=true`.
- Verify no calls are made when thresholds are not met.

---

## Test strategy

### Unit tests (CI-safe)
- Pool APR calculation
- Pool filtering queries
- Decision scoring + allocation
- Web3 service call parameters (mock ethers provider/contracts)

### Integration tests (CI-safe via mocks)
- PoolScanner: mocked GraphQL response -> DB upsert -> query pools
- InvestmentDecision: seeded DB -> decision result -> verifies calls into AssetHubService (mock)

### Optional live smoke tests (env-gated)
- PAPI connect (when `ASSET_HUB_PAPI_ENDPOINT` set)
- EVM RPC connect (when RPC URLs present)

---

## Suggested M2 work plan (smallest convincing slice)

1) Refactor PoolScanner to Cron + add tests
2) Implement InvestmentDecisionService + at least 1 scoring strategy
3) Wire a cron worker that runs decisions periodically (feature-flagged)
4) Add tests across the decision pipeline
5) Add a minimal endpoint to fetch latest decision / run dry-run decision

---

## Environment variables (consolidated)

### Aggregator
- `ALGEBRA_SUBGRAPH_URL`

### EVM (ethers)
- `ASSETHUB_RPC_URL`
- `MOONBEAM_RPC_URL`
- `ASSETHUB_VAULT_ADDRESS`
- `XCM_PROXY_ADDRESS`
- `RELAYER_PRIVATE_KEY`

### PAPI (Substrate)
- `ASSET_HUB_PAPI_ENDPOINT` (wss)

### XCM
- `XCM_TEST_MODE=true|false`
- `MOONBEAM_PARA_ID`
- `ASSET_HUB_PARA_ID`
