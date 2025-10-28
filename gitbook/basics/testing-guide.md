---
icon: beaker
---

# Testing Guide (Testnet)

End-to-end steps to test LiquiDOT on Moonbase Alpha and Paseo Asset Hub using the current deployment scripts and helpers.

## Prerequisites

- Testnet funds:
  - Moonbase Alpha (DEV): https://faucet.moonbeam.network/
  - Paseo Asset Hub DOT: https://faucet.paseo.network/
- Environment (.env in `SmartContracts/`):

```powershell
# Private keys
$env:MOON_PK="0x..."   # Moonbase deployer
$env:ASSET_PK="0x..."  # Asset Hub deployer

# Optional RPC overrides
$env:MOONBASE_RPC="https://rpc.api.moonbase.moonbeam.network"
$env:ASSETHUB_RPC="https://testnet-passet-hub-eth-rpc.polkadot.io"
```

## 1) Deploy contracts

1. Deploy AssetHubVault (Paseo Asset Hub) via Remix:
   - Open https://remix.polkadot.network/
   - Load `contracts/V1(Current)/AssetHubVault.sol`
   - Deploy with your Asset Hub key and copy the address
   - Set for later steps:

```powershell
$env:ASSETHUB_CONTRACT="0xYourAssetHubVault"
```

2. Deploy Moonbase infrastructure (Algebra + XCMProxy + test tokens + pool init):

```powershell
cd SmartContracts
npx hardhat run scripts/deploy-moonbase.js --network moonbase
```

What this does:
- Deploys Algebra (Factory/Router/Quoter/NFPM)
- Deploys and configures XCMProxy (test mode enabled)
- Deploys two test tokens (USDC/USDT)
- Creates and initializes a pool for those tokens
- Saves `deployments/moonbase_bootstrap.json` for tests to auto-discover addresses

Note: Initial liquidity is intentionally NOT provided during deployment. You can add it later with the helper.

## 2) Wire contracts across chains

Set the deployed XCMProxy address (from deploy output or `deployments/moonbase_bootstrap.json`):

```powershell
$env:XCMPROXY_CONTRACT="0xYourXCMProxy"
```

Link contracts on both networks and enable safe test mode on Asset Hub:

```powershell
# Add Moonbase to AssetHubVault chain registry
npx hardhat run test/helpers/link-contracts.js --network passethub

# Set AssetHubVault as trusted caller on XCMProxy
npx hardhat run test/helpers/link-contracts.js --network moonbase

# Enable test mode on AssetHubVault (bypasses XCM for testing)
npx hardhat run test/helpers/enable-test-mode.js --network passethub
```

Optional: seed liquidity on Moonbase (recommended for manual experiments):

```powershell
# Uses pool and token addresses from the bootstrap file by default
npx hardhat run test/helpers/provide-liquidity.js --network moonbase

# Optionally tweak amounts/ticks
$env:LP_AMOUNT0="500"; $env:LP_AMOUNT1="500"
$env:MOONBASE_NFPM="0x..."  # If you want to override NFPM
```

## 3) Run tests

The tests auto-read `deployments/moonbase_bootstrap.json` via `test/XCMProxy/testnet/config.js`.

```powershell
# XCMProxy tests
npx hardhat test test/XCMProxy/testnet/1.config-check.test.js --network moonbase
npx hardhat test test/XCMProxy/testnet/2.receive-assets.test.js --network moonbase
npx hardhat test test/XCMProxy/testnet/3.execute-position.test.js --network moonbase

# AssetHubVault tests
npx hardhat test test/AssetHubVault/testnet/**/*.test.js --network passethub

# Integration (guided) tests
npx hardhat test test/Integration/testnet/**/*.test.js --network passethub
```

## Notes and Troubleshooting

- Liquidity: The deploy script does not add liquidity. Use `test/helpers/provide-liquidity.js` if needed.
- Trusted caller: If `$env:ASSETHUB_CONTRACT` is set before deployment, the script passes it to XCMProxy; otherwise set it with the link helper on Moonbase.
- Low DEV funds: Fund the Moonbase account from the faucet.
- Address discovery: Use `SmartContracts/deployments/moonbase_bootstrap.json` for all addresses required by tests.

**Next:** [Smart Contracts](smart-contracts.md)
 
