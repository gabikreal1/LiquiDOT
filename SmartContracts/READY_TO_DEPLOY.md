# 🚀 Ready to Deploy: Paseo + Moonbase Setup

Your cross-chain liquidity management system is ready to deploy!

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Paseo Asset Hub (Testnet)                │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              AssetHubVault.sol                        │  │
│  │  • Custody layer                                      │  │
│  │  • User deposits/withdrawals                          │  │
│  │  • Investment orchestration                           │  │
│  │  • Multi-chain registry                               │  │
│  │  • Position tracking (PendingExecution → Liquidated)  │  │
│  └───────────────────────────────────────────────────────┘  │
│                            ↕ XCM                             │
└─────────────────────────────────────────────────────────────┘
                             ↕
┌─────────────────────────────────────────────────────────────┐
│                   Moonbase Alpha (Testnet)                   │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                 XCMProxy.sol                          │  │
│  │  • Execution layer                                    │  │
│  │  • DEX operations (Algebra Integral)                  │  │
│  │  • LP position management                             │  │
│  │  • 2-step flow: receiveAssets → execute              │  │
│  │  • Cross-chain position linking                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                            ↕                                 │
│              Algebra Integral DEX Protocol                   │
└─────────────────────────────────────────────────────────────┘
```

## What's Ready

### ✅ Smart Contracts
- **AssetHubVault.sol** - Chain-agnostic vault with multi-chain support
- **XCMProxy.sol** - Pending position pattern with operator control
- Both contracts compile without errors
- Full test coverage implemented

### ✅ Deployment Scripts
- `scripts/deploy-assethub-paseo.js` - Deploy to Paseo Asset Hub
- `scripts/deploy-xcmproxy-moonbase.js` - Deploy to Moonbase Alpha
- `scripts/configure-assethub.js` - Post-deployment AssetHub setup
- `scripts/configure-xcmproxy.js` - Post-deployment XCMProxy setup

### ✅ Network Configuration
- `hardhat.config.js` - Networks configured:
  - `passethub` - Paseo Asset Hub (Chain ID: 420420422)
  - `moonbase` - Moonbase Alpha (Chain ID: 1287)

### ✅ Test Suite
- XCMProxy: 7 test files (deployment, pending positions, etc.)
- AssetHubVault: 6 test files (investment, liquidation, chain mgmt)
- All tests updated for new architecture

### ✅ Documentation
- `PASEO_MOONBASE_DEPLOYMENT.md` - Complete deployment guide
- `DEPLOYMENT_CHECKLIST.md` - Step-by-step checklist
- `TEST_DEPLOYMENT_UPDATE_SUMMARY.md` - All changes documented
- `QUICK_TEST_REFERENCE.md` - Testing quick reference

## Quick Start

### 1. Setup Environment
```bash
# In SmartContracts directory
echo "MOON_PK=your_moonbase_private_key" >> .env
echo "ASSET_PK=your_paseo_asset_hub_private_key" >> .env
```

### 2. Get Testnet Tokens
- **Moonbase DEV**: https://faucet.moonbeam.network/
- **Paseo PAS**: https://faucet.polkadot.io/

### 3. Deploy Contracts
```bash
# Deploy to Paseo Asset Hub
npx hardhat run scripts/deploy-assethub-paseo.js --network passethub

# Deploy to Moonbase Alpha
npx hardhat run scripts/deploy-xcmproxy-moonbase.js --network moonbase
```

### 4. Configure
```bash
# Configure AssetHub (add Moonbase as execution chain)
ASSETHUB_ADDRESS=0x... XCMPROXY_ADDRESS=0x... OPERATOR_ADDRESS=0x... TEST_MODE=true \
npx hardhat run scripts/configure-assethub.js --network passethub

# Configure XCMProxy (set DEX integrations, trust AssetHub)
XCMPROXY_ADDRESS=0x... ASSETHUB_ADDRESS=0x... OPERATOR_ADDRESS=0x... TEST_MODE=true \
npx hardhat run scripts/configure-xcmproxy.js --network moonbase
```

### 5. Test
```bash
# Run all tests
npx hardhat test

