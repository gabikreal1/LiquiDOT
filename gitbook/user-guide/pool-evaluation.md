---
icon: chart-line
---

# How Pools Are Evaluated

LiquiDOT uses a sophisticated multi-factor analysis to select the best liquidity pools for your capital. This page explains exactly how pools are scored and ranked.

## The Evaluation Process

When LiquiDOT evaluates pools, it follows a three-stage process:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  1. FILTERING   │ →  │   2. SCORING    │ →  │   3. RANKING    │
│                 │    │                 │    │                 │
│ Remove pools    │    │ Calculate risk- │    │ Sort by best    │
│ that don't meet │    │ adjusted returns│    │ effective APY   │
│ your criteria   │    │ for each pool   │    │ and allocate    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Stage 1: Filtering

Before any analysis, LiquiDOT filters out pools that don't meet your requirements.

### Filter Criteria

| Filter | Your Setting | What It Does |
|--------|--------------|--------------|
| **Token Allowlist** | Your preferred tokens | Both tokens in the pair must be allowed |
| **Minimum APY** | Your APY target | Pools below 95% of your target are excluded |
| **Minimum TVL** | Default: $1M | Ensures sufficient liquidity depth |
| **Pool Age** | Default: 14 days | Filters out brand new, unproven pools |
| **DEX Allowlist** | Optional | Restrict to specific DEXs if set |

**Example filtering:**

You set:
- Allowed tokens: USDC, USDT, WETH
- Min APY: 10%

Pool analysis:
```
✅ USDC/WETH (15% APY) → Passes all filters
✅ USDT/USDC (12% APY) → Passes all filters
❌ USDC/SHIB (45% APY) → Rejected: SHIB not in allowlist
❌ USDC/WETH (8% APY)  → Rejected: Below APY threshold
❌ New USDC/WETH pool  → Rejected: Less than 14 days old
```

## Stage 2: Risk-Adjusted Scoring

Pools that pass filtering are then scored using **Effective APY** - which accounts for impermanent loss risk.

### Understanding Impermanent Loss (IL)

When you provide liquidity, price changes between the two tokens can reduce your value compared to simply holding them. This is called impermanent loss.

**LiquiDOT's IL Risk Categories:**

| Pool Type | IL Risk Factor | Description |
|-----------|----------------|-------------|
| **Stable-Stable** | 0% | USDC/USDT, DAI/USDC - prices stay ~equal |
| **Bluechip-Volatile** | 8% | ETH/USDC, BTC/USDT - established tokens |
| **Midcap-Volatile** | 18% | GLMR/USDC, DOT/USDT - more volatile |
| **Other Pairs** | 30% | Less established token combinations |

### The Effective APY Formula

```
Effective APY = Raw APY × (1 - IL Risk Factor)
```

**Example calculations:**

| Pool | Raw 30d APY | IL Risk | Effective APY |
|------|-------------|---------|---------------|
| USDC/USDT | 8% | 0% | **8.0%** |
| ETH/USDC | 25% | 8% | **23.0%** |
| DOT/USDC | 40% | 18% | **32.8%** |
| MEME/USDC | 120% | 30% | **84.0%** |

{% hint style="info" %}
Even though MEME/USDC has the highest raw APY, after risk adjustment it may not be the best choice for conservative investors.
{% endhint %}

### Token Classification

LiquiDOT automatically classifies tokens:

**Stablecoins (0% IL when paired):**
- USDC, USDT, DAI, FRAX

**Bluechip tokens (8% IL factor):**
- WETH, ETH, WBTC, BTC

**Other tokens:**
- Assessed as midcap (18%) or other (30%) based on characteristics

## Stage 3: Portfolio Building

After scoring, LiquiDOT builds your ideal portfolio by allocating capital to the highest-scoring pools.

### The Allocation Algorithm

1. **Sort pools** by effective APY (highest first)
2. **Allocate sequentially** up to your max-per-position limit
3. **Stop when**:
   - You hit your max positions limit, OR
   - All capital is allocated
4. **Handle remainder**: If capital remains, add to highest-TVL stable pool

### Example Portfolio Build

**Your settings:**
- Capital: $50,000
- Max positions: 4
- Max per position: $15,000

**Available pools (after filtering & scoring):**

| Pool | Effective APY | TVL |
|------|---------------|-----|
| ETH/USDC | 23.0% | $5M |
| DOT/USDC | 22.5% | $2M |
| WBTC/USDC | 21.0% | $8M |
| USDC/USDT | 8.0% | $20M |

**Resulting allocation:**

| Position | Pool | Amount | Why |
|----------|------|--------|-----|
| 1 | ETH/USDC | $15,000 | Highest effective APY |
| 2 | DOT/USDC | $15,000 | Second highest |
| 3 | WBTC/USDC | $15,000 | Third highest |
| 4 | USDC/USDT | $5,000 | Remainder to stable pool |

## Data Sources

LiquiDOT evaluates pools using multiple data sources for accuracy:

### Pool Metrics

| Metric | Source | Update Frequency |
|--------|--------|------------------|
| **APY (30-day avg)** | DEX subgraphs | Every 5 minutes |
| **TVL** | On-chain + price feeds | Real-time |
| **Volume** | DEX event logs | Rolling 24h |
| **Pool age** | Contract creation | Static |

### Price Feeds

- **Primary:** CoinGecko API
- **Fallback:** CoinMarketCap
- **On-chain:** DEX oracle prices

### Historical Performance

LiquiDOT stores historical data for trend analysis:
- 7-day rolling metrics
- 30-day rolling metrics
- Pool volatility indicators

## Why 30-Day Average APY?

We use 30-day averages instead of current APY because:

1. **Reduces noise** - Daily APY can swing wildly
2. **Avoids manipulation** - Harder to game with short-term volume
3. **More predictable** - Better represents sustainable returns
4. **Filters incentives** - Short-term farming rewards fade into averages

{% hint style="warning" %}
Be cautious of pools showing extremely high current APY but low 30-day average - this often indicates unsustainable temporary spikes.
{% endhint %}

## Continuous Monitoring

Pool evaluation isn't a one-time event. LiquiDOT continuously:

1. **Re-evaluates** pools every rebalance cycle
2. **Detects** declining APY or TVL
3. **Identifies** better opportunities
4. **Adjusts** your portfolio when beneficial

See [Rebalancing Explained](rebalancing-explained.md) for how this leads to position changes.

## Next Steps

- [Rebalancing Explained](rebalancing-explained.md) - When and why positions change
- [Risk Management](risk-management.md) - How LiquiDOT protects your capital
- [Setting Your Strategy](setting-your-strategy.md) - Configure your preferences
