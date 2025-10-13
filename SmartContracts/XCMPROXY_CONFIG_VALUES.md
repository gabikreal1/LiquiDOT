# XCMProxy Configuration Values for Moonbase

## After Deploying XCMProxy on Moonbase

Once you deploy XCMProxy via Remix on Moonbase Alpha, use these values for configuration:

### Network Info
- **Network**: Moonbase Alpha (Testnet)
- **Chain ID**: 1287
- **RPC**: https://rpc.api.moonbase.moonbeam.network

### Required Configurations

#### 1. XCM Parameters

```solidity
// xTokens Precompile (for cross-chain transfers)
setXTokensPrecompile("0x0000000000000000000000000000000000000804")

// Asset Hub Para ID
setAssetHubParaId(1000)

// Default XCM destination weight
setDefaultDestWeight(6000000000)  // 6 billion
```

#### 2. Set Operator
```solidity
setOperator("YOUR_OPERATOR_ADDRESS")
```

#### 3. Set Trusted XCM Caller (AssetHub Address)
```solidity
setTrustedXcmCaller("YOUR_ASSETHUB_ADDRESS_ON_PASEO")
```

#### 4. Add Supported Tokens

You'll need to add token addresses that can be used:

```solidity
// Example: Wrapped DEV (WDEV)
addSupportedToken("WDEV_ADDRESS_ON_MOONBASE")

// Add other tokens as needed
addSupportedToken("TOKEN_ADDRESS")
```

#### 5. Enable Test Mode (for testing)
```solidity
setTestMode(true)
```

### Algebra DEX Integration (If Available)

If Algebra Integral is deployed on Moonbase:

```solidity
// Set quoter and router together
setIntegrations("ALGEBRA_QUOTER_ADDRESS", "ALGEBRA_ROUTER_ADDRESS")

// Set NFPM (Nonfungible Position Manager)
setNFPM("ALGEBRA_NFPM_ADDRESS")
```

**Note**: If Algebra is not deployed on Moonbase, you may need to:
1. Deploy Algebra contracts yourself, or
2. Adapt the contract to use a different DEX (Uniswap V3, etc.)

### Configuration Order

Do configurations in this order:

1. ✅ Deploy XCMProxy (constructor takes owner address)
2. ✅ Set XCM parameters (precompile, para ID, weight)
3. ✅ Set operator
4. ✅ Set trusted caller (AssetHub address)
5. ✅ Add supported tokens
6. ✅ Set Algebra integrations (if available)
7. ✅ Enable test mode
8. ⏳ Update AssetHub with this XCMProxy address

## XCM Destination Encoding

### From AssetHub to Moonbase

When adding Moonbase chain to AssetHub, use:

```
XCM Destination: 0x0001000100a10f041300c10f030400010300
```

This encodes:
```
MultiLocation {
  parents: 1,
  interior: X1(Parachain(1000))
}
```

### From Moonbase to AssetHub

When XCMProxy sends back to AssetHub:
```
Destination multilocation for Asset Hub from Moonbase
```

## Token Addresses on Moonbase

### Native Token (DEV)
- Moonbase uses DEV token natively
- For DEX operations, you need WDEV (Wrapped DEV)

### Finding Token Addresses

Check Moonbase block explorer or documentation for:
- WDEV address
- Other test tokens
- DEX pair addresses

## Testing Configuration

### Verify Settings
```solidity
// Check XCM settings
xTokensPrecompile()  // Should return 0x0000...0804
assetHubParaId()     // Should return 1000
defaultDestWeight()  // Should return 6000000000

// Check operator
operator()           // Should return operator address

// Check trusted caller
trustedXcmCaller()   // Should return AssetHub address

// Check test mode
testMode()           // Should return true

// Check token support
supportedTokens("TOKEN_ADDRESS")  // Should return true
```

### Test receiveAssets (Manual Test)

Once configured, you can manually test:

```solidity
receiveAssets(
  bytes32 assetHubPositionId,  // Use ethers.id("test-1")
  address token,                // Supported token address
  address beneficiary,          // Your address
  uint256 amount,              // Test amount
  bytes memory params          // Encoded params
)
```

This creates a pending position.

### Test executePendingInvestment

```solidity
executePendingInvestment(bytes32 assetHubPositionId)
```

Operator executes the pending investment.

## Configuration Checklist

Use this checklist:

### XCMProxy Deployment
- [ ] Deployed to Moonbase Alpha
- [ ] Address saved: `0x...`
- [ ] Owner verified (your address)

### XCM Configuration
- [ ] xTokens precompile set (`0x...0804`)
- [ ] Asset Hub para ID set (1000)
- [ ] Default weight set (6000000000)

### Access Control
- [ ] Operator set
- [ ] Trusted caller set (AssetHub address)

### Tokens
- [ ] WDEV added to supported tokens
- [ ] Other tokens added as needed

### DEX Integration
- [ ] Algebra quoter set (or N/A)
- [ ] Algebra router set (or N/A)
- [ ] Algebra NFPM set (or N/A)

### Testing
- [ ] Test mode enabled
- [ ] Manual test: receiveAssets
- [ ] Manual test: executePendingInvestment

### AssetHub Update
- [ ] AssetHub configured with XCMProxy address
- [ ] Moonbase chain added via `addChain()`

## Common Issues

### "Token not supported"
- Add token via `addSupportedToken(tokenAddress)`

### "Only operator"
- Make sure you call from operator address
- Verify operator is set: `operator()`

### "Trusted caller mismatch"
- Verify AssetHub address is set correctly
- Check: `trustedXcmCaller()`

### Algebra functions fail
- Verify DEX addresses are set
- Check: `quoterContract()`, `swapRouterContract()`, `nfpmContract()`

## Next Steps After Configuration

1. Update AssetHub with XCMProxy address
2. Test deposit on AssetHub
3. Test dispatchInvestment (in test mode)
4. Monitor events
5. Test full cross-chain flow
6. Disable test mode for production

## Save Configuration

Document your deployment:

```
XCMProxy Deployment
===================
Date: __________
Network: Moonbase Alpha (1287)
Address: 0x_________________________________

Configuration:
- xTokens Precompile: 0x0000000000000000000000000000000000000804
- Asset Hub Para ID: 1000
- Default Weight: 6000000000
- Operator: 0x_________________________________
- Trusted Caller (AssetHub): 0x_________________________________
- Test Mode: ✓ Enabled

Supported Tokens:
- WDEV: 0x_________________________________
- Token2: 0x_________________________________

Algebra DEX:
- Quoter: 0x_________________________________ (or N/A)
- Router: 0x_________________________________ (or N/A)
- NFPM: 0x_________________________________ (or N/A)

Status: Configured / Testing / Production
```

---

**Network**: Moonbase Alpha (Testnet)
**Configuration Tool**: Remix IDE
**Status**: Ready for configuration after deployment
