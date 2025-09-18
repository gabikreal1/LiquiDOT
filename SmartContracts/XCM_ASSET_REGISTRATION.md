# XCM Asset Registration Instructions

This guide explains how to programmatically create assets on Asset Hub and register them on Moonbase Alpha with proper multilocation mapping.

## Prerequisites

1. **Chopsticks running** with both Asset Hub and Moonbase Alpha forks
2. **Test environment** set up with proper dependencies

## Setup

1. **Start Chopsticks with Asset Hub:**
```bash
npx @acala-network/chopsticks@latest --config=local-dev/chopsticks/asset-hub-config.yml
```

2. **Start Chopsticks with Moonbase Alpha (in another terminal):**
```bash
npx @acala-network/chopsticks@latest --config=local-dev/chopsticks/moonbase-config.yml
```

3. **Install dependencies:**
```bash
cd SmartContracts
npm install @polkadot/keyring @polkadot/util-crypto
```

## Environment Variables

Set these environment variables before running:

```bash
export MOON_WS="ws://localhost:8001"      # Chopsticks Moonbase endpoint
export ASSET_HUB_WS="ws://localhost:8000" # Chopsticks Asset Hub endpoint
export MOON_CHAIN_ID=1287                 # Moonbase Alpha chain ID
export SUDO_SEED="//Alice"                # Sudo account for testnet operations
```

## Running the Registration

Execute the XCM asset registration test:

```bash
npm test -- --grep "XCM Asset Registration"
```

Or run the specific test file:

```bash
npx mocha test/papi/00_xcm_asset_registration.papi.spec.ts
```

## What the Script Does

### Phase 1: Asset Hub Operations

#### Step 1: Create Asset on Asset Hub
- Creates a new asset with a randomly generated ID (1M+ range)
- Sets Alice as the admin/owner
- Configures minimum balance requirements

#### Step 2: Set Asset Metadata on Asset Hub
- Sets asset name: "TestAsset"
- Sets asset symbol: "TEST"
- Sets decimals: 18

#### Step 3: Mint Initial Supply
- Mints 1,000,000 tokens to Alice's account
- Provides liquidity for testing XCM transfers

### Phase 2: Moonbase Operations

#### Step 4: Create Foreign Asset on Moonbase
- Creates corresponding foreign asset with same ID
- Sets EVM-compatible owner address
- Configures as sufficient for transaction fees

#### Step 5: Set Asset Metadata on Moonbase
- Mirrors the metadata from Asset Hub
- Ensures consistency across chains

#### Step 6: Register XCM Location Mapping
- Maps the asset to Asset Hub multilocation:
  ```json
  {
    "parents": 1,
    "interior": {
      "X2": [
        { "Parachain": 1000 },
        { "GeneralIndex": [ASSET_ID] }
      ]
    }
  }
  ```

### Phase 3: Verification
- Queries asset details on both chains
- Verifies metadata consistency
- Checks location mapping (if available)
- Confirms cross-chain asset setup

## Expected Output

```
Using Asset ID: 1234567

✓ creates asset on Asset Hub
  Step 1: Creating asset on Asset Hub...
  Asset created on Asset Hub successfully
  Step 2: Setting asset metadata on Asset Hub...
  Metadata set on Asset Hub successfully
  Step 3: Minting initial supply on Asset Hub...
  Tokens minted on Asset Hub successfully
  Asset 1234567 created successfully on Asset Hub

✓ registers foreign asset on Moonbase with multilocation
  Step 1: Creating foreign asset on Moonbase...
  Foreign asset created on Moonbase successfully
  Step 2: Setting asset metadata on Moonbase...
  Metadata set on Moonbase successfully
  Step 3: Registering XCM location mapping...
  Location mapping registered successfully
  XCM Asset Registration completed successfully
  Asset ID: 1234567

✓ verifies asset exists on both chains
  Verifying asset on Asset Hub...
  Verifying foreign asset on Moonbase...
  Cross-chain asset verification completed successfully
```

## Troubleshooting

### Common Issues

1. **"Cannot find pallet" error:**
   - Verify Chopsticks is running with correct Moonbase config
   - Check that `EvmForeignAssets` pallet exists on the runtime

2. **Transaction fails:**
   - Ensure Alice account has sudo permissions
   - Check that asset ID doesn't already exist
   - Verify multilocation format is correct

3. **Location mapping fails:**
   - Some runtimes may not support direct location registration
   - Use Chopsticks storage override as fallback
   - Check runtime documentation for correct extrinsic

### Manual Storage Override

If direct registration fails, add to `moonbase-config.yml`:

```yaml
import-storage:
  EvmForeignAssets:
    AssetsById:
      - - 1000000000000
        - owner: "0x6Be02d1d3665660d22FF9624b7BE0551ee1Ac91b"
          issuer: "0x6Be02d1d3665660d22FF9624b7BE0551ee1Ac91b"
          admin: "0x6Be02d1d3665660d22FF9624b7BE0551ee1Ac91b"
          freezer: "0x6Be02d1d3665660d22FF9624b7BE0551ee1Ac91b"
          supply: 1000000000000000000000000
          deposit: 0
          minBalance: 1
          isSufficient: true
          accounts: 0
          sufficients: 0
          approvals: 0
          status: "Live"
```

## Integration with Other Tests

This registration should be run before other XCM-related tests that depend on the foreign asset being available. The test is numbered `00_` to ensure it runs first in the test suite.

## Next Steps

After successful registration:
1. Run liquidity pool creation tests
2. Test XCM transfers from Asset Hub
3. Verify DEX integration with foreign assets
4. Test cross-chain swaps and liquidation