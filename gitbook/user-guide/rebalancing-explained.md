---
icon: arrows-rotate
---

# Rebalancing Explained

LiquiDOT automatically rebalances your portfolio to optimize returns. This guide explains when, why, and how rebalancing happens.

## What is Rebalancing?

Rebalancing is the process of adjusting your liquidity positions to maintain optimal performance. This includes:

- **Exiting** underperforming pools
- **Entering** better-yielding opportunities  
- **Adjusting** position sizes

## When Does Rebalancing Happen?

LiquiDOT evaluates your portfolio periodically and rebalances when:

### 1. Better Opportunities Exist

```
Current Position: ETH/USDC @ 15% effective APY
New Opportunity:  DOT/USDC @ 24% effective APY
Improvement:      +9% APY (exceeds threshold)
Action:           Rebalance if profitable
```

### 2. Current Positions Deteriorate

- Pool APY drops significantly below your minimum
- TVL decreases below safe thresholds
- Volume dries up (affecting fee generation)

### 3. Stop-Loss Triggered

When price moves outside your defined range:
- Lower bound breach → Stop-loss liquidation
- Upper bound breach → Take-profit liquidation

### 4. Strategic Optimization

Even without major changes, periodic optimization ensures your capital is always in the best available pools.

## The Rebalancing Decision

Before executing any rebalance, LiquiDOT performs a **cost-benefit analysis**.

### Decision Criteria

| Factor | Threshold | Description |
|--------|-----------|-------------|
| **APY Improvement** | ≥0.7% | New portfolio must be meaningfully better |
| **Gas Coverage** | 4× | 30-day profit must cover gas costs 4 times over |
| **Daily Limit** | 8/day | Max rebalances per day (default) |
| **IL Safeguard** | <6% | Won't exit positions with >6% impermanent loss |

### The Math Behind It

**Step 1: Calculate improvement**
```
Current weighted APY: 12%
Ideal weighted APY:   15%
Improvement:          +3%
```

**Step 2: Estimate gas costs**
```
Positions to exit: 2 × $1.80 = $3.60
Positions to enter: 3 × $1.60 = $4.80
Total gas estimate: $8.40
```

**Step 3: Calculate 30-day profit**
```
Portfolio value: $50,000
APY improvement: 3%
Monthly profit:  $50,000 × 3% × (30/365) = $123.29
```

**Step 4: Check profitability**
```
Net profit: $123.29 - $8.40 = $114.89
Gas multiple: $114.89 / $8.40 = 13.7×
Threshold: 4×
Result: ✅ EXECUTE REBALANCE
```

{% hint style="success" %}
Rebalancing only happens when it's genuinely profitable after accounting for all costs.
{% endhint %}

## Types of Rebalancing Actions

### Exit (Withdraw)

**When:** A pool is no longer optimal for your strategy.

**Process:**
1. LP tokens burned on DEX
2. Tokens swapped back to base asset
3. Assets returned to Asset Hub via XCM
4. Balance credited to your account

**Triggers:**
- Better opportunity elsewhere
- Pool dropped below APY threshold
- Token no longer in your allowlist
- Manual exit requested

### Enter (Add)

**When:** A new pool matches your criteria and improves your portfolio.

**Process:**
1. Assets transferred from Asset Hub to Moonbeam
2. Tokens swapped to LP pair ratio
3. LP position minted with your range settings
4. Position tracked in your portfolio

### Adjust

**When:** A pool is still good, but allocation should change.

**Process:**
1. Calculate new ideal allocation
2. Either add liquidity or partial withdraw
3. Update position records

## Rebalancing Safeguards

LiquiDOT includes multiple safeguards to protect your capital:

### 1. Daily Rebalance Limit

**Default:** 8 rebalances per day

**Why:** Prevents excessive trading during volatile periods that could eat into profits through gas costs.

### 2. Minimum APY Improvement

**Default:** 0.7% improvement required

**Why:** Ensures changes are meaningful, not just noise. A 0.5% improvement might not justify the transaction costs.

