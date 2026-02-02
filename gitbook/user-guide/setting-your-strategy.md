---
icon: sliders
---

# Setting Your Strategy

LiquiDOT gives you full control over how your capital is deployed. This guide explains each setting and how it affects your liquidity provision strategy.

## Strategy Configuration Overview

When you configure your strategy, you're telling LiquiDOT:
- **What tokens** you want exposure to
- **How much risk** you're comfortable with
- **When to exit** positions automatically
- **How much** to allocate per position

## Core Settings

### 1. Risk Profile

Choose your overall risk tolerance:

| Profile | Description | Typical APY Range | IL Risk |
|---------|-------------|-------------------|---------|
| **Conservative** | Prioritizes stable-stable pairs | 5-15% | Very Low |
| **Moderate** | Balanced mix of stable and volatile | 10-30% | Medium |
| **Aggressive** | Higher-yield volatile pairs | 20-80%+ | Higher |

{% hint style="info" %}
Your risk profile affects which pools LiquiDOT considers for your portfolio. Conservative profiles focus on stablecoin pairs, while aggressive profiles include more volatile token pairs.
{% endhint %}

### 2. Minimum APY Target

Set the minimum annual percentage yield you're willing to accept.

**How it works:**
- LiquiDOT only considers pools with yields at or above your target
- This is based on the pool's **30-day average APY**, not current spikes
- Pools below this threshold are automatically filtered out

**Recommended settings:**
- Conservative: 5-10%
- Moderate: 10-20%
- Aggressive: 20%+

{% hint style="warning" %}
Setting your minimum APY too high may limit available pools, especially in quiet market conditions.
{% endhint %}

### 3. Token Preferences

Select which tokens you want in your liquidity positions.

**Why this matters:**
- You maintain control over your exposure
- Both tokens in a pool pair must be in your allowed list
- Prevents unwanted exposure to tokens you don't trust

**Examples:**
- **Stables only:** USDC, USDT, DAI
- **Blue chips + stables:** WETH, WBTC, USDC, USDT
- **Broader exposure:** DOT, GLMR, WETH, WBTC, USDC, USDT

### 4. Maximum Positions

Limit how many separate LP positions LiquiDOT can create.

| Setting | Diversification | Management Overhead |
|---------|-----------------|---------------------|
| 1-2 positions | Low | Simple |
| 3-5 positions | Medium | Moderate |
| 5-10 positions | High | Complex |

**Trade-offs:**
- More positions = better diversification but higher gas costs
- Fewer positions = simpler but concentrated risk

### 5. Maximum Allocation Per Position

Set the maximum USD value for any single position.

**Why set a limit:**
- Prevents over-concentration in one pool
- Distributes risk across multiple positions
- Ensures enough capital for diversification

**Example:**
- Total capital: $50,000
- Max per position: $15,000
- Result: At least 4 positions if fully deployed

### 6. Minimum Position Size

The smallest position LiquiDOT will create.

**Testnet Default:** 30 DOT (~$45 USD)

{% hint style="info" %}
**Deposits accept DOT only** (native asset on Asset Hub). The testnet minimum is set low for experimentation; production values will be higher.
{% endhint %}

**Why this matters:**
- Very small positions have unfavorable gas cost ratios
- Ensures rebalancing remains profitable
- Prevents dust positions

## Risk Management Settings

### Stop-Loss Percentage

Automatically exit when the position loses value.

**How it works:**
- When price drops below your lower bound, position is liquidated
- Protects capital from severe impermanent loss
- Converts LP back to your base asset

**Recommended:**
- Conservative: -3% to -5%
- Moderate: -5% to -10%
- Aggressive: -10% to -20%

### Take-Profit Percentage

Lock in gains when the position reaches your target.

**How it works:**
- When price rises above your upper bound, position is closed
- Realizes profits automatically
- Capital returns to vault for redeployment

**Recommended:**
- Conservative: +5% to +10%
- Moderate: +10% to +20%
- Aggressive: +20% to +50%

### Asymmetric Ranges

LiquiDOT supports **different** stop-loss and take-profit levels.

**Example: Bullish on ETH**
- Stop-loss: -5% (tight protection)
- Take-profit: +25% (wide upside)

This lets you express market views while providing liquidity.

## Advanced Settings

### Pool Age Requirement

Only consider pools that have existed for a minimum time.

**Default:** 14 days

**Why this matters:**
- Newer pools may have inflated APYs from incentives
- Older pools have more reliable historical data
- Reduces risk of rug pulls or unstable pools

### Minimum TVL (Total Value Locked)

Only consider pools with sufficient liquidity.

**Default:** $1,000,000 USD

**Why this matters:**
- Higher TVL = deeper liquidity = lower slippage
- Large TVL pools are more stable
- Reduces risk of liquidity crises

### Daily Rebalance Limit

Maximum number of rebalances per day.

**Default:** 8 rebalances/day

**Why this matters:**
- Prevents excessive gas spending
- Avoids over-trading in volatile markets
- Ensures changes are meaningful

## Example Strategies

### The Conservative Saver

```
Risk Profile: Conservative
Min APY: 8%
Tokens: USDC, USDT, DAI
Max Positions: 3
Max Per Position: $20,000
Stop-Loss: -3%
Take-Profit: +10%
```

**Result:** Focuses on stable-stable pools with predictable, modest returns.

### The Balanced Investor

```
Risk Profile: Moderate
Min APY: 15%
Tokens: WETH, WBTC, USDC, USDT
Max Positions: 5
Max Per Position: $15,000
Stop-Loss: -7%
Take-Profit: +20%
```

**Result:** Mix of stable and bluechip volatile pairs for balanced risk/reward.

### The Yield Hunter

```
Risk Profile: Aggressive
Min APY: 25%
Tokens: DOT, GLMR, WETH, WBTC, USDC, USDT
Max Positions: 8
Max Per Position: $10,000
Stop-Loss: -15%
Take-Profit: +40%
```

**Result:** Broader token exposure, higher yields, accepts higher volatility.

## Tips for Setting Your Strategy

1. **Start conservative** - Begin with lower risk and adjust as you learn
2. **Match your timeline** - Short-term needs = lower risk, long-term = can accept more volatility
3. **Consider gas costs** - More positions and frequent rebalancing increases costs
4. **Review periodically** - Market conditions change, so should your strategy
5. **Don't chase APY** - Extremely high APYs often come with extreme risks

## Next Steps

- [How Pools Are Evaluated](pool-evaluation.md) - Understand LiquiDOT's pool selection
- [Rebalancing Explained](rebalancing-explained.md) - Learn when and why positions change
- [Risk Management](risk-management.md) - Deep dive into protecting your capital
