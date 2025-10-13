# Quick Start: Deploy to Paseo + Moonbase

## Overview

- **AssetHub**: Deploy via Remix to Paseo Asset Hub
- **XCMProxy**: Deploy via Hardhat to Moonbase Alpha

## Prerequisites

```bash
# 1. Set environment variables
cd SmartContracts
echo "MOON_PK=your_moonbase_private_key" >> .env

# 2. Get testnet tokens
# Moonbase DEV: https://faucet.moonbeam.network/
# Paseo PAS: https://faucet.polkadot.io/
```

## Part 1: Deploy AssetHub (Remix → Paseo)

### Step 1: Open Remix
1. Go to https://remix.ethereum.org/
2. Create file: `AssetHubVault.sol`
3. Copy contract from `/contracts/V1(Current)/AssetHubVault.sol`

### Step 2: Compile
- Compiler: 0.8.28
- Enable optimization (200 runs)
- Click "Compile"

### Step 3: Add Paseo Network to MetaMask
- **Network Name**: Paseo Asset Hub
- **RPC URL**: `https://testnet-passet-hub-eth-rpc.polkadot.io`
- **Chain ID**: `420420422`
- **Currency**: `PAS`

### Step 4: Deploy
1. Deploy & Run tab
2. Environment: "Injected Provider - MetaMask"
3. Contract: `AssetHubVault`
4. Click "Deploy"
5. **SAVE ADDRESS**: `ASSETHUB_ADDRESS=0x...`

### Step 5: Configure AssetHub (via Remix)

In Remix, expand deployed contract and call these functions:

```solidity
// 1. Set XCM precompile
setXcmPrecompile("0x0000000000000000000000000000000000000808")

// 2. Set operator (your address or separate operator)
setOperator("YOUR_OPERATOR_ADDRESS")

// 3. Enable test mode
setTestMode(true)
```

✅ **AssetHub deployed and configured!** Now deploy XCMProxy...

## Part 2: Deploy XCMProxy (Hardhat → Moonbase)

### Step 1: Deploy Contract

```bash
cd SmartContracts
npx hardhat run scripts/deploy-xcmproxy-moonbase.js --network moonbase
```

**Output:**
```
✅ XCMProxy deployed successfully!
📍 Contract Address: 0x...
```

**SAVE ADDRESS**: `XCMPROXY_ADDRESS=0x...`

### Step 2: Configure XCMProxy

```bash
XCMPROXY_ADDRESS=0x... \
ASSETHUB_ADDRESS=0x... \
OPERATOR_ADDRESS=0x... \
TEST_MODE=true \
npx hardhat run scripts/configure-xcmproxy.js --network moonbase
```

This automatically configures:
- ✅ xTokens precompile
- ✅ Asset Hub Para ID (1000)
- ✅ Default XCM weight
- ✅ Operator
- ✅ Trusted caller (AssetHub)
- ✅ Test mode

**Optional**: Add Algebra DEX if available:
```bash
XCMPROXY_ADDRESS=0x... \
ALGEBRA_QUOTER=0x... \
ALGEBRA_ROUTER=0x... \
ALGEBRA_NFPM=0x... \
WDEV_ADDRESS=0x... \
npx hardhat run scripts/configure-xcmproxy.js --network moonbase
```

## Part 3: Link Contracts

### On AssetHub (via Remix)

Call `addChain` function with these parameters:

- **chainId**: `1287`
- **xcmDestination**: `0x0001000100a10f041300c10f030400010300`
- **chainName**: `Moonbase Alpha`
- **executor**: `[YOUR_XCMPROXY_ADDRESS]`

Click "transact" → Confirm in MetaMask

✅ **Contracts linked!**

## Part 4: Test

### Test Deposit on AssetHub

Via Remix on AssetHub contract:

```solidity
deposit() payable
```
Value: `0.1` PAS

Check balance:
```solidity
getUserBalance("YOUR_ADDRESS")
```

