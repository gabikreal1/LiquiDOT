---
icon: sliders
---

# Risk Parameters

Fine-tune your automated liquidity positions with customizable risk management parameters.

## Overview

LiquiDOT gives you granular control over risk management through user-defined parameters that govern when positions are entered, managed, and exited.

## Core Risk Parameters

### 1. Stop-Loss Threshold

**What it is:** Automatic exit when price drops below threshold

**Default:** -5% (exit if price drops 5% from entry)

**Range:** -1% to -20%

**Example:**
```
Entry Price: $100
Stop-Loss: -5%
Trigger Price: $95
```

**When to adjust:**
* **Tighter (-2%):** Low risk tolerance, preserve capital
* **Wider (-10%):** Volatile assets, more room for fluctuation

### 2. Take-Profit Threshold

**What it is:** Automatic exit when price rises above threshold

**Default:** +10%

**Range:** +2% to +50%

**Example:**
```
Entry Price: $100
Take-Profit: +10%
Trigger Price: $110
```

**When to adjust:**
* **Tighter (+5%):** Quick profit-taking, conservative
* **Wider (+20%):** Bullish outlook, maximize upside

### 3. Minimum APY

**What it is:** Minimum acceptable annual percentage yield for pool selection

**Default:** 5%

**Range:** 0% to 50%

**Impact:**
* **Lower (3%):** More pool options, potentially lower returns
* **Higher (15%):** Fewer options, higher expected returns

### 4. Max Allocation Per Pool

**What it is:** Maximum percentage of portfolio to allocate to single pool

**Default:** 25%

**Range:** 5% to 50%

**Example:**
```
Total Portfolio: $10,000
Max Allocation: 25%
Max per Pool: $2,500
```

**Best Practice:** Never exceed 30% to maintain diversification

### 5. Risk Tolerance Level

**What it is:** Overall risk profile influencing all decisions

**Options:**
1. **Very Conservative** - Stable pools, tight ranges, frequent rebalancing
2. **Conservative** - Blue-chip pairs, moderate ranges
3. **Moderate** (Default) - Balanced approach
4. **Aggressive** - Higher volatility tolerance, wider ranges
5. **Very Aggressive** - Maximum risk/reward, experimental pools

## Advanced Configuration

### Asset Preferences

**Select preferred tokens:**
```
✅ DOT - Primary ecosystem token
✅ USDC - Stablecoin exposure
✅ WETH - Ethereum exposure
❌ Experimental tokens
```

**Impact:** Only pools containing selected assets will be considered

### Position Sizing Strategy

**Fixed Amount:**
```
Each position: 100 DOT (same size)
```

**Percentage-Based:**
```
Each position: 10% of portfolio (scales with balance)
```

**Kelly Criterion (Future):**
```
Size = (Edge × Bankroll) / Odds
```

## Risk Management Strategies

### Conservative Strategy

**Profile:**
* Risk Level: 1-2
* Min APY: 3-5%
* Stop-Loss: -2 to -3%
* Take-Profit: +3 to +5%
* Max Allocation: 15-20%
* Preferred Assets: Stablecoins, DOT, major assets

**Best for:**
* Capital preservation
* Predictable income
* Low volatility tolerance

---

### Moderate Strategy

**Profile:**
* Risk Level: 3
* Min APY: 5-10%
* Stop-Loss: -5%
* Take-Profit: +10%
* Max Allocation: 20-25%
* Preferred Assets: Mix of stable and growth

**Best for:**
* Balanced approach
* Steady growth
* Most users

---

### Aggressive Strategy

**Profile:**
* Risk Level: 4-5
* Min APY: 10-20%
* Stop-Loss: -10%
* Take-Profit: +20%
* Max Allocation: 30-40%
* Preferred Assets: Growth tokens, volatile pairs

**Best for:**
* Maximum returns
* High risk tolerance
* Experienced users

## Calculating Optimal Ranges

### Based on Historical Volatility

**30-day volatility:**
```
Asset: DOT
Average Daily Movement: ±3%
30-day Volatility: ±15%

Suggested Range:
Stop-Loss: -7.5% (half of 30-day)
Take-Profit: +15% (full 30-day)
```

### Based on Pool Characteristics

**Stablecoin Pairs (USDC/USDT):**
```
Stop-Loss: -0.5%
Take-Profit: +0.5%
(Very tight ranges, minimal price movement)
```

**Major Pairs (DOT/USDC):**
```
Stop-Loss: -5%
Take-Profit: +10%
(Moderate volatility)
```

**Exotic Pairs:**
```
Stop-Loss: -15%
Take-Profit: +30%
(High volatility, wider ranges needed)
```

## Risk Monitoring

### Dashboard Indicators

**Position Health:**
```
🟢 Healthy - Price within middle 60% of range
🟡 Warning - Price near boundary (within 20%)
🔴 Critical - At risk of liquidation (within 5%)
```

**Portfolio Risk Score:**
```
Low Risk: 0-30
Medium Risk: 31-60
High Risk: 61-100

Factors:
- Position concentration
- Volatility exposure
- Total leverage
- IL risk
```

## Dynamic Adjustments (Future)

**Auto-adjust based on conditions:**

**Market Volatility:**
```
IF volatility > 30%:
  Widen stop-loss by 50%
  Reduce position sizes
```

**Pool Performance:**
```
IF APY drops below min:
  Trigger rebalancing
  Find better opportunities
```

## Example Configurations

### Income-Focused

```json
{
  "riskLevel": 2,
  "minAPY": 5,
  "stopLoss": -3,
  "takeProfit": +8,
  "maxAllocation": 20,
  "assets": ["USDC", "USDT", "DOT"],
  "rebalanceFrequency": "weekly"
}
```

### Growth-Focused

```json
{
  "riskLevel": 4,
  "minAPY": 12,
  "stopLoss": -10,
  "takeProfit": +25,
  "maxAllocation": 30,
  "assets": ["DOT", "WETH", "WBTC"],
  "rebalanceFrequency": "daily"
}
```

## Best Practices

✅ **Review regularly** - Adjust as market conditions change  
✅ **Backtest** - Use historical data to validate ranges  
✅ **Diversify** - Don't rely on single strategy  
✅ **Start conservative** - Tighten ranges initially  
✅ **Document decisions** - Track what works  

❌ **Don't set and forget** - Markets change  
❌ **Don't chase yields** - High APY = high risk  
❌ **Don't ignore IL** - Factor in impermanent loss  
❌ **Don't over-leverage** - Leave buffer for volatility  

## Next Steps

* [Creating Positions](creating-position.md) - Apply your risk parameters
* [Strategy Selection](strategy-selection.md) - Choose overall approach
* [Monitoring Positions](monitoring-positions.md) - Track risk metrics
