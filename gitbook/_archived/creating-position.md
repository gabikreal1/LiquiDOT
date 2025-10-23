---
icon: circle-plus
---

# Creating Your First Position

This guide walks you through creating your first automated liquidity position with LiquiDOT.

## Prerequisites

Before creating a position, ensure you have:

* ✅ Connected wallet (Talisman, SubWallet, or Polkadot.js)
* ✅ Testnet tokens deposited in Asset Hub Vault
* ✅ Configured your strategy preferences
* ✅ Basic understanding of liquidity provision

{% hint style="info" %}
New to LP? Check out our [Understanding Liquidity Provision](#understanding-liquidity-provision) section below.
{% endhint %}

## Step-by-Step Guide

### Step 1: Navigate to Dashboard

1. Log into [liquidot.xyz](https://liquidot.xyz)
2. Connect your wallet
3. Click **Dashboard** in the navigation menu
4. You should see your current balance and any active positions

### Step 2: Choose Create Position

1. Click the **Create Position** button
2. You'll see the position creation wizard

### Step 3: Select Assets

**Choose your base asset:**

The base asset is the token you're starting with. LiquiDOT will automatically handle any necessary swaps.

**Supported assets (MVP):**
* DOT (Polkadot)
* USDC (USD Coin)
* WETH (Wrapped Ethereum)
* WBTC (Wrapped Bitcoin)

**Example:**
```
Base Asset: DOT
Amount: 100 DOT
```

### Step 4: Select Pool

LiquiDOT will show you available pools based on your asset selection and strategy preferences.

**Pool Information Displayed:**
* Token pair (e.g., DOT/USDC)
* Current APY
* 24hr volume
* Total Value Locked (TVL)
* Fee tier
* DEX name

**Filtering:**
* ✅ Only shows pools matching your preferences
* ✅ Meets minimum APY threshold
* ✅ Has sufficient liquidity
* ✅ Matches risk tolerance

**Example Selection:**
```
Pool: DOT/USDC
APY: 12.5%
TVL: $2.5M
24hr Volume: $450k
Fee: 0.05%
DEX: Algebra (Moonbeam)
```

Click **Select Pool** to proceed.

### Step 5: Configure Price Range

This is where you set your automated risk parameters using **asymmetric ranges**.

#### Understanding Asymmetric Ranges

Unlike traditional LP tools that use symmetric ranges (±5%), LiquiDOT allows different downside and upside boundaries:

**Current Price: $50**

**Downside Protection (Stop-Loss):**
```
Lower Range: -5%
= $47.50 (exit if price drops below)
```

**Upside Capture (Take-Profit):**
```
Upper Range: +10%
= $55.00 (exit if price rises above)
```

#### Range Selection Options

**Preset Ranges:**
* **Conservative:** -2% / +3% (tight range, lower IL)
* **Moderate:** -5% / +10% (balanced)
* **Aggressive:** -10% / +20% (wide range, higher IL)
* **Custom:** Set your own percentages

**Custom Range Example:**
```
Lower Range: -3%   [User can adjust]
Upper Range: +15%  [User can adjust]
```

**Visual Range Indicator:**
```
$47.50          $50.00          $55.00
  |━━━━━━━━━━━━━|━━━━━━━━━━━━━|
  -5%          Entry         +10%
 (Stop)       (Current)     (Profit)
```

{% hint style="warning" %}
**Wider ranges = More impermanent loss risk**  
**Tighter ranges = More frequent liquidations**

Balance risk vs stability based on your outlook.
{% endhint %}

### Step 6: Review Position Details

Before confirming, review all details:

**Position Summary:**
```
Base Asset: 100 DOT
Target Pool: DOT/USDC
Entry Price: $50.00
Lower Bound: $47.50 (-5%)
Upper Bound: $55.00 (+10%)
Expected APY: 12.5%
Estimated Liquidity: 10,500 units
Gas Fees: ~0.01 DOT (XCM) + ~$2 (Moonbeam)
```

**Risk Parameters:**
* Stop-Loss: Triggers at $47.50
* Take-Profit: Triggers at $55.00
* Max Loss: ~$150 (if instant drop to stop-loss)
* Expected Daily Earnings: ~$0.34 (at 12.5% APY)

### Step 7: Approve and Confirm

**Transaction Flow:**

1. **Approve Asset Transfer**
   * Sign transaction to allow Asset Hub Vault to lock your DOT
   * Gas: ~$0.10

2. **Create Position**
   * Asset Hub Vault locks your DOT
   * Constructs XCM message with investment instructions
   * Sends to Moonbeam
   * Gas: ~0.01 DOT

3. **Wait for XCM Execution** (30-60 seconds)
   * XCM message traverses to Moonbeam
   * XCM Proxy receives assets and instructions
   * Swaps tokens if needed
   * Mints LP position on Algebra
   * Records position data

4. **Position Active**
   * You'll see confirmation: "Position Created Successfully!"
   * Position appears in your dashboard
   * Monitoring begins automatically

### Step 8: Monitor Your Position

**Dashboard View:**

```
╔══════════════════════════════════════════════════════╗
║ Position #1234                                       ║
║ DOT/USDC • Algebra • Moonbeam                        ║
╠══════════════════════════════════════════════════════╣
║ Entry Price:    $50.00                               ║
║ Current Price:  $51.25  (+2.5%)                      ║
║ Range:          $47.50 - $55.00                      ║
║ Status:         IN RANGE ✅                          ║
║                                                      ║
║ Position Value: $102.50                              ║
║ P&L:           +$2.50 (+2.5%)                        ║
║ Fees Earned:   +$0.87                                ║
║                                                      ║
║ APY:           12.5%                                 ║
║ Age:           2 days                                ║
╚══════════════════════════════════════════════════════╝
```

**Price Indicator:**
```
$47.50         $51.25         $55.00
  |━━━━━━━━━━━━━●━━━━━━━━━━━━|
  -5%                       +10%
 (Stop)      (Current)     (Profit)
```

**Status Meanings:**
* 🟢 **IN RANGE** - Position active, earning fees
* 🟡 **NEAR BOUNDARY** - Approaching stop-loss or take-profit
* 🔴 **OUT OF RANGE** - Liquidation triggered or pending

## Automated Actions

### When Stop-Loss Triggers

**Scenario:** Price drops to $47.49 (below -5% threshold)

**Automatic Actions:**
1. Stop-Loss Worker detects breach (within 12 seconds)
2. Calls `executeFullLiquidation()` on XCM Proxy
3. XCM Proxy validates position is truly out of range
4. Burns LP position
5. Swaps both tokens back to DOT
6. Sends ~97 DOT back to Asset Hub via XCM
7. Asset Hub credits your balance
8. Dashboard shows: "Position Liquidated (Stop-Loss)"

**Your Balance:**
```
Before: 0 DOT (locked in position)
After:  97 DOT (available)
Loss:   -3 DOT (-3%)
```

### When Take-Profit Triggers

**Scenario:** Price rises to $55.01 (above +10% threshold)

**Automatic Actions:**
1. Stop-Loss Worker detects take-profit hit
2. Liquidation process same as above
3. Returns ~110 DOT to Asset Hub

**Your Balance:**
```
Before: 0 DOT (locked in position)
After:  110 DOT (available)
Profit: +10 DOT (+10%)
```

## Managing Your Position

### Viewing Position Details

Click any position in your dashboard to see:
* Real-time price and range status
* Accumulated fees
* Impermanent loss estimate
* Historical price chart
* Transaction history

### Early Exit

**Manually close position before stop-loss/take-profit:**

1. Go to position details
2. Click **Close Position**
3. Confirm transaction
4. Position liquidated immediately
5. Assets returned to Asset Hub

**Note:** No penalties for early exit except gas fees.

### Adjusting Parameters (Future Feature)

**Not available in MVP** - Once created, positions cannot be adjusted. To change parameters:
1. Close existing position
2. Create new position with desired settings

**Future:** Range adjustment, adding capital, partial withdrawals.

## Best Practices

### ✅ Do's

* **Start Small** - Test with small amounts first
* **Diversify** - Create multiple positions across different pools
* **Monitor Regularly** - Check dashboard daily
* **Understand IL** - Know impermanent loss risks for your pairs
* **Set Realistic Ranges** - Based on historical volatility
* **Consider Fees** - Factor in XCM and gas costs

### ❌ Don'ts

* **Don't Over-Allocate** - Respect max allocation per pool
* **Don't Ignore Volatility** - Tight ranges on volatile assets = frequent liquidations
* **Don't FOMO** - High APY often means high risk
* **Don't Neglect Gas** - Factor in XCM fees (especially for small positions)
* **Don't Trust Blindly** - DYOR on pools and assets

## Understanding Liquidity Provision

### What is LP?

**Liquidity provision** means depositing tokens into a decentralized exchange pool to enable trading. In return, you earn:

* **Trading Fees** - Small percentage of every trade
* **Protocol Incentives** - Additional rewards from DEX

### Concentrated Liquidity

LiquiDOT uses **concentrated liquidity** (Uniswap V3 style):

**Traditional LP:**
```
Price Range: $0 to ∞
Capital Efficiency: Low
```

**Concentrated LP:**
```
Price Range: $47.50 to $55.00
Capital Efficiency: High (10-100x)
```

By concentrating liquidity in a specific range, you earn more fees but face higher impermanent loss risk if price exits range.

### Impermanent Loss (IL)

**IL occurs when** token prices diverge from entry ratio.

**Example:**
```
Entry:  100 DOT + $5,000 USDC (DOT = $50)
Exit:   90 DOT + $5,500 USDC (DOT = $61.11)

If you had just held:
Value = (100 × $61.11) = $6,111

If you LP'd:
Value = (90 × $61.11) + $5,500 = $10,999.9 ≈ $6,000

Impermanent Loss = $6,111 - $6,000 = $111
IL Percentage = 1.8%
```

**Mitigated by:**
* Trading fees earned
* Smaller price movements
* Stablecoin pairs (minimal IL)

{% hint style="info" %}
LiquiDOT's stop-loss helps limit IL by exiting when price moves too far!
{% endhint %}

## Common Issues

### "Insufficient Balance"
**Solution:** Deposit more assets to Asset Hub Vault

### "Pool Does Not Meet Preferences"
**Solution:** Adjust your minimum APY or asset preferences

### "Transaction Failed"
**Solution:** 
* Check gas balances (need DOT on Asset Hub, DEV on Moonbeam)
* Wait a few blocks and retry
* Contact support if persists

### "Position Not Found"
**Solution:** 
* Wait for XCM execution (can take 60 seconds)
* Check transaction status on block explorer
* Refresh dashboard

## Next Steps

<table data-view="cards"><thead><tr><th></th><th></th><th data-hidden data-card-target data-type="content-ref"></th></tr></thead><tbody><tr><td><strong>Configure Strategy</strong></td><td>Optimize your investment strategy</td><td><a href="strategy-selection.md">strategy-selection.md</a></td></tr><tr><td><strong>Set Risk Parameters</strong></td><td>Fine-tune stop-loss and take-profit</td><td><a href="risk-parameters.md">risk-parameters.md</a></td></tr><tr><td><strong>Monitor Positions</strong></td><td>Track performance and analytics</td><td><a href="monitoring-positions.md">monitoring-positions.md</a></td></tr></tbody></table>

## Getting Help

* 💬 [Discord Community](https://discord.gg/liquidot)
* 📧 [Email Support](mailto:gabrielsoftware04@gmail.com)
* 📖 [Full Documentation](../README.md)
* 🐛 [Report Issues](https://github.com/gabikreal1/LiquiDOT/issues)

---

*Congratulations! You've created your first automated LP position with LiquiDOT!* 🎉
