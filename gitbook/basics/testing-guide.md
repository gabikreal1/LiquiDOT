---
icon: vial
---

# Testing Guide

How to run the LiquiDOT smart-contract test suites now that everything targets live testnets.

## Prerequisites

- Install deps: `cd SmartContracts && npm install`
- Export the deployed addresses (example from `.env`):
  ```bash
  export ASSETHUB_CONTRACT=0x67E5293e374219C515bD9838B23C792C555e51D4
  export XCMPROXY_CONTRACT=0xf935e063b2108cc064bB356107ac01Dc90f96652
  export PRIVATE_KEY=<moonbase_private_key>
  ```
- Ensure `deployments/moonbase_bootstrap.json` (or `MOONBASE_*` env vars) already lists the Algebra tokens, pool, and NFPM built during bootstrap.

## Helper Workflow

Run the bundled helpers in the order below before executing tests. Each lives in `SmartContracts/test/helpers/`.

1. `npx hardhat run test/helpers/link-contracts.js --network passethub`
2. `npx hardhat run test/helpers/link-contracts.js --network moonbase`
3. `npx hardhat run test/helpers/enable-test-mode.js --network passethub`
4. `npx hardhat run test/helpers/provide-liquidity.js --network moonbase`
5. `npx hardhat run test/helpers/verify-xcmproxy-config.js --network moonbase`

The `provide-liquidity.js` helper assumes the pool and tokens already exist; it does not deploy new contracts. If the bootstrap file is missing entries, re-run `npx hardhat run scripts/deploy-moonbase.js --network moonbase` first.

## Test Commands

```bash
# Asset Hub Vault (Paseo Asset Hub)
npx hardhat test test/AssetHubVault/testnet/**/*.test.js --network passethub

# Moonbase XCM Proxy (Moonbase Alpha)
npx hardhat test test/XCMProxy/testnet/**/*.test.js --network moonbase

# Cross-chain integration flow
npx hardhat test test/Integration/testnet/**/*.test.js --network passethub
```


```bash


## Coverage & Expectations

- 5 AssetHubVault testnet specs (config, deposits, investment, liquidation, emergency)
- 5 XCMProxy testnet specs (config through emergency)
- 1 guided integration test exercising the end-to-end flow
- Tests are idempotent and expect existing deployments; they will skip automatically if required addresses/env vars are absent.

**Next:** [Contract Deployment](contract-deployment.md) • [Smart Contracts](smart-contracts.md)
