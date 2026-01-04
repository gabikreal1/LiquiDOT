---
icon: rocket
---

# Contract Deployment

Deploy LiquiDOT smart contracts on Paseo Asset Hub and Moonbase Alpha testnets.

## Current Deployments

| Contract | Network | Address |
|----------|---------|---------|
| AssetHubVault | Paseo Asset Hub | `0x68e86F267C5C37dd4947ef8e5823eBAeAf93Fde6` |
| XCMProxy | Moonbase Alpha | `0xe07d18eC747707f29cd3272d48CF84A383647dA1` |

## Prerequisites

**Testnet Funds:**

* Paseo PAS: https://faucet.paseo.network/
* Moonbase DEV: https://faucet.moonbeam.network/

**Environment (.env in `SmartContracts/`):**

```bash
MOON_PK=0xyour_moonbase_private_key
ASSET_PK=0xyour_asset_hub_private_key
ASSETHUB_CONTRACT=0x68e86F267C5C37dd4947ef8e5823eBAeAf93Fde6
XCMPROXY_CONTRACT=0xe07d18eC747707f29cd3272d48CF84A383647dA1
```

## Deployment Steps

### 1. Deploy Asset Hub Vault

**Using Remix Polkadot IDE:**

1. Open https://remix.polkadot.io/
2. Load `contracts/V1(Current)/AssetHubVault.sol`
3. Compile with Solidity 0.8.20, optimization: 200 runs
4. Deploy to Paseo Asset Hub:
   * RPC: `https://testnet-passet-hub-eth-rpc.polkadot.io`
   * Chain ID: 420420422
5. Save deployed address

### 2. Deploy Moonbase Infrastructure

```bash
cd SmartContracts

# Deploy Algebra DEX + XCMProxy
npx hardhat run scripts/deploy-moonbase.js --network moonbase
```

This deploys:
- Algebra Factory, Router, Quoter, NFPM
- XCMProxy (with test mode enabled)
- Test tokens and pool

Addresses are saved to `deployments/moonbase_bootstrap.json`

### 3. Configure Contracts

```bash
# Configure AssetHubVault
npx hardhat run scripts/configure-assethub-vault.js --network passethub

# This sets:
# - XCM Precompile address
# - Test mode enabled
# - Trusted settlement caller
# - Supported chains (1000, 1287)
```

### 4. Verify Configuration

```bash
# Run config checks
npx hardhat test test/AssetHubVault/testnet/1.config-check.test.js --network passethub
npx hardhat test test/XCMProxy/testnet/1.config-check.test.js --network moonbase
```

## Network Configuration

| Network | Chain ID | RPC |
|---------|----------|-----|
| Paseo Asset Hub | 420420422 | `https://testnet-passet-hub-eth-rpc.polkadot.io` |
| Moonbase Alpha | 1287 | `https://rpc.api.moonbase.moonbeam.network` |

## XCM Precompile Addresses

| Precompile | Network | Address |
|------------|---------|---------|
| IXcm | Asset Hub | `0x00000000000000000000000000000000000a0000` |
| IXTokens | Moonbeam | `0x0000000000000000000000000000000000000804` |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Transaction is temporarily banned" | Remove explicit `gasPrice` from hardhat config - let it auto-detect |
| Insufficient gas | Increase gas limit in `hardhat.config.js` |
| XCM message failed | Enable test mode (`setTestMode(true)`) |
| Connection timeout | Switch RPC endpoint or retry |

**Next:** [Testing Guide](testing-guide.md) • [Smart Contracts](smart-contracts.md)
