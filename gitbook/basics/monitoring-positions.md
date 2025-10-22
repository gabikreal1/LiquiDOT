---
icon: chart-line
---

# Monitoring Positions

Track your automated liquidity positions and analyze performance in real-time.

## Dashboard Overview

Access your main dashboard at [liquidot.xyz/dashboard](https://liquidot.xyz/dashboard)

### Key Metrics

**Portfolio Summary:**
* Total Value Locked (TVL)
* Total P&L (profit/loss)
* Active positions count
* Total fees earned
* Overall APY

**Position Cards:**

Each position shows:
* Token pair and DEX
* Current price and range status
* Entry price and current P&L
* Fees earned
* Days active
* Risk indicators

## Position Status

### 🟢 In Range (Healthy)

Price is within your defined range, position is active and earning fees.

**Action:** Monitor normally

### 🟡 Near Boundary (Warning)

Price approaching stop-loss or take-profit threshold.

**Action:** 
* Review position
* Consider manual exit
* Tighten monitoring

### 🔴 Out of Range (Liquidating)

Price has breached threshold, liquidation in progress.

**Action:**
* Wait for automatic liquidation
* Assets will return to Asset Hub
* Review performance post-liquidation

## Performance Analytics

### P&L Calculation

```
Total P&L = (Current Value + Fees Earned) - Initial Investment
P&L % = (Total P&L / Initial Investment) × 100
```

### APY Calculation

```
Daily Return = Fees Earned / Position Value
Annual APY = Daily Return × 365 × 100
```

## Real-Time Monitoring

**Update Frequency:**
* Price: Every 12 seconds (block time)
* Pool data: Every 60 seconds
* Position value: Real-time

**Notifications (Future):**
* Email alerts
* Push notifications
* Discord/Telegram bots

## Historical Performance

View historical charts for:
* Position value over time
* Price movement vs range
* Cumulative fees earned
* P&L trend

## Next Steps

* [Creating Positions](creating-position.md) - Create new positions
* [Risk Parameters](risk-parameters.md) - Adjust your strategy
* [Architecture](architecture.md) - Understand the system

*Full monitoring guide coming soon...*
