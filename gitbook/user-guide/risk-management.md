---
icon: shield-halved
---

# Risk Management

LiquiDOT provides multiple layers of protection to safeguard your capital. This guide explains how each mechanism works.

## Overview of Protections

```
┌────────────────────────────────────────────────────────────┐
│                    YOUR CAPITAL                            │
├────────────────────────────────────────────────────────────┤
│  Layer 1: STOP-LOSS          │  Automatic price protection │
│  Layer 2: TAKE-PROFIT        │  Lock in gains              │
│  Layer 3: IL SAFEGUARDS      │  Avoid locking in losses    │
│  Layer 4: DIVERSIFICATION    │  Spread risk across pools   │
│  Layer 5: POOL FILTERS       │  Only quality pools         │
│  Layer 6: CUSTODY SECURITY   │  Funds on Asset Hub         │
└────────────────────────────────────────────────────────────┘
```

## Layer 1: Stop-Loss Protection

### What It Does

Automatically exits your position when price drops below your defined threshold, preventing further losses.

### How It Works

1. **You set** a stop-loss percentage (e.g., -5%)
2. LiquiDOT monitors pool prices **24/7**
3. When price breach is detected → immediate liquidation
4. Assets converted back to your base token
5. Proceeds returned to Asset Hub

### Example

```
Entry price: $100
Stop-loss: -5% ($95)

Price movement:
  Day 1: $102 → No action
  Day 2: $98  → No action
  Day 3: $94  → STOP-LOSS TRIGGERED

Result: Position liquidated at ~$94
Loss limited to ~6% instead of potentially more
```

### Stop-Loss Settings Guide

| Risk Tolerance | Recommended Stop-Loss | Trade-off |
|----------------|----------------------|-----------|
| Very Conservative | -2% to -3% | Tight protection, may exit on normal volatility |
| Conservative | -3% to -5% | Good protection, allows some breathing room |
| Moderate | -5% to -10% | Balanced approach for typical positions |
| Aggressive | -10% to -20% | Wide range, only exits on major moves |

{% hint style="warning" %}
Very tight stop-losses (under 3%) may trigger on normal market volatility, causing frequent exits and gas costs.
{% endhint %}

## Layer 2: Take-Profit Automation

### What It Does

Automatically closes your position when price rises to your target, locking in profits.

### How It Works

1. **You set** a take-profit percentage (e.g., +15%)
2. LiquiDOT monitors pool prices continuously
3. When target reached → position closed
4. Profits realized in your base token
5. Capital available for redeployment

### Example

```
Entry price: $100
Take-profit: +15% ($115)

Price movement:
  Day 1: $102 → No action
  Day 5: $108 → No action  
  Day 10: $116 → TAKE-PROFIT TRIGGERED

Result: Position closed at ~$116
Profit of ~16% captured automatically
```

### Take-Profit Settings Guide

| Strategy | Recommended Take-Profit | Best For |
|----------|------------------------|----------|
| Quick gains | +5% to +10% | Frequent profit-taking, high turnover |
| Balanced | +10% to +20% | Standard approach for most users |
| Trend riding | +20% to +40% | Capturing larger moves, fewer trades |
| Moonshot | +40%+ | High conviction positions |

## Layer 3: Asymmetric Ranges

### What Makes This Special

Unlike basic LP tools that use symmetric ranges (e.g., ±10%), LiquiDOT supports **different** stop-loss and take-profit levels.

### Why This Matters

You can express market views while providing liquidity:

**Bullish setup:**
```
Stop-loss: -3% (tight downside protection)
Take-profit: +25% (wide upside capture)
```

**Bearish/defensive setup:**
```
Stop-loss: -15% (wider tolerance for dips)
Take-profit: +5% (quick profit taking)
```

**Neutral/range-bound:**
```
Stop-loss: -8%
Take-profit: +8%
```

## Layer 4: Impermanent Loss Safeguards

### Understanding IL

Impermanent Loss (IL) occurs when the price ratio between your two LP tokens changes. The larger the change, the larger the potential loss compared to simply holding.

### LiquiDOT's IL Protections

#### 1. Risk-Adjusted Scoring

Pools are scored with IL risk factored in:

| Pool Type | IL Factor Applied |
|-----------|-------------------|
| Stable-Stable | 0% (no IL risk) |
| Bluechip/Stable | 8% deduction |
| Midcap/Stable | 18% deduction |
| Other pairs | 30% deduction |

This means high-risk pools need much higher APY to be selected.

#### 2. IL Exit Safeguard

**Threshold:** Won't exit positions with >6% IL

**Why:** If a position has significant IL, exiting might lock in that loss permanently. LiquiDOT avoids panic-selling into temporary price movements.