# Run specific test suites
npx hardhat test test/XCMProxy/7.pending-positions.test.js
npx hardhat test test/AssetHubVault/6.chain-management.test.js
```

## Key Features

### 🔗 Cross-Chain Position Linking
- Positions on Moonbase linked to AssetHub via `assetHubPositionId`
- Single source of truth maintained
- Proper liquidation flow across chains

### 🛡️ Operator Control
- 2-step investment flow prevents unauthorized execution
- Operator validates before executing pending investments
- Cancellation support with refunds

### 🌐 Multi-Chain Ready
- AssetHub supports unlimited execution chains
- No code changes needed to add new chains
- Chain registry: `addChain()`, `removeChain()`, `updateChainExecutor()`

### 📊 Clear State Tracking
- Position status enum: `PendingExecution` → `Active` → `Liquidated`
- Better visibility than boolean flags
- Easier debugging and monitoring

## Investment Flow

```javascript
// 1. User deposits on AssetHub (Paseo)
await assetHub.connect(user).deposit({ value: ethers.parseEther("100") });

// 2. Operator dispatches investment to Moonbase
await assetHub.connect(operator).dispatchInvestment(
  user.address,
  1287,  // Moonbase chainId
  poolAddress,
  wdevAddress,
  ethers.parseEther("50"),
  -5, 5,  // Range
  xcmDestination,
  xcmMessage
);

// 3. XCM message arrives on Moonbase → creates pending position
// Event: PendingPositionCreated(assetHubPositionId, ...)

// 4. Operator executes pending investment
const xcmProxy = await ethers.getContractAt("XCMProxy", xcmProxyAddress);
await xcmProxy.connect(operator).executePendingInvestment(assetHubPositionId);
// Event: PositionCreated(localPositionId, assetHubPositionId, ...)

// 5. Later: Liquidate position
await xcmProxy.connect(operator).liquidatePosition(localPositionId);

// 6. Settle on AssetHub
await assetHub.connect(operator).settleLiquidation(
  assetHubPositionId,
  returnAmount,
  { value: returnAmount }
);

// 7. User withdraws
await assetHub.connect(user).withdraw(returnAmount);
```

## Important Notes

### Test Mode
Both contracts have test mode that skips actual XCM sending:
```javascript
await assetHub.setTestMode(true);   // Skip XCM on AssetHub
await xcmProxy.setTestMode(true);   // Skip XCM on Moonbase
```
**Disable for production:** `setTestMode(false)`

### Algebra DEX Integration
XCMProxy requires Algebra Integral DEX:
- Quoter (for price quotes)
- SwapRouter (for token swaps)
- NFPM (Nonfungible Position Manager for LP positions)

If not available on Moonbase, you'll need to:
1. Deploy Algebra contracts, or
2. Adapt to use alternative DEX (Uniswap V3, etc.)

### XCM Considerations
- XCM messages take time (blocks to confirm)
- Monitor events for message arrival
- Handle failures with cancellation flow
- Test thoroughly before production

## Security Checklist

- [ ] Private keys secured (use hardware wallet for mainnet)
- [ ] Owner set to multisig (for production)
- [ ] Operator is trusted address
- [ ] Emergency role configured
- [ ] Test pause/unpause functionality
- [ ] Contracts audited (before mainnet)
- [ ] Test with small amounts first
- [ ] Monitor all events
- [ ] Set up alerts for unusual activity

## Support & Resources

### Documentation
- All docs in `SmartContracts/` directory
- See `PASEO_MOONBASE_DEPLOYMENT.md` for details
- Check `DEPLOYMENT_CHECKLIST.md` for step-by-step

### Networks
- **Paseo Asset Hub**: Para ID 1000
- **Moonbase Alpha**: Para ID 1000 (in relay chain)

### Faucets
- Moonbase: https://faucet.moonbeam.network/
- Paseo: https://faucet.polkadot.io/

### External Docs
- [Moonbeam Docs](https://docs.moonbeam.network/)
- [Polkadot XCM](https://wiki.polkadot.network/docs/learn-xcm)
- [Algebra Finance](https://docs.algebra.finance/)

## What's Next?

1. **Deploy to testnets** and test thoroughly
2. **Monitor and iterate** based on test results
3. **Get audit** if planning mainnet deployment
4. **Deploy to production** (Polkadot Asset Hub + Moonbeam)
5. **Add more chains** (Hydration, Acala, etc.)

## Questions?

Check the documentation files:
- Deployment questions → `PASEO_MOONBASE_DEPLOYMENT.md`
- Testing questions → `QUICK_TEST_REFERENCE.md`
- Architecture questions → `CHAIN_AGNOSTIC_ARCHITECTURE.md`
- Changes → `TEST_DEPLOYMENT_UPDATE_SUMMARY.md`

---

**Status**: ✅ Ready to Deploy
**Environment**: Paseo Asset Hub ↔ Moonbase Alpha
**Date**: October 13, 2025
**Version**: V1(Current) - Multi-Chain Architecture

Good luck with your deployment! 🚀
