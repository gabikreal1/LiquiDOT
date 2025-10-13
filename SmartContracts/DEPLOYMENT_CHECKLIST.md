# Paseo + Moonbase Deployment Checklist

## Pre-Deployment

- [ ] `.env` file configured with private keys:
  ```bash
  MOON_PK=your_moonbase_private_key
  ASSET_PK=your_paseo_asset_hub_private_key
  ```

- [ ] Accounts funded:
  - [ ] Moonbase: DEV tokens from https://faucet.moonbeam.network/
  - [ ] Paseo Asset Hub: PAS tokens from https://faucet.polkadot.io/

- [ ] Hardhat config verified (`hardhat.config.js`)

## Step 1: Deploy AssetHub Vault (Paseo)

```bash
npx hardhat run scripts/deploy-assethub-paseo.js --network passethub
```

**Save this address:** `ASSETHUB_ADDRESS=0x...`

## Step 2: Deploy XCMProxy (Moonbase)

```bash
npx hardhat run scripts/deploy-xcmproxy-moonbase.js --network moonbase
```

**Save this address:** `XCMPROXY_ADDRESS=0x...`

## Step 3: Configure AssetHub

```bash
ASSETHUB_ADDRESS=0x... \
XCMPROXY_ADDRESS=0x... \
OPERATOR_ADDRESS=0x... \
TEST_MODE=true \
npx hardhat run scripts/configure-assethub.js --network passethub
```

**Verifies:**
- [x] XCM precompile set
- [x] Operator configured  
- [x] Moonbase chain registered
- [x] Test mode enabled

## Step 4: Configure XCMProxy

### 4a. Get Algebra DEX Addresses (if available)

If Algebra Integral is deployed on Moonbase, get addresses:
- `ALGEBRA_QUOTER=0x...`
- `ALGEBRA_ROUTER=0x...`
- `ALGEBRA_NFPM=0x...`

If not available, you'll need to deploy or use alternative DEX.

### 4b. Get Token Addresses

- WDEV (Wrapped DEV): `WDEV_ADDRESS=0x...`
- Other tokens as needed

### 4c. Run Configuration

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

**Verifies:**
- [x] Algebra integrations set
- [x] XCM parameters configured
- [x] Operator set
- [x] AssetHub trusted
- [x] Tokens whitelisted
- [x] Test mode enabled

## Step 5: Test Cross-Chain Flow

### 5a. Deposit on AssetHub

```javascript
const assetHub = await ethers.getContractAt("AssetHubVault", ASSETHUB_ADDRESS);
await assetHub.connect(user).deposit({ value: ethers.parseEther("10") });
```

### 5b. Dispatch Investment

```javascript
await assetHub.connect(operator).dispatchInvestment(
  user.address,
  1287,  // Moonbase
  poolAddress,
  wdevAddress,
  ethers.parseEther("5"),
  -5, 5,
  xcmDestination,
  xcmMessage
);
```

### 5c. Execute on Moonbase

```javascript
const xcmProxy = await ethers.getContractAt("XCMProxy", XCMPROXY_ADDRESS);
await xcmProxy.connect(operator).executePendingInvestment(assetHubPositionId);
```

### 5d. Liquidate and Settle

```javascript
// On Moonbase
await xcmProxy.connect(operator).liquidatePosition(localPositionId);

// On AssetHub
await assetHub.connect(operator).settleLiquidation(positionId, returnAmount, { value: returnAmount });
```

## Troubleshooting

### Deployment fails
- Check account balance
- Verify network connectivity
- Check RPC endpoint status

### Configuration fails  
- Verify you're the contract owner
- Check addresses are correct
- Ensure contracts are deployed

### XCM messages not working
- Disable test mode: `setTestMode(false)`
- Verify XCM precompile addresses
- Check XCM destination encoding
- Ensure sufficient gas/weight

## Production Readiness

Before going to mainnet:

- [ ] All test flows working on testnets
- [ ] Smart contracts audited
- [ ] Emergency procedures tested
- [ ] Monitoring set up
- [ ] Disable test mode
- [ ] Secure private keys (hardware wallet)
- [ ] Set up multisig for owner
- [ ] Document all addresses
- [ ] Test liquidation scenarios
- [ ] Test pause/unpause

## Key Addresses Template

```bash
# Paseo Asset Hub
export ASSETHUB_ADDRESS=0x...

# Moonbase Alpha  
export XCMPROXY_ADDRESS=0x...

# Algebra DEX (Moonbase)
export ALGEBRA_QUOTER=0x...
export ALGEBRA_ROUTER=0x...
export ALGEBRA_NFPM=0x...

# Tokens
export WDEV_ADDRESS=0x...

# Operators
export OPERATOR_ADDRESS=0x...
export EMERGENCY_ADDRESS=0x...
```

Save these in a secure location!

## Quick Commands

### Deploy Both
```bash
# Deploy AssetHub
npx hardhat run scripts/deploy-assethub-paseo.js --network passethub

# Deploy XCMProxy
npx hardhat run scripts/deploy-xcmproxy-moonbase.js --network moonbase
```

### Configure Both
```bash
# Configure AssetHub
ASSETHUB_ADDRESS=0x... XCMPROXY_ADDRESS=0x... OPERATOR_ADDRESS=0x... TEST_MODE=true \
npx hardhat run scripts/configure-assethub.js --network passethub

# Configure XCMProxy
XCMPROXY_ADDRESS=0x... ASSETHUB_ADDRESS=0x... OPERATOR_ADDRESS=0x... TEST_MODE=true \
npx hardhat run scripts/configure-xcmproxy.js --network moonbase
```

### Check Status
```javascript
// AssetHub
const assetHub = await ethers.getContractAt("AssetHubVault", ASSETHUB_ADDRESS);
console.log("Owner:", await assetHub.owner());
console.log("Operator:", await assetHub.operator());
console.log("Test Mode:", await assetHub.testMode());
console.log("Paused:", await assetHub.paused());

// XCMProxy
const xcmProxy = await ethers.getContractAt("XCMProxy", XCMPROXY_ADDRESS);
console.log("Owner:", await xcmProxy.owner());
console.log("Operator:", await xcmProxy.operator());
console.log("Test Mode:", await xcmProxy.testMode());
console.log("Paused:", await xcmProxy.paused());
```

---

**Networks**: Paseo Asset Hub (testnet) ↔ Moonbase Alpha (testnet)
**Status**: Ready for deployment
**Last Updated**: October 13, 2025
