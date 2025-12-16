# LiquiDOT Test Suite

Testnet-first guide for running the LiquiDOT smart-contract suites on Paseo Asset Hub and Moonbase Alpha. This mirrors the GitBook “Testing Guide (Testnet)” so everything stays in sync.
## Prerequisites

- Testnet funds
   - Moonbase DEV: https://faucet.moonbeam.network/
   - Paseo Asset Hub DOT: https://faucet.polkadot.io/
- Environment variables (in shell or `.env` inside `SmartContracts/`)

```bash
export MOON_PK="0x..."      # Moonbase deployer key
export ASSET_PK="0x..."     # Asset Hub deployer key
export MOONBASE_RPC="https://rpc.api.moonbase.moonbeam.network"  # optional override
export ASSETHUB_RPC="https://testnet-passet-hub-eth-rpc.polkadot.io"  # optional override
```

Install dependencies once:
```bash
cd SmartContracts
npm install
```

## 1. Deploy Contracts

1. **AssetHubVault (Paseo Asset Hub)** – Deploy via Remix:
   - Open https://remix.polkadot.io/
   - Load `contracts/V1(Current)/AssetHubVault.sol`
   - Deploy with the Asset Hub key
   - Record the address and export it for later steps:

```powershell
$env:ASSETHUB_CONTRACT="0xYourAssetHubVault"
```

2. **Moonbase infrastructure (Algebra + XCMProxy + test tokens/pool)**

```powershell
cd SmartContracts
npx hardhat run scripts/deploy-moonbase.js --network moonbase
```

The script deploys Algebra, configures XCMProxy (test mode on), creates two test tokens, and initializes a pool. It writes `deployments/moonbase_bootstrap.json`, which downstream helpers/tests consume.

## 2. Wire Contracts Across Chains

Set the deployed Moonbase proxy address (from the deploy output or bootstrap file):

```powershell
$env:XCMPROXY_CONTRACT="0xYourXCMProxy"
```

Run the helper scripts (all live in `test/helpers/`):
```bash
# Add Moonbase Alpha to AssetHubVault's chain registry
npx hardhat run test/helpers/link-contracts.js --network passethub

# Set AssetHubVault as trusted caller on XCMProxy
npx hardhat run test/helpers/link-contracts.js --network moonbase

# Enable safe test mode on AssetHubVault (bypasses XCM during tests)
npx hardhat run test/helpers/enable-test-mode.js --network passethub

Optional but recommended before Moonbase tests:
```bash
# Seeds the Algebra pool using addresses from the bootstrap file
npx hardhat run test/helpers/provide-liquidity.js --network moonbase

# Sanity check configuration once wiring is complete
npx hardhat run test/helpers/verify-xcmproxy-config.js --network moonbase

```

The liquidity helper only mints positions against the existing pool; it does **not** deploy contracts. If the bootstrap file is missing entries, rerun the deployment script.

## 3. Run Tests

All suites are testnet-ready and read addresses from env vars + `deployments/moonbase_bootstrap.json`.
```bash
# Paseo Asset Hub (AssetHubVault)
npx hardhat test test/AssetHubVault/testnet/**/*.test.js --network passethub

# Moonbase Alpha (XCMProxy)
npx hardhat test test/XCMProxy/testnet/**/*.test.js --network moonbase

# Cross-chain guided flow (initiates from Asset Hub)
npx hardhat test test/Integration/testnet/**/*.test.js --network passethub

Refer to `.test-commands.md` for additional permutations or single-spec invocations.

## Directory Reference

```
test/
├── AssetHubVault/testnet/   # 5 specs covering config → emergency
├── XCMProxy/testnet/        # 5 specs covering config → emergency
├── Integration/testnet/     # Guided end-to-end flow
├── helpers/                 # Wiring + diagnostics scripts (see above)
├── logs/                    # Captured outputs from save-test-log.sh
└── .test-commands.md        # Quick command reference

## Expectations & Troubleshooting
- Tests are idempotent and tolerate existing state (deposits/liquidity carry over between runs).
- Suites skip automatically if required env vars or bootstrap data are missing.
- Ensure the signer has enough DEV / DOT for any state-changing helper.
