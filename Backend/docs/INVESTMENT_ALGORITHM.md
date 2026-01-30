# Investment Decision Algorithm

This document explains the mathematical model and algorithm used by LiquiDOT to make automated investment decisions. The algorithm is based on the specification in `defi_investment_bot_spec.md`.

## Overview

The LiquiDOT investment engine automatically:
1. Scans DEX pools for investment opportunities
2. Calculates risk-adjusted returns
3. Builds an optimal portfolio allocation
4. Decides when to rebalance based on utility theory
5. Executes trades via XCM to Moonbeam DEXes

The system runs every 4 hours and can be triggered manually for users with auto-invest enabled.

---

## Core Concepts

### What is Impermanent Loss (IL)?

When you provide liquidity to a DEX pool, you deposit two tokens. If the price ratio between them changes, you suffer "impermanent loss" — you would have been better off just holding the tokens.

The more volatile a token pair, the higher the potential IL:
- **Stable/Stable pools** (USDC/USDT): Nearly zero IL
- **Stable/Blue-chip** (USDC/ETH): Moderate IL risk
- **Volatile pairs** (SHIB/ETH): High IL risk

### The Utility Function

We don't just maximize APY — we use a **utility function** that balances returns against risk:

$$U = \sum_{i=1}^{n} w_i \times (R_i - \lambda \times S_i - F_i)$$

Where:
- $U$ = Total portfolio utility
- $w_i$ = Weight of position $i$ in portfolio
- $R_i$ = Expected return (APY) of pool $i$
- $\lambda$ = User's risk aversion parameter (0 = risk-seeking, 1 = very risk-averse)
- $S_i$ = Risk score (IL risk factor) of pool $i$
- $F_i$ = Fees and slippage

This means a 50% APY pool with high risk might have lower utility than a 20% APY pool with low risk.

---

## Token Risk Classification

Every token is classified into a risk tier:

| Tier | IL Risk Factor | Example Tokens |
|------|----------------|----------------|
| **STABLE** | 0% | USDC, USDT, DAI, FRAX |
| **BLUECHIP** | 8% | ETH, WETH, WBTC, DOT, GLMR |
| **MIDCAP** | 18% | AAVE, UNI, LINK, CRV, STELLA |
| **HIGH_RISK** | 30% | All unlisted tokens |

### Pool IL Factor Calculation

For a pool with Token A and Token B:

```
Pool IL Factor = max(IL_Factor_A, IL_Factor_B)
```

Examples:
- USDC/USDT → max(0%, 0%) = **0%**
- USDC/ETH → max(0%, 8%) = **8%**
- ETH/AAVE → max(8%, 18%) = **18%**
- UNI/SHIB → max(18%, 30%) = **30%**

---

## The Algorithm (Step by Step)

### Step 1: Collect Candidate Pools

Filter pools based on user preferences:

```typescript
const candidates = pools.filter(pool => 
  pool.tvl >= config.minTvlUsd &&           // e.g., $1M minimum
  pool.ageInDays >= config.minPoolAgeDays && // e.g., 14 days
  pool.apy >= config.minApy &&               // e.g., 8%
  pool.isActive === true &&
  hasAllowedTokens(pool, config.allowedTokens)
);
```

### Step 2: Calculate Real APY

Adjust the advertised APY for IL risk:

```
Real APY = Advertised APY - (IL_Risk_Factor × 100)
```

Example:
- Pool advertises 25% APY
- Pool is ETH/USDC (IL factor = 8%)
- Real APY = 25% - 8% = **17%**

### Step 3: Calculate Effective APY (Risk-Adjusted)

Apply the user's risk aversion:

```
Effective APY = Real APY - (λ × Risk Score × 100)
```

Where:
- λ (lambda) is user's risk aversion (default: 0.5)
- Risk Score = IL Risk Factor

Example (with λ = 0.5):
- Real APY = 17%
- Risk Score = 0.08
- Effective APY = 17% - (0.5 × 0.08 × 100) = **13%**

### Step 4: Build Ideal Portfolio

1. Sort pools by effective APY (highest first)
2. Allocate to top pools, respecting constraints:
   - Maximum allocation per position
   - Maximum number of positions
   - Minimum position size

```typescript
function buildIdealPortfolio(rankedPools, totalCapital, config) {
  const portfolio = [];
  let remainingCapital = totalCapital;
  
  for (const pool of rankedPools) {
    if (portfolio.length >= config.maxPositions) break;
    if (remainingCapital < config.minPositionSizeUsd) break;
    
    const allocation = Math.min(
      config.maxAllocPerPositionUsd,
      remainingCapital,
      remainingCapital / (config.maxPositions - portfolio.length)
    );
    
    portfolio.push({ pool, allocation });
    remainingCapital -= allocation;
  }
  
  return portfolio;
}
```

### Step 5: Compare with Current Portfolio

Identify differences between current and ideal:

```
toWithdraw = currentPositions not in idealPortfolio
toAdd = idealAllocations not in currentPositions
```

We also identify positions to **adjust** (same pool but different allocation).

### Step 6: Estimate Rebalancing Costs

