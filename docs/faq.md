# ❓ Frequently Asked Questions

> Quick answers to common questions about LiquiDOT

---

## 🌟 General Questions

### What is LiquiDOT?

LiquiDOT is an **automated liquidity provider (LP) manager** for the Polkadot ecosystem. It helps you earn yield from your crypto assets by automatically managing liquidity positions across multiple chains, with built-in stop-loss and take-profit features.

### How is LiquiDOT different from other LP managers?

**Key Differentiators:**
- **Cross-Chain Native**: Built specifically for Polkadot's multi-chain architecture
- **Asymmetric Ranges**: Set different upside/downside limits (e.g., -5%/+10%)
- **User-Friendly Risk Management**: Percentage-based controls instead of complex tick values
- **Automated Stop-Loss**: Automatic position closure when price moves against you
- **Hub-and-Spoke Security**: Custody separated from execution for maximum security

### Is LiquiDOT safe to use?

**Security Measures:**
- ✅ **OpenZeppelin** battle-tested contracts
- ✅ **Separation of concerns** - custody isolated from execution
- ✅ **Emergency controls** for crisis management
- ✅ **Comprehensive testing** with 100% coverage
- ✅ **Multi-signature** admin controls
- ⏳ **Third-party audits** (planned for Q2 2025)

**Risks to Consider:**
- Smart contract risk (inherent to all DeFi)
- Impermanent loss from LP positions
- Market volatility and liquidation risk

---

## 💰 Getting Started

### What assets can I use with LiquiDOT?

**Currently Supported (MVP):**
- **Stablecoins**: USDC, USDT
- **Major Tokens**: DOT, GLMR, ETH (wrapped)
- **Network**: Moonbeam (Algebra pools)

**Coming Soon:**
- **Hydration**: HDX, DOT, additional assets
- **Acala**: ACA, aUSD, liquid staking tokens
- **More Parachains**: Based on community demand

### How much do I need to start?

**Minimum Deposits:**
- **No technical minimum** in the smart contracts
- **Practical minimum**: ~$100 equivalent to cover gas costs effectively
- **Recommended starting amount**: $500-1000 to see meaningful returns

### What fees does LiquiDOT charge?

**Current Fee Structure (MVP):**
- **No protocol fees** during beta period
- **Gas costs**: Standard network fees for transactions
- **DEX fees**: Standard trading fees from Algebra pools (0.05-0.3%)

**Future Fee Structure:**
- **Management fee**: Likely 1-2% annually
- **Performance fee**: 10-20% of profits only
- **Gas optimization**: Batch operations to reduce costs

---

## 🎯 Strategy & Risk Management

### What's the difference between Conservative, Moderate, and Aggressive strategies?

| Strategy | Range | Rebalancing | Risk Level | Best For |
|----------|-------|-------------|------------|----------|
| **Conservative** | -2% to +3% | Frequent | Low | Risk-averse users, beginners |
| **Moderate** | -5% to +8% | Balanced | Medium | Most users, balanced approach |
| **Aggressive** | -10% to +15% | Infrequent | High | Experienced users, higher risk tolerance |
| **Custom** | You decide | You control | Variable | Advanced users wanting full control |

### How does stop-loss work?

**Automatic Protection:**
1. **Range Monitoring**: System continuously monitors your position's price range
2. **Exit Trigger**: When price moves outside your set range (e.g., -5% to +10%)
3. **Liquidation**: Position is automatically closed and converted back to your base asset
4. **Asset Return**: Proceeds are returned to your Asset Hub balance

**Example:**
- You set a range of -5% to +10% around current DOT price
- DOT price drops 6% → Position automatically liquidated
- Proceeds converted to USDC and returned to your account

### What is impermanent loss and how does LiquiDOT help?

**Impermanent Loss Explained:**
- Occurs when token prices in your LP position diverge significantly
- Your LP tokens might be worth less than just holding the original tokens
- **Example**: You LP USDC/DOT, DOT pumps 100% → you have less DOT than if you just held

