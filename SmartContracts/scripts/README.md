# Deployment Scripts

This directory contains production deployment scripts for LiquiDOT smart contracts.

## 📁 Structure

```
scripts/
├── deploy-moonbase.js       # Main Moonbase Alpha deployment script
└── utils/
    └── state-manager.js     # Deployment state persistence utility
```

## 🚀 Deploy to Moonbase Alpha

### Prerequisites

1. **Install dependencies:**
   ```bash
   cd SmartContracts
   npm install
   ```

2. **Get DEV tokens:**
   - Visit [Moonbeam Faucet](https://faucet.moonbeam.network/)
   - Connect your wallet
   - Request DEV tokens for Moonbase Alpha

3. **Set up environment:**
   ```bash
   # Create .env file in SmartContracts directory
   echo "MOON=your_private_key_here" > .env
   ```
   
   ⚠️ **Never commit your private keys!** The `.env` file is gitignored.

### Deploy Everything

Deploy the complete LiquiDOT infrastructure (Algebra DEX + XCMProxy + test tokens):

```bash
npx hardhat run scripts/deploy-moonbase.js --network moonbase
```

This will:
1. ✅ Deploy Algebra DEX suite (Factory, Router, Quoter, NFPM)
2. ✅ Deploy and configure XCMProxy contract
3. ✅ Deploy test tokens (optional)
4. ✅ Create test pool with liquidity (optional)
5. ✅ Save all addresses to `deployments/` directory

### Deploy Options

You can customize the deployment by modifying the script or passing options:

```javascript
// In deploy-moonbase.js, modify the main() call:
main({
  deployTestTokens: false,        // Skip test tokens
  createTestPool: false,          // Skip test pool
  operator: "0xOperatorAddress",  // Custom operator
  assetHubVault: "0xVaultAddr",   // AssetHubVault address for trusted caller
  defaultSlippageBps: 50,         // 0.5% slippage
  freezeConfig: false,            // Don't freeze config yet
})
```

### After Deployment

1. **Verify contracts** (optional but recommended):
   ```bash
   npx hardhat verify --network moonbase <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
   ```

2. **Test interaction:**
   ```bash
   npx hardhat console --network moonbase
   ```
   ```javascript
   > const proxy = await ethers.getContractAt("XCMProxy", "0xYourProxyAddress")
   > await proxy.owner()
   '0xYourAddress'
   ```

3. **Update documentation:**
   - Add addresses to `CONTRACT_ADDRESSES.md`
   - Update `DEPLOYMENT_GUIDE.md` with deployment details

## 📝 Deployment State

All deployment information is automatically saved to:

```
deployments/
├── deployment-state.json      # Complete deployment state
└── moonbase_algebra.json      # Algebra suite addresses
```

These files track:
- Contract addresses
- Deployer addresses
- Transaction hashes
- Configuration parameters
- Timestamps

## 🔍 Verify Deployment

Check deployed contracts:

```bash
# Check XCMProxy configuration
npx hardhat console --network moonbase
```

```javascript
const proxy = await ethers.getContractAt("XCMProxy", "0xProxyAddress");

// Verify configuration
console.log("Owner:", await proxy.owner());
console.log("Operator:", await proxy.operator());
console.log("Quoter:", await proxy.quoterContract());
console.log("Router:", await proxy.swapRouterContract());
console.log("NFPM:", await proxy.nfpmContract());
console.log("xTokens:", await proxy.xTokensPrecompile());
console.log("Asset Hub ParaID:", await proxy.assetHubParaId());
```

## ⚠️ Important Notes

1. **Network Selection:** Always use `--network moonbase` flag
2. **Gas Fees:** Keep ~5 DEV in deployer account for deployment
3. **Configuration:** Review XCM precompile addresses in `deploy-moonbase.js`
4. **Trusted Caller:** Set AssetHubVault address after both contracts are deployed
5. **Test Mode:** For testing, enable test mode to bypass XCM calls

## 🐛 Troubleshooting

### "Insufficient funds" error
- Get more DEV tokens from the faucet
- Check balance: `npx hardhat console --network moonbase`, then `ethers.provider.getBalance("0xYourAddress")`

### "Network not configured" error
- Verify `hardhat.config.js` has moonbase network entry
- Check RPC URL is correct: `https://rpc.api.moonbase.moonbeam.network`

### "Contract deployment failed" error
- Check gas price (may need to increase)
- Verify Solidity version compatibility (should be 0.8.28)
- Ensure optimizer is enabled in hardhat.config.js

### Deployment hangs
- Check network connection
- Try restarting the script
- Verify RPC endpoint is responsive

## 📚 Related Documentation

- [Moonbeam Documentation](https://docs.moonbeam.network/)
- [Algebra Documentation](https://docs.algebra.finance/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [XCM Documentation](https://wiki.polkadot.network/docs/learn-xcm)

## 🤝 Need Help?

- Check [TESTING_GUIDE.md](../TESTING_GUIDE.md) for testing setup
- Review [MILESTONE_1_REQUIREMENTS.md](../MILESTONE_1_REQUIREMENTS.md) for requirements
- Ask in Moonbeam Discord for deployment-specific issues
