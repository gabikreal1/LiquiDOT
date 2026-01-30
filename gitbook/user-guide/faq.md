---
icon: circle-question
---

# Frequently Asked Questions

Common questions about using LiquiDOT for automated liquidity provision.

## Getting Started

### What is LiquiDOT?

LiquiDOT is an automated liquidity provider (LP) manager for the Polkadot ecosystem. It helps you:
- Automatically find and enter the best liquidity pools
- Set stop-loss and take-profit to protect your capital
- Rebalance positions to optimize returns
- Manage cross-chain liquidity from a single interface

### How is LiquiDOT different from managing LP positions manually?

| Manual LP | With LiquiDOT |
|-----------|---------------|
| You monitor pools yourself | 24/7 automated monitoring |
| You decide when to enter/exit | Automatic stop-loss/take-profit |
| You search for opportunities | AI-driven pool discovery |
| You handle cross-chain complexity | Seamless XCM integration |
| Constant attention required | Set and forget |

### What tokens can I use?

Currently LiquiDOT supports:
- **DOT** and DOT-derivative tokens
- **USDC, USDT, DAI** stablecoins
- **WETH, WBTC** wrapped tokens on Moonbeam
- **GLMR** (Moonbeam native token)

More tokens will be added as we expand to additional DEXes and chains.

### Which DEXes does LiquiDOT support?

Currently:
- **Algebra DEX** on Moonbeam (concentrated liquidity)

Planned:
- StellaSwap
- Beamswap
- HydraDX
- Additional parachains

## Deposits & Withdrawals

### How do I deposit funds?

1. Connect your wallet on the LiquiDOT dashboard
2. Navigate to the Deposit section
3. Enter the amount you want to deposit
4. Approve the transaction in your wallet
5. Funds appear in your Asset Hub balance

### How long do deposits take?

Deposits to Asset Hub are typically confirmed within 1-2 blocks (~12-24 seconds).

### Can I withdraw at any time?

**Idle funds:** Yes, withdraw instantly from Asset Hub.

**Active positions:** You can request withdrawal, which will:
1. Exit your active LP positions
2. Return assets to Asset Hub via XCM
3. Make funds available for withdrawal

This process typically takes 2-5 minutes depending on network conditions.

### Are there any fees?

| Fee Type | Amount | Description |
|----------|--------|-------------|
| Deposit | Gas only | Network transaction fee |
| Withdrawal | Gas only | Network transaction fee |
| Rebalancing | Gas only | Covered by your portfolio |
| Platform fee | Coming soon | Small % of profits (mainnet) |

## Strategy & Settings

### What does "Minimum APY" mean?

The minimum annual percentage yield you'll accept. LiquiDOT won't invest in pools yielding less than this threshold.

**Example:** If you set 10% minimum APY, a pool yielding 8% won't be considered even if it's otherwise a good match.

### How does the stop-loss work?

1. You set a percentage (e.g., -5%)
2. LiquiDOT monitors pool prices continuously
3. If price drops 5% below your entry, the position is automatically closed
4. Your assets are converted back and returned to Asset Hub

**Important:** Stop-loss protects against further losses but doesn't guarantee you'll exit exactly at -5% due to slippage and timing.

### What's the difference between stop-loss and take-profit?

- **Stop-loss:** Exits when price drops below your threshold (limits losses)
- **Take-profit:** Exits when price rises above your threshold (locks in gains)

Both can be set independently with different percentages.

### Can I set different stop-loss and take-profit levels?

Yes! LiquiDOT supports asymmetric ranges. For example:
- Stop-loss: -3%
- Take-profit: +20%

This lets you have tight downside protection with wide upside potential.

### How often does rebalancing happen?

Rebalancing is evaluated periodically (typically every few hours). However, a rebalance only executes if:
- The improvement exceeds the minimum threshold (default: 0.7%)
- The profit covers gas costs by 4× or more
- You haven't exceeded your daily rebalance limit

### What is the daily rebalance limit?

A safeguard that limits how many times your positions can be rebalanced per day (default: 8). This prevents excessive trading during volatile periods.

## Returns & Performance

### What returns can I expect?

Returns depend on:
- Your risk profile (conservative to aggressive)
- Market conditions
- Pool performance
- Your token preferences

**Typical ranges:**
- Conservative (stable pairs): 5-15% APY
- Moderate (mixed pairs): 10-30% APY
- Aggressive (volatile pairs): 20-80%+ APY