**How LiquiDOT Helps:**
- **Range Management**: Positions exit before extreme price movements
- **Stop-Loss Protection**: Limits downside exposure
- **Automatic Rebalancing**: Adjusts positions as market conditions change
- **Diversification**: Spreads risk across multiple pools and strategies

---

## 🔧 Technical Questions

### Which wallets are supported?

**Polkadot Native:**
- **Polkadot.js Extension** (recommended)
- **Talisman** 
- **Nova Wallet**
- **Fearless Wallet**

**Ethereum Compatible:**
- **MetaMask** (for Moonbeam assets)
- **Trust Wallet**
- **Coinbase Wallet**

### How do cross-chain transactions work?

**The Process:**
1. **Deposit** assets to Asset Hub Vault
2. **XCM Transfer**: Assets sent to Moonbeam via Polkadot's XCM messaging
3. **Position Creation**: LP position created on Moonbeam DEX
4. **Monitoring**: Backend monitors position health
5. **Liquidation**: When needed, position closed and assets returned via XCM

**User Experience:**
- Seamless from your perspective
- Single transaction to start earning
- Automatic cross-chain handling
- Real-time position monitoring

### What happens if the system goes down?

**Fail-Safe Mechanisms:**
- **Emergency Controls**: Admin can pause and liquidate positions
- **Position Independence**: Your LP positions exist on-chain regardless of our system
- **Manual Recovery**: Positions can be managed directly via DEX interfaces if needed
- **Backup Systems**: Monitoring infrastructure has redundancy

**Your Assets:**
- Always remain in verifiable smart contracts
- Never held in centralized accounts
- You can withdraw available balances anytime
- Emergency liquidation returns assets to your vault

---

## 📊 Performance & Monitoring

### How do I track my performance?

**Dashboard Features:**
- **Real-Time Value**: Current worth of all positions
- **P&L Tracking**: Profit/loss over different time periods  
- **Fee Earnings**: Trading fees collected from your positions
- **Position Health**: Visual indicators for range status
- **Historical Charts**: Performance over time

**Mobile Notifications** (Coming Soon):
- Position exits due to stop-loss
- High performance notifications
- System maintenance alerts

### What returns can I expect?

**Typical Ranges** (not guaranteed):
- **Conservative**: 5-15% APY
- **Moderate**: 8-25% APY  
- **Aggressive**: 10-40% APY (higher volatility)

**Factors Affecting Returns:**
- Market volatility and trading volume
- Pool selection and timing
- Range width and management
- Overall market conditions
- DEX liquidity mining rewards

**Important Note**: Past performance doesn't guarantee future results. Crypto markets are highly volatile.

### How often are positions rebalanced?

**Frequency by Strategy:**
- **Conservative**: Often (price moves 2-3%)
- **Moderate**: Moderate (price moves 5-8%)
- **Aggressive**: Rare (price moves 10-15%+)

**Rebalancing Triggers:**
- Price exits your range
- Better opportunities identified
- Market conditions change significantly
- Risk management rules activated

---

## 🛠️ Troubleshooting

### My transaction failed. What should I do?

**Common Causes & Solutions:**

1. **Insufficient Gas**
   - Increase gas limit in wallet
   - Wait for network congestion to decrease
   - Try during off-peak hours

2. **Network Issues**
   - Check wallet connection to correct network
   - Refresh page and reconnect wallet
   - Try different RPC endpoint

3. **Insufficient Balance**
   - Verify you have enough tokens for the transaction
   - Account for gas fees in your calculations
   - Check if funds are locked in positions

### I can't see my position. Where is it?

**Troubleshooting Steps:**

1. **Check Network**: Ensure you're viewing the correct chain
2. **Refresh Data**: Reload page and reconnect wallet
3. **Transaction Status**: Verify transaction confirmed on block explorer
4. **Cross-Chain Delay**: XCM transactions may take 1-2 minutes
5. **Contact Support**: If issue persists after 5 minutes

### How do I emergency exit all positions?

