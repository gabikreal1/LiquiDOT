# LiquiDOT Test Suite# LiquiDOT Test Suite



Testnet-first guide for running the LiquiDOT smart-contract suites on Paseo Asset Hub and Moonbase Alpha.Testnet-first guide for running the LiquiDOT smart-contract suites on Paseo Asset Hub and Moonbase Alpha. This mirrors the GitBook “Testing Guide (Testnet)” so everything stays in sync.

## Prerequisites

## Current Testnet Deployments

- Testnet funds

| Contract | Network | Address |   - Moonbase DEV: https://faucet.moonbeam.network/

|----------|---------|---------|   - Paseo Asset Hub DOT: https://faucet.polkadot.io/

| AssetHubVault | Paseo Asset Hub | `0x68e86F267C5C37dd4947ef8e5823eBAeAf93Fde6` |- Environment variables (in shell or `.env` inside `SmartContracts/`)

| XCMProxy | Moonbase Alpha | `0x7f4b3620d6Ffcc15b11ca8679c57c076DCE109d1` |

```bash

## Prerequisitesexport MOON_PK="0x..."      # Moonbase deployer key

export ASSET_PK="0x..."     # Asset Hub deployer key

- Testnet fundsexport MOONBASE_RPC="https://rpc.api.moonbase.moonbeam.network"  # optional override

   - Moonbase DEV: https://faucet.moonbeam.network/export ASSETHUB_RPC="https://testnet-passet-hub-eth-rpc.polkadot.io"  # optional override

   - Paseo PAS: https://faucet.paseo.network/```

- Environment variables (in shell or `.env` inside `SmartContracts/`)

Install dependencies once:

```bash```bash

export MOON_PK="0x..."      # Moonbase deployer key (with 0x prefix)cd SmartContracts

export ASSET_PK="0x..."     # Asset Hub deployer key (with 0x prefix)npm install

export ASSETHUB_CONTRACT="0x68e86F267C5C37dd4947ef8e5823eBAeAf93Fde6"```

export XCMPROXY_CONTRACT="0x7f4b3620d6Ffcc15b11ca8679c57c076DCE109d1"

```## 1. Deploy Contracts



Install dependencies once:1. **AssetHubVault (Paseo Asset Hub)** – Deploy via Remix:

```bash   - Open https://remix.polkadot.io/

cd SmartContracts   - Load `contracts/V1(Current)/AssetHubVault.sol`

npm install   - Deploy with the Asset Hub key

```   - Record the address and export it for later steps:



## Test Suite Structure```powershell

$env:ASSETHUB_CONTRACT="0xYourAssetHubVault"

### AssetHubVault Tests (Paseo Asset Hub)```



Located in `test/AssetHubVault/testnet/`:2. **Moonbase infrastructure (Algebra + XCMProxy + test tokens/pool)**



| File | Description | Test IDs |```powershell

|------|-------------|----------|cd SmartContracts

| `1.config-check.test.js` | Configuration verification | TEST-AHV-001 to 006 |npx hardhat run scripts/deploy-moonbase.js --network moonbase

| `2.deposits.test.js` | Deposit/Withdraw flows | TEST-AHV-007 to 015 |```

| `3.investment.test.js` | Investment dispatch | TEST-AHV-016 to 023 |

| `4.liquidation.test.js` | Liquidation settlement | TEST-AHV-024 to 028 |The script deploys Algebra, configures XCMProxy (test mode on), creates two test tokens, and initializes a pool. It writes `deployments/moonbase_bootstrap.json`, which downstream helpers/tests consume.

| `5.emergency.test.js` | Emergency functions | TEST-AHV-029 to 033 |

| `6.security-checks.test.js` | Security validation | Security checks |## 2. Wire Contracts Across Chains



### XCMProxy Tests (Moonbase Alpha)Set the deployed Moonbase proxy address (from the deploy output or bootstrap file):



Located in `test/XCMProxy/testnet/`:```powershell

$env:XCMPROXY_CONTRACT="0xYourXCMProxy"

| File | Description |```

|------|-------------|

| `1.config-check.test.js` | Configuration verification |Run the helper scripts (all live in `test/helpers/`):

| `2.receive-assets.test.js` | Asset reception |```bash

| `3.execute-position.test.js` | Position execution |# Add Moonbase Alpha to AssetHubVault's chain registry

| `4.liquidation.test.js` | Liquidation flows |npx hardhat run test/helpers/link-contracts.js --network passethub

| `5.emergency.test.js` | Emergency functions |

# Set AssetHubVault as trusted caller on XCMProxy

## Running Testsnpx hardhat run test/helpers/link-contracts.js --network moonbase



### AssetHubVault Tests# Enable safe test mode on AssetHubVault (bypasses XCM during tests)

npx hardhat run test/helpers/enable-test-mode.js --network passethub

```bash

