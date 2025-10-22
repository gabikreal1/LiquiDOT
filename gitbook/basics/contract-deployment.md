---
icon: rocket
---

# Contract Deployment

Complete guide to deploying LiquiDOT smart contracts on Asset Hub and Moonbeam testnets.

## Overview

This guide covers deploying:
1. **Asset Hub Vault Contract** (Paseo Asset Hub)
2. **XCM Proxy Contract** (Moonbase Alpha)
3. **Linking contracts** via XCM configuration

## Prerequisites

### Required Tools

```bash
# Node.js v18+
node --version

# Hardhat
npm install --global hardhat

# Foundry (optional)
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Required Funds

**Paseo Asset Hub:**
* ~10 DOT for deployment and testing
* Get from: [Paseo Faucet](https://faucet.paseo.network/)

**Moonbase Alpha:**
* ~50 DEV for deployment and testing
* Get from: [Moonbeam Faucet](https://faucet.moonbeam.network/)

### Environment Setup

Create `.env` in `SmartContracts/`:

```bash
# Private keys (WITHOUT 0x prefix)
MOON=your_moonbase_private_key
ASSET=your_asset_hub_private_key

# RPC endpoints
MOONBASE_RPC=https://rpc.api.moonbase.moonbeam.network
ASSETHUB_RPC=wss://paseo-asset-hub-rpc.polkadot.io

# Deployer addresses
MOONBASE_DEPLOYER=0x...
ASSETHUB_DEPLOYER=0x...
```

## Step 1: Deploy Asset Hub Vault

### Using Remix (Recommended)

1. **Open Remix IDE**
   * Go to [remix.ethereum.org](https://remix.ethereum.org)

2. **Load Contract**
   * Create new file: `AssetHubVault.sol`
   * Paste contract code from `contracts/V1(Current)/AssetHubVault.sol`

3. **Compile**
   * Compiler version: 0.8.20
   * Enable optimization: 200 runs

4. **Connect to Asset Hub**
   * In Deploy tab, select "Injected Provider - MetaMask"
   * Configure MetaMask for Asset Hub:
     * Network: Paseo Asset Hub
     * RPC: `https://paseo-asset-hub-eth-rpc.polkadot.io`
     * Chain ID: 1000 (parachain ID)

5. **Deploy**
   * Constructor parameters:
     ```javascript
     _supportedAssets: ["0xDOT...", "0xUSDC..."]
     _investmentWorker: "0xYourWorkerAddress..."
     _feeCollector: "0xFeeAddress..."
     _emergencyAdmin: "0xAdminAddress..."
     ```
   * Click "Deploy"
   * Confirm transaction in MetaMask
   * Save deployed address!

### Verification

```bash
# Verify deployment
npx hardhat verify --network passethub 0xYourAssetHubVaultAddress \
  "constructor_args"
```

## Step 2: Deploy Moonbase Infrastructure

### A. Deploy Algebra Contracts (If not exists)

```bash
cd SmartContracts
npm run deploy:algebra
```

This deploys:
* Algebra Factory
* Algebra Pool Deployer
* Algebra Quoter
* Algebra SwapRouter

**Save addresses** to `deployments/moonbase_bootstrap.json`

### B. Deploy XCM Proxy

```bash
npx hardhat run scripts/deploy-xcmproxy.js --network moonbase
```

**Constructor parameters:**
```javascript
{
  owner: "0xAssetHubVaultAddress",  // From Step 1
  quoter: "0xAlgebraQuoterAddress",
  swapRouter: "0xAlgebraSwapRouterAddress"
}
```

**Save address** to `deployments/deployment-state.json`

### Verification

```bash
# Verify on Moonscan
npx hardhat verify --network moonbase 0xYourXCMProxyAddress \
  "0xOwner" "0xQuoter" "0xSwapRouter"
```

## Step 3: Create Test Pool

Create a test liquidity pool for testing:

```bash
npx hardhat run scripts/create-test-pool.js --network moonbase
```

**This creates:**
* DOT/USDC pool with 0.05% fee tier
* Initial liquidity: 1000 DOT + $50,000 USDC
* Returns pool address

**Save pool address** for testing!

## Step 4: Link Contracts

### A. Configure Asset Hub Vault

Set XCM Proxy address on Asset Hub:

```bash
npx hardhat run scripts/configure-assethub.js --network passethub
```

**Or manually via Remix:**
```solidity
assetHubVault.setXCMProxy(
  1284,  // Moonbeam parachain ID
  "0xYourXCMProxyAddress"
);
```

### B. Enable Test Mode

For testnet, enable test mode to skip XCM and test locally:

```bash
# On Asset Hub Vault
assetHubVault.setTestMode(true);

# On XCM Proxy
xcmProxy.setTestMode(true);
```

**Test mode allows:**
* Direct contract calls without XCM
* Faster testing iteration
* Bypass cross-chain delays

**⚠️ Disable before mainnet!**

## Step 5: Fund Contracts

### Fund XCM Proxy

Send tokens to XCM Proxy for initial liquidity:

```bash
# Transfer DOT
npx hardhat run scripts/fund-xcmproxy.js --network moonbase

# Or manually
# Send 100 DOT to 0xXCMProxyAddress
```

### Fund Asset Hub Vault

Deposit to Asset Hub Vault:

```bash
npx hardhat run scripts/deposit-vault.js --network passethub

# Or via frontend
# Connect wallet → Deposit → 100 DOT
```

## Step 6: Verify Deployment

Run comprehensive tests:

```bash
# Test Asset Hub Vault
npx hardhat test test/AssetHubVault/testnet/**/*.test.js --network passethub

# Test XCM Proxy
npx hardhat test test/XCMProxy/testnet/**/*.test.js --network moonbase

# Integration tests
npx hardhat test test/Integration/testnet/**/*.test.js --network passethub
```

**Expected output:**
```
✓ Asset Hub: Deposit works
✓ Asset Hub: Invest in pool works
✓ XCM Proxy: Receive assets works
✓ XCM Proxy: Mint LP works
✓ XCM Proxy: Execute liquidation works
✓ Integration: Full flow works

6 passing (45s)
```

## Deployment Checklist

- [ ] Asset Hub Vault deployed and verified
- [ ] XCM Proxy deployed and verified
- [ ] Test pool created
- [ ] Contracts linked (Asset Hub ↔ Moonbeam)
- [ ] Test mode enabled
- [ ] Contracts funded
- [ ] Tests passing
- [ ] Addresses saved to deployment files

## Common Issues

### "Insufficient gas"
**Solution:** Increase gas limit in hardhat.config.js

### "Contract already deployed"
**Solution:** Use different deployer account or redeploy

### "XCM message failed"
**Solution:** 
* Verify XCM fees are sufficient
* Check Asset Hub → Moonbeam connectivity
* Enable test mode for local testing

## Next Steps

* [Testing Guide](testing-guide.md) - Comprehensive testing
* [Smart Contracts](smart-contracts.md) - Contract documentation
* [Architecture](architecture.md) - System design

*Detailed deployment scripts available in `SmartContracts/scripts/README.md`*