**Emergency Procedures:**

1. **Via Dashboard**: Use "Emergency Liquidate All" button (if available)
2. **Direct Contract**: Call emergency functions directly
3. **Contact Team**: Email support@liquidot.xyz for assistance
4. **Manual DEX**: Access positions directly via Moonbeam DEXes

**Important**: Emergency exits may result in higher slippage and fees.

---

## 🌐 Ecosystem Questions

### Which parachains does LiquiDOT support?

**Current (MVP):**
- **Asset Hub**: User custody and balance management
- **Moonbeam**: DEX execution via Algebra pools

**Roadmap Q2 2025:**
- **Hydration**: Native DOT pools and omnipool access
- **Acala**: Stablecoin and liquid staking integration

**Future Considerations:**
- **Astar**: WASM and EVM compatibility
- **Bifrost**: Liquid staking derivatives
- **Centrifuge**: Real-world asset pools
- **Community Requests**: Based on user demand

### How does LiquiDOT benefit the Polkadot ecosystem?

**Capital Efficiency:**
- Improves liquidity utilization across parachains
- Reduces fragmentation through cross-chain pooling
- Enables single-interface access to ecosystem opportunities

**User Experience:**
- Simplifies multi-chain DeFi for average users
- Reduces technical barriers to LP participation
- Provides familiar risk management tools

**Ecosystem Growth:**
- Increases total value locked (TVL) across parachains
- Supports DEX growth through improved liquidity
- Demonstrates practical XCM utility

---

## 🔜 Future Development

### What new features are planned?

**Phase 2 (Q2 2025):**
- Multi-parachain support (Hydration, Acala)
- Mobile app with push notifications
- Advanced strategy options
- Yield farming integrations

**Phase 3 (Q3-Q4 2025):**
- DAO governance implementation
- Position NFTs (ERC-721 transferable)
- zkProof-verified investment decisions
- Cross-chain arbitrage strategies

### Will there be a governance token?

**Current Status**: No governance token in MVP

**Future Plans**:
- **Utility Token**: Potential for fee discounts and governance rights
- **DAO Transition**: Progressive decentralization of the protocol
- **Community Control**: User voting on strategy parameters and new features
- **Timeline**: Post-MVP, likely 2025-2026

### How can I stay updated?

**Official Channels:**
- **Twitter**: [@LiquiDOT_xyz](https://twitter.com/liquidot_xyz) - Daily updates
- **Discord**: [discord.gg/liquidot](https://discord.gg/liquidot) - Community chat
- **Telegram**: [t.me/liquidot](https://t.me/liquidot) - Announcements
- **GitHub**: [github.com/gabikreal1/LiquiDOT](https://github.com/gabikreal1/LiquiDOT) - Development updates

**Content:**
- **Blog**: Medium articles on strategy and development
- **YouTube**: Tutorial videos and AMAs
- **Newsletter**: Monthly updates and market insights

---

## 💬 Support

### How can I get help?

**Self-Service:**
- **Documentation**: [docs.liquidot.xyz](https://docs.liquidot.xyz)
- **User Guide**: Comprehensive step-by-step instructions
- **Video Tutorials**: Visual guides for common tasks

**Community Support:**
- **Discord**: Active community for peer help
- **Telegram**: Quick questions and announcements
- **Twitter**: Public support and updates

**Direct Support:**
- **Email**: support@liquidot.xyz
- **Response Time**: Within 24 hours
- **Priority Support**: Available for larger depositors

### How can I contribute to LiquiDOT?

**Development:**
- Submit issues and feature requests on GitHub
- Contribute code improvements via pull requests
- Help with testing and bug reports

**Community:**
- Answer questions in Discord/Telegram
- Create educational content
- Provide feedback on new features

**Business:**
- Refer new users to the platform
- Suggest partnership opportunities
- Provide market insights and strategy ideas

---

*Have a question not covered here? Join our [Discord community](https://discord.gg/liquidot) or email support@liquidot.xyz*
