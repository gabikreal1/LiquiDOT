# Deploy AssetHubVault via Remix

## Quick Deployment Guide

### 1. Open Remix
Go to https://remix.ethereum.org/

### 2. Create Contract File
- Create new file: `AssetHubVault.sol`
- Copy the entire contract from `/contracts/V1(Current)/AssetHubVault.sol`
- Make sure to include all dependencies (OpenZeppelin imports will auto-load)

### 3. Compile
- Select Solidity Compiler tab
- Compiler version: `0.8.28` or compatible
- Enable optimization (200 runs recommended)
- Click "Compile AssetHubVault.sol"

### 4. Deploy to Paseo Asset Hub

#### Network Setup in MetaMask
Add Paseo Asset Hub network:
- **Network Name**: Paseo Asset Hub
- **RPC URL**: `https://testnet-passet-hub-eth-rpc.polkadot.io`
- **Chain ID**: `420420422`
- **Currency Symbol**: `PAS`
- **Block Explorer**: (if available)

#### Deploy Contract
1. Go to "Deploy & Run Transactions" tab
2. Environment: Select "Injected Provider - MetaMask"
3. Verify network shows "Paseo Asset Hub (420420422)"
4. Select contract: `AssetHubVault`
5. Constructor has no parameters
6. Click "Deploy"
7. Confirm transaction in MetaMask

### 5. Save Deployed Address
After deployment, copy the contract address from Remix console.

**Save this address:** `ASSETHUB_ADDRESS = 0x...`

## Post-Deployment Configuration

After deploying, you need to configure the contract. Use Remix's "At Address" feature or interact via scripts.

### Required Configurations

#### 1. Set XCM Precompile
```solidity
setXcmPrecompile("0x0000000000000000000000000000000000000808")
```

#### 2. Set Operator
```solidity
setOperator("YOUR_OPERATOR_ADDRESS")
```

#### 3. Add Moonbase as Execution Chain
```solidity
addChain(
  1287,                                        // Moonbase chainId
  "0x0001000100a10f041300c10f030400010300",  // XCM destination
  "Moonbase Alpha",                           // Chain name
  "XCMPROXY_ADDRESS_ON_MOONBASE"              // XCMProxy address
)
```

#### 4. Enable Test Mode (for testing)
```solidity
setTestMode(true)
```

### Configuration via Remix

1. In "Deployed Contracts" section, expand your AssetHubVault
2. Find each function and fill in parameters
3. Click the function button to execute
4. Confirm in MetaMask

### Example: Adding Moonbase Chain

**Function:** `addChain`

**Parameters:**
- `chainId`: `1287`
- `xcmDestination`: `0x0001000100a10f041300c10f030400010300`
- `chainName`: `Moonbase Alpha`
- `executor`: `[your XCMProxy address on Moonbase]`

Click "transact" and confirm in MetaMask.

## Verification Checklist

After configuration, verify settings:

### Check Owner
```solidity
owner() // Should return your address
```

### Check Operator
```solidity
operator() // Should return operator address
```

### Check XCM Precompile
```solidity
xcmPrecompile() // Should return 0x0000000000000000000000000000000000000808
```

### Check Moonbase Chain
```solidity
supportedChains(1287)
// Should return: exists=true, chainName="Moonbase Alpha", etc.
```

```solidity
chainExecutors(1287)
// Should return: XCMProxy address
```

### Check Test Mode
```solidity
testMode() // Should return true (for testing)
```

## Testing Deposits

Once configured, test with a small deposit:

### Deposit Function
```solidity
deposit() payable
```

**Value:** `0.1` PAS (in Wei: 100000000000000000)

Click "transact" and confirm.

### Check Balance
```solidity
getUserBalance("YOUR_ADDRESS")
```

Should show your deposited amount.

## Important Notes

### Gas Settings
- Use sufficient gas limit (default usually works)
- Gas price: 1 Gwei typically works on Paseo

### Test Mode
- **Enabled**: XCM messages are NOT actually sent (for testing)
- **Disabled**: XCM messages are sent to other chains

Start with test mode enabled until you've deployed and configured XCMProxy on Moonbase.

### Security
- **Owner**: Can add chains, set precompiles, pause contract
- **Operator**: Can dispatch investments, settle liquidations
- **Emergency**: Can emergency liquidate (set via `setEmergency()`)

### Common Functions

#### Owner Functions (Only Contract Owner)
- `addChain()` - Add execution chain
- `removeChain()` - Remove chain
- `updateChainExecutor()` - Update executor address
- `setXcmPrecompile()` - Set XCM precompile
- `setOperator()` - Set operator
- `setEmergency()` - Set emergency address
- `pause()` / `unpause()` - Pause/unpause contract
- `setTestMode()` - Enable/disable test mode

#### Operator Functions
- `dispatchInvestment()` - Send investment to execution chain
- `settleLiquidation()` - Settle returned funds

#### User Functions
- `deposit()` - Deposit funds
- `withdraw()` - Withdraw available balance
- `getUserBalance()` - Check balance
- `getUserPositions()` - View positions

## Next Steps

1. ✅ Deploy AssetHubVault via Remix
2. ✅ Configure basic settings (precompile, operator)
3. ⏳ Deploy XCMProxy on Moonbase (can also use Remix)
4. ✅ Add Moonbase chain with XCMProxy address
5. 🧪 Test deposit
6. 🧪 Test dispatchInvestment (in test mode)
7. 🔗 Deploy XCMProxy and test full cross-chain flow

## Troubleshooting

### Transaction Fails
- Check you have enough PAS for gas
- Verify you're connected to correct network
- Check you're calling from owner account (for owner functions)

### Function Not Found
- Make sure contract is compiled with correct Solidity version
- Verify you deployed the correct contract

### "Only owner" Error
- Verify the calling address matches `owner()`
- Use the deployment account for configuration

### Chain Already Exists
- Use `removeChain(1287)` first, then add again
- Or use `updateChainExecutor(1287, newAddress)`

## Fund Your Accounts

Before deploying:
- **Paseo Faucet**: https://faucet.polkadot.io/
- Request PAS tokens for gas fees

## Contract Address Template

Save this information:

```
Deployment Date: __________
Network: Paseo Asset Hub (420420422)

AssetHub Address: 0x_________________________________
Owner Address: 0x_________________________________
Operator Address: 0x_________________________________
Emergency Address: 0x_________________________________

XCMProxy Address (Moonbase): 0x_________________________________

Configuration:
- XCM Precompile: ✓ Set
- Operator: ✓ Set  
- Moonbase Chain: ✓ Added
- Test Mode: ✓ Enabled

First Deposit: _____ PAS
Status: Working / Testing / Production
```

---

**Network**: Paseo Asset Hub (Testnet)
**Tool**: Remix IDE
**Next**: Deploy XCMProxy on Moonbase Alpha
