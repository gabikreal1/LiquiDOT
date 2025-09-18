# Smart Contracts for Chopsticks Development

## 🚀 Quick Start

### Prerequisites
- Asset Hub Chopsticks running on `localhost:8000`
- Moonbase Alpha Chopsticks running on `localhost:8001`

### Installation
```bash
cd SmartContracts
npm install
```

### Compilation
```bash
npm run compile
```

## 📋 Available Scripts

### Deployment Scripts
```bash
# Deploy to Asset Hub Chopsticks
npm run deploy:chopsticks:assethub

# Deploy to Moonbase Alpha Chopsticks  
npm run deploy:chopsticks:moonbase

# Deploy to both networks
npm run deploy:chopsticks:all
```

### Testing Scripts
```bash
# Test Asset Hub deployments
npm run test:chopsticks:assethub

# Test Moonbase deployments
npm run test:chopsticks:moonbase

# Test XCM interactions
npx hardhat run scripts/test-xcm-interaction.js
```

### Utility Scripts
```bash
# Check contract sizes
npm run size

# Clean artifacts
npm run clean
```

## 📄 Deployment Details

### Asset Hub Chopsticks (`localhost:8000`)
**Deployed Contracts:**
- `MockERC20_DOT` - DOT token for testing
- `MockERC20_USDC` - USDC token for testing  
- `AssetHubVault` - Main vault contract with **proper SCALE-encoded XCM**
- `XCMEncoder` - Library for SCALE encoding XCM messages and MultiLocations

### Moonbase Alpha Chopsticks (`localhost:8001`)
**Deployed Contracts:**
- `MockERC20_GLMR` - GLMR token for testing
- `MockERC20_USDT` - USDT token for testing
- `XCMProxy` - Cross-chain proxy contract

## 🔗 XCM Integration Details

### Real SCALE Encoding Implementation
The `AssetHubVault` contract now includes:

- **Proper SCALE encoding** for XCM messages and MultiLocations
- **Real XCM instruction sequences** (WithdrawAsset, BuyExecution, Transact, DepositAsset)
- **Correct MultiLocation format** for Parachain navigation
- **Proper Weight calculation** for XCM execution
- **Complete VersionedXcm wrapper** with version 3

### XCM Features Available:
- ✅ Simple asset transfers to Moonbase Alpha
- ✅ Reserve transfers with contract calls
- ✅ Proper SCALE-encoded MultiLocations
- ✅ Real XCM instruction opcodes
- ✅ Weight estimation via XCM precompile
- ✅ Support for native DOT and Asset Hub assets

## 📁 Deployment Storage

All deployments are automatically saved to:
```
deployments/
├── assetHubChopsticks.json
└── moonbaseChopsticks.json
```

Each deployment file contains:
- Contract addresses
- Deployment transaction hashes
- Constructor arguments
- Gas usage
- Timestamps

## 🔧 Network Configuration

The `hardhat.config.js` is configured with:

### Chopsticks Networks
- **assetHubChopsticks**: `http://localhost:8000` (Chain ID: 420420420)
- **moonbaseChopsticks**: `http://localhost:8001` (Chain ID: 1287)

### Development Accounts
- Uses standard Moonbeam development accounts (Alith, etc.)
- Private keys are safely configured for local testing

## ⚙️ XCM Contract Configuration

After deployment, configure cross-chain parameters via admin setters:

### On Moonbase (XCMProxy)
- Set precompile and weights:
  - `setXTokensPrecompile(address precompile)`
  - `setDefaultDestWeight(uint64 weight)`
- Set destination parachain/account encoding:
  - `setAssetHubParaId(uint32 paraId)` (Asset Hub paraId on the same relay)
  - `setDestUseAccountKey20(bool enabled)` (true = AccountKey20, false = AccountId32)
- Security for XCM entrypoint:
  - `setTrustedXcmCaller(address caller)`

Returning proceeds to Asset Hub vault (pallet_revive):
- Set `setAssetHubVaultRemote(address vaultAccountOnAssetHub)` to direct XTokens deposits to the vault contract account.
- When `recipient == address(0)`, `returnAssets` and `liquidateSwapAndReturn` will send to this account via XTokens using the encoded MultiLocation `(Parents=1, Parachain(assetHubParaId), AccountKey20/AccountId32(vault))`.

Used by functions:
- `returnAssets(token, user, amount, recipient)` with `recipient == address(0)` will send via XTokens to Asset Hub, using proper MultiLocation encoding.
- `liquidateSwapAndReturn(positionId, baseAsset, recipient, minOut0, minOut1, limitSqrtPrice)` returns proceeds similarly.

### On Asset Hub (AssetHubVault)
- Configure XCM precompile address (depends on runtime):
  - `setXcmPrecompile(address precompile)`
- Destination MultiLocations:
  - `setDestinationMultiLocation(bytes destination)` or helpers `setDestinationToMoonbase*`

Notes:
- The XCM “Transact” call requires a SCALE-encoded runtime call on the destination chain. This repo avoids hardcoding those encodings; compose them off-chain or via pallets when needed.
- Para IDs and network IDs differ across Paseo/Moonbase/Local; do not hardcode. Use the setters per environment.

## 🧪 Testing Strategy

### 1. Contract Deployment Testing
- Verify all contracts deploy successfully
- Check constructor arguments
- Validate initial state

### 2. Contract Functionality Testing  
- Test ERC20 operations (transfer, approve, etc.)
- Test vault operations
- Test XCM proxy functions

### 3. Cross-Chain Testing
- Simulate XCM message passing
- Test asset transfers between chains
- Verify liquidity operations

## 🛠️ Development Workflow

1. **Start Chopsticks**:
   ```bash
   # Terminal 1: Asset Hub
   npx @acala-network/chopsticks -c westend-asset-hub -p 8000
   
   # Terminal 2: Moonbase Alpha  
   npx @acala-network/chopsticks -c moonbase-alpha -p 8001
   ```

2. **Deploy Contracts**:
   ```bash
   npm run deploy:chopsticks:all
   ```

3. **Test Deployments**:
   ```bash
   npm run test:chopsticks:assethub
   npm run test:chopsticks:moonbase
   ```

4. **Test XCM**:
   ```bash
   npx hardhat run scripts/test-xcm-interaction.js
   ```

## 🔗 Explorer Access

Access deployed contracts via Polkadot.js Apps:

- **Asset Hub**: https://polkadot.js.org/apps/?rpc=ws%3A%2F%2Flocalhost%3A8000#/explorer
- **Moonbase Alpha**: https://polkadot.js.org/apps/?rpc=ws%3A%2F%2Flocalhost%3A8001#/explorer

## ⚡ Pro Tips

- Use `npm run size` to monitor contract sizes
- Check `deployments/*.json` for exact contract addresses
- All scripts include comprehensive error handling
- Deployments are idempotent - safe to run multiple times

## 🐛 Troubleshooting

### Common Issues:

1. **Connection Refused**: Ensure Chopsticks networks are running
2. **Gas Estimation Failed**: Check network connectivity and account balance
3. **Contract Not Found**: Verify deployment was successful in `deployments/` folder

### Debug Commands:
```bash
# Check network connectivity
npx hardhat run scripts/test-deployments.js --network assetHubChopsticks

# Verify contract addresses
cat deployments/assetHubChopsticks.json | jq '.contracts'
```