### Test Dispatch (Test Mode)

```solidity
dispatchInvestment(
  userAddress,
  1287,              // Moonbase chainId
  poolAddress,       // Can be dummy in test mode
  baseAsset,         // Can be dummy in test mode
  "50000000000000000", // 0.05 PAS
  -5,
  5,
  "0x03...",         // XCM destination
  "0x..."            // XCM message
)
```

## Configuration Checklist

### AssetHub (Paseo) ✓
- [ ] Deployed via Remix
- [ ] Address saved
- [ ] XCM precompile set
- [ ] Operator set
- [ ] Test mode enabled
- [ ] Moonbase chain added

### XCMProxy (Moonbase) ✓
- [ ] Deployed via Hardhat
- [ ] Address saved
- [ ] XCM parameters configured
- [ ] Operator set
- [ ] AssetHub trusted
- [ ] Test mode enabled
- [ ] DEX integrated (optional)

### Link ✓
- [ ] AssetHub has Moonbase in chain registry
- [ ] XCMProxy trusts AssetHub address

## Quick Commands Reference

### Deploy XCMProxy
```bash
npx hardhat run scripts/deploy-xcmproxy-moonbase.js --network moonbase
```

### Configure XCMProxy (Minimal)
```bash
XCMPROXY_ADDRESS=0x... ASSETHUB_ADDRESS=0x... OPERATOR_ADDRESS=0x... TEST_MODE=true \
npx hardhat run scripts/configure-xcmproxy.js --network moonbase
```

### Configure XCMProxy (With DEX)
```bash
XCMPROXY_ADDRESS=0x... \
ASSETHUB_ADDRESS=0x... \
OPERATOR_ADDRESS=0x... \
ALGEBRA_QUOTER=0x... \
ALGEBRA_ROUTER=0x... \
ALGEBRA_NFPM=0x... \
WDEV_ADDRESS=0x... \
TEST_MODE=true \
npx hardhat run scripts/configure-xcmproxy.js --network moonbase
```

### Verify Configuration (Hardhat Console)
```bash
npx hardhat console --network moonbase
```

```javascript
const xcmProxy = await ethers.getContractAt("XCMProxy", "0x...");
console.log("Owner:", await xcmProxy.owner());
console.log("Operator:", await xcmProxy.operator());
console.log("Test Mode:", await xcmProxy.testMode());
console.log("Trusted Caller:", await xcmProxy.trustedXcmCaller());
```

## Troubleshooting

### Deployment Issues

**"Insufficient funds"**
- Get tokens from faucets (links in Prerequisites)

**"Network not found"**
- Check MetaMask network configuration
- Verify RPC URL is correct

### Configuration Issues

**"Not the owner"**
- Use the same account that deployed
- Check: `await contract.owner()`

**"Chain already exists" (AssetHub)**
- Remove first: `removeChain(1287)`
- Or update: `updateChainExecutor(1287, newAddress)`

### Testing Issues

**"Chain not supported"**
- Verify addChain was called on AssetHub
- Check: `supportedChains(1287)`

**"Token not supported"**
- Add token: `addSupportedToken(tokenAddress)`

## Documentation Files

- **`REMIX_DEPLOYMENT_GUIDE.md`** - Detailed Remix guide for AssetHub
- **`XCMPROXY_CONFIG_VALUES.md`** - All configuration values explained
- **`scripts/deploy-xcmproxy-moonbase.js`** - Deployment script
- **`scripts/configure-xcmproxy.js`** - Configuration script

## Support

- Moonbeam Docs: https://docs.moonbeam.network/
- Polkadot XCM: https://wiki.polkadot.network/docs/learn-xcm
- Faucets:
  - Moonbase: https://faucet.moonbeam.network/
  - Paseo: https://faucet.polkadot.io/

---

**Status**: Ready to deploy
**Networks**: Paseo Asset Hub ↔ Moonbase Alpha
**Last Updated**: October 13, 2025