{% hint style="warning" %}
Past performance doesn't guarantee future results. Crypto markets are volatile.
{% endhint %}

### What is impermanent loss?

When you provide liquidity, you hold two tokens. If their price ratio changes, you may have less value than if you'd just held them separately. This difference is "impermanent loss."

**LiquiDOT mitigates IL by:**
- Scoring pools with IL risk factors
- Favoring stable pairs for conservative profiles
- Setting stop-losses to limit exposure
- Avoiding exits when IL is high (IL safeguard)

### How is APY calculated?

We use **30-day average APY** from:
- Trading fees earned
- Any liquidity incentives
- Historical pool data

This smooths out daily fluctuations and gives a more realistic expectation.

### Why does my position show different APY than when I entered?

Pool APY changes constantly based on:
- Trading volume (more trades = more fees)
- TVL changes (more liquidity = lower share of fees)
- Token prices (affects fee value)
- Incentive programs ending/starting

LiquiDOT continuously monitors and may rebalance if better opportunities exist.

## Security & Safety

### Where are my funds stored?

Your funds are held in the **Asset Hub Vault** smart contract on Polkadot's Asset Hub parachain. When actively providing liquidity, they're in LP positions on the DEX.

### Is LiquiDOT custodial?

**Semi-custodial:** Your funds are in smart contracts, not personal wallets. However:
- Only you can withdraw to your wallet
- Operators can only move funds according to strategy rules
- Emergency controls exist for critical situations

### What happens if something goes wrong?

Multiple safety layers:
1. **Stop-loss** - Automatic exit on price drops
2. **Emergency liquidation** - Admin can force-exit positions
3. **Pause function** - Halts all operations if needed
4. **Direct withdrawals** - Always available from Asset Hub

### Are the smart contracts audited?

[Audit status to be updated]

All contracts follow industry best practices:
- Access control (roles-based permissions)
- Reentrancy protection
- Overflow/underflow protection
- Emergency pause functionality

## Troubleshooting

### Why isn't my position rebalancing?

Rebalancing requires ALL conditions to be met:
- Improvement > 0.7% APY
- 30-day profit > 4× gas cost
- Daily limit not reached
- No IL safeguard blocking exit

Check your dashboard for specific reasons.

### Why was my stop-loss triggered?

Your stop-loss triggers when the pool price drops below your set threshold. Check:
- Your stop-loss setting (maybe too tight?)
- Recent price movements in the pool
- Position history for exact trigger price

### My position was liquidated but I still have losses?

Stop-loss limits further losses but can't prevent all loss:
- Price may have gapped past your level
- Slippage on exit
- IL that accumulated before trigger

Stop-loss is damage control, not a guarantee.

### How do I contact support?

- **Discord:** [Link coming soon]
- **Twitter:** [@LiquiDOT](https://twitter.com/liquidot)
- **Email:** support@liquidot.xyz

## Technical Questions

### What is XCM?

XCM (Cross-Consensus Messaging) is Polkadot's protocol for communication between parachains. LiquiDOT uses XCM to:
- Transfer assets between Asset Hub and Moonbeam
- Execute instructions across chains
- Return proceeds after liquidation

### Why Asset Hub + Moonbeam?

- **Asset Hub:** Secure custody, native DOT support, XCM hub
- **Moonbeam:** EVM compatibility, mature DeFi ecosystem, DEX availability

This architecture gives us security where it matters (custody) and flexibility where we need it (execution).

### Can I use LiquiDOT with a hardware wallet?

Yes, as long as your hardware wallet supports Polkadot/Moonbeam transactions. Tested with:
- Ledger (via Polkadot.js or Talisman)
- Other Polkadot-compatible hardware wallets

### Is there an API?

API documentation coming soon for advanced users who want to:
- Query positions programmatically
- Set strategies via API
- Build custom integrations

## Roadmap Questions

### When will mainnet launch?

We're currently on testnet (Paseo Asset Hub + Moonbase Alpha). Mainnet launch planned after:
- Complete security audit
- Extended testnet validation
- Community feedback integration

### Will you support other chains?

Yes! Planned expansions:
- Additional Polkadot parachains (HydraDX, Acala)
- More DEXes on Moonbeam
- Potential EVM L2s via bridges

### Will there be a token?

No token is planned currently. LiquiDOT is focused on building useful infrastructure first.

---

**Didn't find your answer?** Join our Discord or reach out on Twitter!