# Run individual test filesOptional but recommended before Moonbase tests:

npx hardhat test test/AssetHubVault/testnet/1.config-check.test.js --network passethub```bash

npx hardhat test test/AssetHubVault/testnet/2.deposits.test.js --network passethub# Seeds the Algebra pool using addresses from the bootstrap file

npx hardhat test test/AssetHubVault/testnet/3.investment.test.js --network passethubnpx hardhat run test/helpers/provide-liquidity.js --network moonbase

npx hardhat test test/AssetHubVault/testnet/4.liquidation.test.js --network passethub

npx hardhat test test/AssetHubVault/testnet/5.emergency.test.js --network passethub# Sanity check configuration once wiring is complete

npx hardhat test test/AssetHubVault/testnet/6.security-checks.test.js --network passethubnpx hardhat run test/helpers/verify-xcmproxy-config.js --network moonbase



# Run all AssetHubVault tests (list files explicitly)```

npx hardhat test test/AssetHubVault/testnet/1.config-check.test.js test/AssetHubVault/testnet/2.deposits.test.js test/AssetHubVault/testnet/3.investment.test.js test/AssetHubVault/testnet/4.liquidation.test.js test/AssetHubVault/testnet/5.emergency.test.js test/AssetHubVault/testnet/6.security-checks.test.js --network passethub

```The liquidity helper only mints positions against the existing pool; it does **not** deploy contracts. If the bootstrap file is missing entries, rerun the deployment script.



### XCMProxy Tests## 3. Run Tests



```bashAll suites are testnet-ready and read addresses from env vars + `deployments/moonbase_bootstrap.json`.

# Run individual test files```bash

npx hardhat test test/XCMProxy/testnet/1.config-check.test.js --network moonbase# Paseo Asset Hub (AssetHubVault)

npx hardhat test test/XCMProxy/testnet/2.receive-assets.test.js --network moonbasenpx hardhat test test/AssetHubVault/testnet/**/*.test.js --network passethub

npx hardhat test test/XCMProxy/testnet/3.execute-position.test.js --network moonbase

```# Moonbase Alpha (XCMProxy)

npx hardhat test test/XCMProxy/testnet/**/*.test.js --network moonbase

## Test Results Summary

# Cross-chain guided flow (initiates from Asset Hub)

Latest test run (January 2026):npx hardhat test test/Integration/testnet/**/*.test.js --network passethub

- **AssetHubVault**: 61 passing, 5 pending

- **XCMProxy**: 57 passing, 0 failingRefer to `.test-commands.md` for additional permutations or single-spec invocations.



## Test Mode## Directory Reference



Both contracts support a `testMode` flag that allows testing without actual XCM calls:```

test/

- **AssetHubVault**: Skips XCM send, allows operator to confirm/settle locally├── AssetHubVault/testnet/   # 5 specs covering config → emergency

- **XCMProxy**: Skips XCM return transfers├── XCMProxy/testnet/        # 5 specs covering config → emergency

├── Integration/testnet/     # Guided end-to-end flow

Enable via admin functions:├── helpers/                 # Wiring + diagnostics scripts (see above)

```javascript├── logs/                    # Captured outputs from save-test-log.sh

await vault.setTestMode(true);└── .test-commands.md        # Quick command reference

await proxy.setTestMode(true);

```## Expectations & Troubleshooting

- Tests are idempotent and tolerate existing state (deposits/liquidity carry over between runs).

## Directory Reference- Suites skip automatically if required env vars or bootstrap data are missing.

- Ensure the signer has enough DEV / DOT for any state-changing helper.

```
test/
├── AssetHubVault/
│   └── testnet/             # 6 specs covering config → security
│       ├── 1.config-check.test.js
│       ├── 2.deposits.test.js
│       ├── 3.investment.test.js
│       ├── 4.liquidation.test.js
│       ├── 5.emergency.test.js
│       ├── 6.security-checks.test.js
│       └── helpers.js       # Shared test utilities
├── XCMProxy/
│   └── testnet/             # 5 specs covering config → emergency
├── Integration/
│   └── testnet/             # Guided end-to-end flow
├── helpers/                 # Wiring + diagnostics scripts
└── logs/                    # Captured test outputs
```

## Troubleshooting

### "Transaction is temporarily banned"
The Paseo Asset Hub requires higher gas prices (~1000 Gwei). The hardhat config should auto-detect this. If you see this error, remove any explicit `gasPrice` from the network config.

### "Priority is too low"
This happens when transactions are submitted too quickly. The testnet mempool rejects transactions with stale nonces. Wait a few seconds between transactions or increase the delay in tests.

### Timeouts
Some tests take 2-4 minutes due to testnet block times. The tests have appropriate timeouts configured (120-240s).

### Missing Environment Variables
Ensure `ASSETHUB_CONTRACT` and `ASSET_PK` are set correctly in your `.env` file.