```
Scenario:
- Your ETH/USDC position has 8% IL
- A "better" opportunity appears
- Normal logic would say: exit and reallocate

LiquiDOT's response:
❌ Rebalance blocked - IL safeguard triggered
Reason: Exiting now would realize the IL loss

Wait for price to recover or IL to reduce
```

## Layer 5: Diversification Controls

### Position Limits

Spread risk across multiple pools:

| Setting | Effect |
|---------|--------|
| Max positions: 5 | No single pool dominates |
| Max per position: $10,000 | Caps exposure per pool |
| Min position size: $3,000 | Ensures meaningful positions |

### Example Diversification

```
Total capital: $50,000
Max positions: 5
Max per position: $12,000

Resulting allocation:
Pool 1: $12,000 (24%)
Pool 2: $12,000 (24%)
Pool 3: $12,000 (24%)
Pool 4: $10,000 (20%)
Pool 5: $4,000 (8%)

✓ No single pool > 25%
✓ Loss in one pool limited to ~24% of portfolio
```

## Layer 6: Pool Quality Filters

### Automatic Filtering

LiquiDOT only considers pools that meet quality thresholds:

| Filter | Default | Purpose |
|--------|---------|---------|
| **Min TVL** | $1,000,000 | Ensures liquidity depth |
| **Min Age** | 14 days | Filters unproven pools |
| **Min APY** | Your setting | Meets return requirements |
| **Token allowlist** | Your tokens | No unwanted exposure |

### Why Pool Age Matters

New pools often show inflated APYs due to:
- Launch incentives (temporary)
- Low liquidity (unsustainable fees)
- Manipulation (fake volume)

The 14-day minimum helps filter these out.

## Layer 7: Custody Security

### Where Your Funds Live

Your funds are held in the **Asset Hub Vault** on Polkadot's Asset Hub parachain:

- **Not on DEX contracts** (only when actively providing liquidity)
- **Not in hot wallets** (contract-based custody)
- **Secured by Polkadot** (shared security model)

### The Security Model

```
┌─────────────────────────────────────────┐
│           ASSET HUB VAULT               │
│  • Your funds stay here when idle       │
│  • Battle-tested vault pattern          │
│  • Only operators can initiate moves    │
│  • You can withdraw anytime             │
└─────────────────────────────────────────┘
              ↓ XCM transfer only
              ↓ when investing
┌─────────────────────────────────────────┐
│           XCM PROXY (Moonbeam)          │
│  • Execution layer only                 │
│  • Funds active in LP positions         │
│  • Proceeds always return to Asset Hub  │
└─────────────────────────────────────────┘
```

### Emergency Controls

In extreme situations:
- **Emergency liquidation** can be triggered by authorized roles
- **Pause functionality** stops all new operations
- **Direct withdrawals** always available from Asset Hub

## Risk Monitoring Dashboard

From your dashboard, monitor:

### Position Health

- Current price vs. entry price
- Distance to stop-loss
- Distance to take-profit
- Current IL percentage

### Portfolio Metrics

- Total value at risk
- Diversification score
- Weighted average IL
- Projected returns

### Alerts (coming soon)

- Price approaching stop-loss
- High IL warning
- Pool TVL dropping
- APY declining significantly

## Best Practices

### 1. Don't Over-Leverage Risk

**Bad:** All capital in one high-APY volatile pool
**Good:** Diversified across multiple pools and risk levels

### 2. Set Appropriate Ranges

**Bad:** Stop-loss at -2% on a volatile pair (constant exits)
**Good:** Match stop-loss to expected volatility of the pair

### 3. Review Regularly

Even with automation, periodically review:
- Are your risk settings still appropriate?
- Has your risk tolerance changed?
- Are market conditions different?

### 4. Understand Before Committing

Start with smaller amounts until you understand:
- How rebalancing affects your positions
- How stop-loss triggers work in practice
- What gas costs look like for your strategy

## Summary: Your Safety Net

| Risk | Protection |
|------|------------|
| Price crashes | Stop-loss liquidation |
| Miss taking profits | Take-profit automation |
| Locking in IL | IL exit safeguard |
| Pool failure | Diversification + TVL filters |
| Rug pulls | Pool age filter + token allowlist |
| Smart contract risk | Audited contracts, Asset Hub custody |

{% hint style="success" %}
LiquiDOT's multi-layered approach means no single point of failure can devastate your portfolio.
{% endhint %}

## Next Steps

- [Setting Your Strategy](setting-your-strategy.md) - Configure your risk parameters
- [FAQ](faq.md) - Common questions about risk
- [How It Works](../getting-started/how-it-works.md) - Full system overview