```
Gas Cost = (withdrawals × 1.8 + additions × 1.6) × expected_gas_per_tx
```

Coefficients:
- **1.8** for withdrawals (remove liquidity + swap if needed)
- **1.6** for additions (swap + add liquidity)

### Step 7: Calculate Projected Profit

```
30-Day Profit = (Ideal APY - Current APY) × Capital × (30/365)
Net Profit = 30-Day Profit - Gas Costs
```

---

## Rebalance Conditions

A rebalance is executed only if **ALL** conditions are met:

### Condition 1: Rate Limit
```
rebalancesToday < dailyRebalanceLimit
```
Default: max 8 rebalances per day

### Condition 2: Profitability
```
Net Profit (30 days) > 4 × Gas Costs
```
The expected profit must cover gas at least 4x over 30 days.

### Condition 3: APY Improvement
```
Ideal APY - Current APY ≥ 0.7%
```
Minimum 0.7% APY improvement required.

### Condition 4: Utility Improvement (Optional)
```
Net Utility Gain ≥ θ (theta)
```
Where θ is user's minimum benefit threshold (default: 0).

### Condition 5: IL Loss Check
If exiting a position at a loss:
```
IL Loss < maxIlLossPercent (default 6%)
```
If loss exceeds threshold, exit is postponed unless another condition forces it.

---

## Position Management (Stop-Loss)

The Stop-Loss Worker runs every 30 seconds and monitors:

### Out-of-Range Detection
```
if (currentTick < position.lowerTick || currentTick > position.upperTick) {
  position.status = 'OUT_OF_RANGE';
  // Trigger liquidation
}
```

### Take-Profit at Upper Bound
When price reaches the upper bound of the LP range:
```
if (currentTick >= position.upperTick) {
  // Liquidate and return funds
}
```

### Concurrency Control
Only one liquidation per position at a time:
```sql
UPDATE positions 
SET is_liquidating = true 
WHERE id = $1 AND is_liquidating = false
RETURNING *;
```

---

## Configuration Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `minApy` | 8% | Minimum acceptable APY |
| `maxPositions` | 6 | Maximum concurrent positions |
| `maxAllocPerPositionUsd` | $25,000 | Max per position |
| `dailyRebalanceLimit` | 8 | Max rebalances/day |
| `expectedGasUsd` | $1.00 | Expected gas per transaction |
| `lambdaRiskAversion` | 0.5 | Risk aversion (0-1) |
| `thetaMinBenefit` | 0 | Min utility improvement |
| `planningHorizonDays` | 7 | Planning horizon |
| `minTvlUsd` | $1,000,000 | Min pool TVL |
| `minPoolAgeDays` | 14 | Min pool age |
| `maxIlLossPercent` | 6% | Max IL before exit pause |
| `minPositionSizeUsd` | $3,000 | Min position size |

---

## Worked Example

### Scenario
- User has $50,000 to invest
- Risk aversion (λ) = 0.5
- Max positions = 3
- Max per position = $20,000

### Pool Candidates

| Pool | TVL | Advertised APY | Tokens | IL Factor |
|------|-----|----------------|--------|-----------|
| Pool A | $5M | 35% | ETH/SHIB | 30% |
| Pool B | $10M | 20% | USDC/ETH | 8% |
| Pool C | $3M | 15% | USDC/USDT | 0% |

### Calculations

**Pool A:**
- Real APY = 35% - 30% = 5%
- Effective APY = 5% - (0.5 × 0.30 × 100) = -10% ❌ (excluded, negative)

**Pool B:**
- Real APY = 20% - 8% = 12%
- Effective APY = 12% - (0.5 × 0.08 × 100) = 8% ✓

**Pool C:**
- Real APY = 15% - 0% = 15%
- Effective APY = 15% - (0.5 × 0 × 100) = 15% ✓

### Ideal Portfolio

Sorted by effective APY:
1. Pool C: 15% effective APY → Allocate $20,000
2. Pool B: 8% effective APY → Allocate $20,000
3. (Remaining $10,000 below $3,000 min? No, allocate remaining)

Final portfolio:
- Pool C: $20,000 (40%)
- Pool B: $20,000 (40%)
- Remaining: $10,000 (held or split)

### Result
Despite Pool A having the highest advertised APY (35%), it's excluded because its risk-adjusted return is negative. The stable pair (Pool C) actually provides the best risk-adjusted returns.

---

## Safety Features

### Rate Limiting
- Max 8 rebalances per day per user
- Max 2 rebalances per hour (burst protection)

### Position Size Guards
- Minimum $3,000 per position (below this, gas exceeds benefit)
- Maximum per-position allocation enforced

### TVL and Age Requirements
- Pools must have $1M+ TVL (reduces rug-pull risk)
- Pools must be 14+ days old (proven track record)

### Error Handling
- Failed transactions don't corrupt state
- Positions marked FAILED can be retried
- All operations are idempotent where possible

---

## Monitoring

Track these metrics:
- Portfolio weighted APY over time
- Rebalance frequency and costs
- IL losses vs. fees earned
- Position success/failure rates

The `/health/detailed` endpoint exposes system metrics for alerting.