### 3. Gas Cost Multiple

**Default:** Profit must cover gas 4× over

**Why:** Ensures rebalancing creates substantial value, not marginal gains eaten by costs.

### 4. Impermanent Loss Safeguard

**Threshold:** Won't exit if IL > 6%

**Why:** If a position has significant impermanent loss, exiting might lock in that loss. LiquiDOT avoids panic selling into temporary price movements.

### 5. Ideal Portfolio Check

If the ideal portfolio is **worse** than current holdings:
```
Current weighted APY: 18%
Ideal weighted APY:   16%
Result: ❌ NO REBALANCE (ideal is worse)
```

## Rebalancing Scenarios

### Scenario 1: Market Opportunity

**Situation:** A new pool launches with attractive yields.

```
Your Portfolio (before):
- ETH/USDC: $20,000 @ 14% APY
- USDC/USDT: $10,000 @ 7% APY
Weighted APY: 11.7%

New Opportunity Found:
- DOT/USDC: 22% APY (passes all filters)

Decision Analysis:
- Ideal: Exit USDC/USDT, Enter DOT/USDC
- New weighted APY: 16.7%
- Improvement: +5%
- Gas cost: ~$4
- 30-day profit: ~$205
- Gas multiple: 51×

Result: ✅ REBALANCE EXECUTED
```

### Scenario 2: Pool Decline

**Situation:** One of your pools experiences declining volume.

```
Your Position: GLMR/USDC
- Entry APY: 28%
- Current APY: 9% (30-day avg dropped)
- Your min APY: 15%

Analysis:
- Pool now below your threshold
- Better alternatives available
- No IL concerns (minimal price movement)

Result: ✅ EXIT POSITION
```

### Scenario 3: Minor Fluctuation

**Situation:** Small APY changes across pools.

```
Current weighted APY: 16.2%
Ideal weighted APY:   16.8%
Improvement: 0.6%
Threshold: 0.7%

Result: ❌ NO REBALANCE (improvement too small)
```

### Scenario 4: Volatile Period

**Situation:** Rapid market movements causing frequent opportunities.

```
Rebalances today: 7
New opportunity found: +2% APY improvement
Daily limit: 8

Result: ✅ REBALANCE (within limit)

Later...
Rebalances today: 8
Another opportunity: +1.5% APY improvement

Result: ❌ NO REBALANCE (daily limit reached)
```

## Viewing Rebalance History

From your dashboard, you can see:

- **Pending rebalances:** Upcoming planned actions
- **Recent rebalances:** What was changed and why
- **Reasons:** Why a rebalance was or wasn't executed
- **Cost breakdown:** Gas spent vs. value gained

## Customizing Rebalance Behavior

Adjust these settings to control rebalancing:

| Setting | Effect |
|---------|--------|
| **Daily limit** ↑ | More frequent optimization, higher gas costs |
| **Daily limit** ↓ | Less frequent changes, may miss opportunities |
| **APY threshold** ↑ | Only large improvements trigger rebalance |
| **APY threshold** ↓ | More sensitive to small improvements |
| **Gas multiple** ↑ | More conservative, only very profitable rebalances |
| **Gas multiple** ↓ | More aggressive optimization |

## Rebalancing vs. Stop-Loss

| Feature | Rebalancing | Stop-Loss |
|---------|-------------|-----------|
| **Trigger** | Better opportunity exists | Price breach your range |
| **Speed** | Periodic evaluation | Real-time monitoring |
| **Cost check** | Yes, must be profitable | No, safety first |
| **Goal** | Optimize returns | Protect capital |

{% hint style="info" %}
Stop-loss liquidations happen immediately when triggered, regardless of gas costs. Your capital protection takes priority over optimization.
{% endhint %}

## Next Steps

- [Risk Management](risk-management.md) - Understand stop-loss and take-profit
- [Pool Evaluation](pool-evaluation.md) - How pools are scored
- [FAQ](faq.md) - Common questions answered
