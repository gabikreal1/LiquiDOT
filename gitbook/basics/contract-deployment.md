---
icon: rocket
---

# Contract Deployment

Deploy LiquiDOT smart contracts on Paseo Asset Hub and Moonbase Alpha testnets.

## Prerequisites

**Testnet Funds:**
- Paseo Asset Hub: ~10 DOT from [faucet](https://faucet.paseo.network/)
- Moonbase Alpha: ~50 DEV from [faucet](https://faucet.moonbeam.network/)

**Environment (.env in `SmartContracts/`):**
```bash
MOON=your_moonbase_private_key
ASSET=your_asset_hub_private_key
MOONBASE_RPC=https://rpc.api.moonbase.moonbeam.network
ASSETHUB_RPC=wss://paseo-asset-hub-rpc.polkadot.io
```

## Deployment Steps

### 1. Deploy Asset Hub Vault

**Using Remix:**
1. Go to [remix.ethereum.org](https://remix.ethereum.org)
2. Load `contracts/V1(Current)/AssetHubVault.sol`
3. Compile with Solidity 0.8.20, optimization: 200 runs
4. Deploy via MetaMask to Paseo Asset Hub:
   - RPC: `https://paseo-asset-hub-eth-rpc.polkadot.io`
   - Chain ID: 1000
5. Save deployed address

**Using Hardhat:**
```bash
cd SmartContracts
npx hardhat run scripts/deploy-assethub-vault.js --network passethub
```

### 2. Deploy Moonbase Infrastructure

```bash
# Deploy Algebra DEX (if needed)
npm run deploy:algebra

# Deploy XCM Proxy
npx hardhat run scripts/deploy-xcmproxy.js --network moonbase
```

Save addresses to `deployments/deployment-state.json`

### 3. Link Contracts

```bash
# Configure Asset Hub Vault
npx hardhat run scripts/configure-assethub.js --network passethub

# Enable test mode
npx hardhat run scripts/enable-testmode.js --network passethub
npx hardhat run scripts/enable-testmode.js --network moonbase
```

### 4. Verify Deployment

```bash
# Run tests
npm test

# Verify on explorers
npx hardhat verify --network passethub <VAULT_ADDRESS>
npx hardhat verify --network moonbase <PROXY_ADDRESS>
```

## Deployed Addresses

| Contract | Network | Address |
|----------|---------|---------|
| AssetHubVault | Paseo Asset Hub | `0x3B0D87f3d0AE4CDC8C0102DAEfB7433aaED15CCF` |
| XCMProxy | Moonbase Alpha | `0xf7749B6A5aD0EB4ed059620B89f14FA8e916ee41` |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Insufficient gas | Increase gas limit in `hardhat.config.js` |
| XCM message failed | Enable test mode or check XCM fees |
| Connection timeout | Switch RPC endpoint |

**Next:** [Testing Guide](testing-guide.md) • [Smart Contracts](smart-contracts.md)
