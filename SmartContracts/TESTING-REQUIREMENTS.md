# LiquiDOT Testing Requirements - Milestone 1

## Overview

This document outlines the comprehensive testing and deployment requirements for both AssetHubVault and XCMProxy contracts to satisfy Milestone 1 deliverable requirements.

**Target Test Coverage:** Minimum 80% line coverage, 90%+ for critical paths

**Testing Frameworks:**
- Hardhat (unit & integration tests)
- Foundry (fuzz tests & gas optimization)

**Testing Philosophy:**
- Use **real Algebra contracts** (not mocks) for realistic testing
- Only use dummy addresses for XCM precompiles (test mode skips calls)
- Deploy to testnets with real precompile addresses
- Test with actual pool math, swaps, and liquidity operations

---

## Pre-Testing: Deployment Requirements

Before running tests, you need to deploy contracts locally and to testnets.

### Deployment Order:

1. **Local Hardhat Testing:**
   - Deploy Algebra suite (Factory, NFPM, Router, Quoter)
   - Deploy test ERC20 tokens
   - Deploy XCMProxy
   - Create and initialize test pools
   - Deploy AssetHubVault (or use dummy address for local tests)

2. **Testnet Deployment:**
   - **Asset Hub (Paseo):** Deploy AssetHubVault via Remix
   - **Moonbeam (Moonbase Alpha):** Deploy XCMProxy via Hardhat
   - Save addresses to `deployments/` JSON files

### Local Deployment Script

**File:** `scripts/deploy-local-test-env.js`

This deploys everything needed for local testing (except AssetHubVault which is deployed separately).

### Testnet Deployment Scripts

**For Moonbase Alpha:** `scripts/deploy-moonbase.js` - Deploys XCMProxy and test tokens

**For Paseo Asset Hub:** Deploy manually via Remix (see instructions below)

---

## 1. AssetHubVault Contract Testing

### 1.1 Deployment & Initialization Tests

**File:** `test/AssetHubVault.deployment.test.js`

- [ ] **TEST-AHV-001**: Contract deploys successfully
  - Verify admin, operator, emergency roles set to deployer
  - Verify XCM_PRECOMPILE initialized to address(0)
  - Verify paused = false, xcmPrecompileFrozen = false, testMode = false

- [ ] **TEST-AHV-002**: Initial state variables correct
  - All user balances are 0
  - No positions exist
  - All mappings empty

### 1.2 Access Control Tests

**File:** `test/AssetHubVault.access.test.js`

- [ ] **TEST-AHV-003**: Only admin can call admin functions
  - `setXcmPrecompile()` - should revert if not admin
  - `transferAdmin()` - should revert if not admin
  - `setOperator()` - should revert if not admin
  - `setEmergency()` - should revert if not admin
  - `pause()/unpause()` - should revert if not admin
  - `freezeXcmPrecompile()` - should revert if not admin
  - `setTestMode()` - should revert if not admin

- [ ] **TEST-AHV-004**: Only operator can call operator functions
  - `dispatchInvestment()` - should revert if not operator
  - `settleLiquidation()` - should revert if not operator

- [ ] **TEST-AHV-005**: Only emergency can call emergency functions
  - `emergencyLiquidatePosition()` - should revert if not emergency

- [ ] **TEST-AHV-006**: Admin role can be transferred
  - Transfer admin to new address
  - Old admin can no longer call admin functions
  - New admin can call admin functions

### 1.3 Deposit & Withdrawal Tests

**File:** `test/AssetHubVault.deposit.test.js`

- [ ] **TEST-AHV-007**: User can deposit native tokens
  - Deposit 10 ETH
  - Verify userBalances[user] = 10 ETH
  - Verify Deposit event emitted with correct params
  - Verify contract balance increased

- [ ] **TEST-AHV-008**: Deposit reverts with zero amount
  - Call deposit with msg.value = 0
  - Should revert with AmountZero error

- [ ] **TEST-AHV-009**: Multiple users can deposit independently
  - User A deposits 5 ETH
  - User B deposits 10 ETH
  - Verify balances tracked separately

- [ ] **TEST-AHV-010**: User can withdraw full balance
  - User deposits 10 ETH
  - User withdraws 10 ETH
  - Verify userBalances[user] = 0
  - Verify user received funds
  - Verify Withdrawal event emitted

- [ ] **TEST-AHV-011**: User can withdraw partial balance
  - User deposits 10 ETH
  - User withdraws 6 ETH
  - Verify userBalances[user] = 4 ETH

- [ ] **TEST-AHV-012**: Withdraw reverts with insufficient balance
  - User deposits 5 ETH
  - User attempts to withdraw 10 ETH
  - Should revert with InsufficientBalance error

- [ ] **TEST-AHV-013**: Withdraw reverts with zero amount
  - Should revert with AmountZero error

- [ ] **TEST-AHV-014**: Reentrancy protection on deposit
  - Attempt reentrancy attack during deposit
  - Should revert

- [ ] **TEST-AHV-015**: Reentrancy protection on withdraw
  - Attempt reentrancy attack during withdraw
  - Should revert

### 1.4 Investment Dispatch Tests

**File:** `test/AssetHubVault.investment.test.js`

- [ ] **TEST-AHV-016**: Operator can dispatch investment (test mode)
  - User deposits 100 ETH
  - Operator dispatches 50 ETH investment
  - Verify position created with correct params
  - Verify userBalances[user] reduced by 50 ETH
  - Verify InvestmentInitiated event emitted
  - Verify positionId generated correctly

- [ ] **TEST-AHV-017**: Dispatch investment validates parameters
  - Zero user address → revert ZeroAddress
  - Zero amount → revert AmountZero
  - Invalid range (lower >= upper) → revert InvalidRange
  - Insufficient user balance → revert InsufficientBalance

- [ ] **TEST-AHV-018**: Position ID generation is unique
  - Dispatch 3 investments for same user
  - Verify each gets unique positionId (uses block.timestamp)
  - Verify all positions stored correctly

- [ ] **TEST-AHV-019**: Position stored with correct data
  - Dispatch investment
  - Verify position struct contains:
    - user address
    - poolId
    - baseAsset
    - chainId
    - lowerRangePercent / upperRangePercent
    - timestamp
    - active = true
    - amount

- [ ] **TEST-AHV-020**: User positions array updated
  - User starts with empty positions array
  - Dispatch 2 investments
  - Verify userPositions[user].length = 2
  - Verify both positionIds in array

- [ ] **TEST-AHV-021**: XCM precompile must be set (production mode)
  - Disable test mode
  - XCM_PRECOMPILE = address(0)
  - Dispatch should revert with XcmPrecompileNotSet

- [ ] **TEST-AHV-022**: XCM send skipped in test mode
  - Enable test mode
  - Dispatch investment
  - Verify no XCM call made (test by not setting precompile)
  - Verify position still created

- [ ] **TEST-AHV-023**: Functions revert when paused
  - Admin pauses contract
  - Dispatch investment should revert with Paused error

### 1.5 Liquidation Settlement Tests

**File:** `test/AssetHubVault.liquidation.test.js`

- [ ] **TEST-AHV-024**: Operator can settle liquidation
  - Create active position (50 ETH)
  - Send 60 ETH to contract (simulate XCM return)
  - Operator calls settleLiquidation(positionId, 60 ETH)
  - Verify position.active = false
  - Verify userBalances[user] increased by 60 ETH
  - Verify PositionLiquidated event emitted
  - Verify LiquidationSettled event emitted

- [ ] **TEST-AHV-025**: Settle liquidation validates inputs
  - Zero amount → revert AmountZero
  - Inactive position → revert PositionNotActive
  - Insufficient contract balance → revert

- [ ] **TEST-AHV-026**: Cannot settle same position twice
  - Settle position once
  - Attempt to settle again
  - Should revert PositionNotActive

- [ ] **TEST-AHV-027**: User can withdraw after settlement
  - Position settled with 60 ETH proceeds
  - User withdraws 60 ETH
  - Verify withdrawal succeeds

- [ ] **TEST-AHV-028**: Reentrancy protection on settleLiquidation
  - Attempt reentrancy during settlement
  - Should revert

### 1.6 Emergency Functions Tests

**File:** `test/AssetHubVault.emergency.test.js`

- [ ] **TEST-AHV-029**: Emergency can force liquidate position
  - Create active position
  - Emergency calls emergencyLiquidatePosition(chainId, positionId)
  - Verify position.active = false
  - Verify PositionLiquidated event emitted with amount = 0

- [ ] **TEST-AHV-030**: Emergency liquidate validates chainId
  - Position on chainId 2004
  - Call with wrong chainId
  - Should revert ChainIdMismatch

- [ ] **TEST-AHV-031**: Emergency liquidate only works on active positions
  - Inactive position → revert PositionNotActive

- [ ] **TEST-AHV-032**: Admin can pause/unpause
  - Admin pauses
  - Verify paused = true
  - Admin unpauses
  - Verify paused = false

- [ ] **TEST-AHV-033**: Paused state blocks operations
  - Pause contract
  - dispatchInvestment should revert

### 1.7 Configuration Tests

**File:** `test/AssetHubVault.config.test.js`

- [ ] **TEST-AHV-034**: XCM precompile can be set
  - Set to valid address
  - Verify XCM_PRECOMPILE updated
  - Verify XcmPrecompileSet event emitted

- [ ] **TEST-AHV-035**: XCM precompile cannot be changed when frozen
  - Freeze precompile
  - Attempt to set new address
  - Should revert "xcm precompile frozen"

- [ ] **TEST-AHV-036**: XCM precompile can only be frozen once
  - Freeze once
  - Attempt to freeze again
  - Should revert "already frozen"

- [ ] **TEST-AHV-037**: Test mode can be toggled
  - Set test mode to true
  - Verify testMode = true
  - Set to false
  - Verify testMode = false

### 1.8 View Function Tests

**File:** `test/AssetHubVault.views.test.js`

- [ ] **TEST-AHV-038**: getUserBalance returns correct balance
  - User deposits 50 ETH
  - getUserBalance(user) returns 50 ETH
  - User withdraws 20 ETH
  - getUserBalance(user) returns 30 ETH

- [ ] **TEST-AHV-039**: getPosition returns correct data
  - Create position
  - Call getPosition(positionId)
  - Verify all fields match

- [ ] **TEST-AHV-040**: getUserPositions returns array of positions
  - Create 3 positions for user
  - Call getUserPositions(user)
  - Verify returns array of 3 Position structs
  - Verify data matches created positions

- [ ] **TEST-AHV-041**: isPositionActive works correctly
  - Active position → returns true
  - Liquidated position → returns false
  - Non-existent position → returns false

### 1.9 Edge Cases & Security Tests

**File:** `test/AssetHubVault.security.test.js`

- [ ] **TEST-AHV-042**: Cannot transfer admin to zero address
  - Should revert ZeroAddress

- [ ] **TEST-AHV-043**: Cannot set operator to zero address
  - Should revert ZeroAddress

- [ ] **TEST-AHV-044**: Cannot dispatch investment for zero address user
  - Should revert ZeroAddress

- [ ] **TEST-AHV-045**: Large deposit amounts work correctly
  - Deposit 1000 ETH
  - Verify accounting correct

- [ ] **TEST-AHV-046**: Multiple concurrent positions per user
  - Create 10 positions for same user
  - Verify all tracked correctly
  - Verify getUserPositions returns all 10

- [ ] **TEST-AHV-047**: Contract can receive native tokens directly
  - Send ETH to contract address (not via deposit)
  - Verify contract balance increases
  - This simulates XCM deposits at Substrate level

---

## 2. XCMProxy Contract Testing

### 2.1 Deployment & Initialization Tests

**File:** `test/XCMProxy.deployment.test.js`

- [ ] **TEST-XP-001**: Contract deploys successfully
  - Verify owner set correctly
  - Verify operator set to initialOwner
  - Verify default values set (defaultDestWeight, assetHubParaId, etc.)
  - Verify testMode = false

- [ ] **TEST-XP-002**: Owner can set integrations
  - Set quoter and router addresses
  - Verify addresses stored
  - Set NFPM address
  - Verify stored

### 2.2 Access Control Tests

**File:** `test/XCMProxy.access.test.js`

- [ ] **TEST-XP-003**: Only owner can call owner functions
  - setIntegrations, setNFPM, setXTokensPrecompile, etc.
  - All should revert if not owner

- [ ] **TEST-XP-004**: Only operator can call operator functions
  - executeFullLiquidation, liquidateSwapAndReturn, collectFees
  - Should revert if not operator

- [ ] **TEST-XP-005**: Owner can update operator
  - Set new operator address
  - New operator can call operator functions
  - Old operator cannot

- [ ] **TEST-XP-006**: Owner can pause/unpause
  - Pause contract
  - Operations revert when paused
  - Unpause and operations work

### 2.3 Token & Configuration Tests

**File:** `test/XCMProxy.config.test.js`

- [ ] **TEST-XP-007**: Owner can add supported tokens
  - Add token address
  - Verify supportedTokens[token] = true

- [ ] **TEST-XP-008**: Owner can remove supported tokens
  - Add then remove token
  - Verify supportedTokens[token] = false

- [ ] **TEST-XP-009**: XCM configuration can be set
  - Set xTokensPrecompile, defaultDestWeight, assetHubParaId
  - Verify values stored
  - Verify events emitted

- [ ] **TEST-XP-010**: XCM config cannot be changed when frozen
  - Freeze config
  - Attempt to change
  - Should revert "xcm config frozen"

- [ ] **TEST-XP-011**: Slippage configuration works
  - Set defaultSlippageBps to 100 (1%)
  - Verify stored
  - Set to >10000 should revert

- [ ] **TEST-XP-012**: Test mode can be toggled
  - Enable/disable test mode
  - Verify state changes

### 2.4 Asset Reception Tests

**File:** `test/XCMProxy.receiveAssets.test.js`

- [ ] **TEST-XP-013**: Can receive assets in test mode
  - Enable test mode
  - Transfer tokens to contract
  - Call receiveAssets with investmentParams
  - Verify no authorization revert

- [ ] **TEST-XP-014**: receiveAssets validates inputs
  - Unsupported token → revert "Token not supported"
  - Zero amount → revert "Amount must be greater than 0"
  - Zero user address → revert "Invalid user address"

- [ ] **TEST-XP-015**: receiveAssets checks token balance
  - Call receiveAssets with amount = 100
  - Contract has 50 tokens
  - Should revert "insufficient base funding"

- [ ] **TEST-XP-016**: receiveAssets validates token matches baseAsset
  - Pass token A, baseAsset B
  - Should revert "asset mismatch"

- [ ] **TEST-XP-017**: Authorization works in production mode
  - Disable test mode
  - Set trustedXcmCaller
  - Only owner or trustedXcmCaller can call
  - Others should revert "not authorized"

### 2.5 Investment Execution Tests

**File:** `test/XCMProxy.investment.test.js`

- [ ] **TEST-XP-018**: executeInvestment creates LP position
  - Setup: Deploy mock Algebra pool, NFPM
  - Transfer tokens to contract
  - Call executeInvestment
  - Verify position created
  - Verify positionCounter incremented
  - Verify PositionCreated event emitted

- [ ] **TEST-XP-019**: executeInvestment validates parameters
  - Empty amounts array → revert
  - Invalid range (lower >= upper) → revert
  - Zero position owner → revert
  - Unsupported base asset → revert

- [ ] **TEST-XP-020**: executeInvestment calls NFPM correctly
  - Mock NFPM to track mint calls
  - Execute investment
  - Verify NFPM.mint called with correct params
  - Verify allowances set and reset

- [ ] **TEST-XP-021**: Position stored with correct data
  - Execute investment
  - Verify position struct contains:
    - pool, token0, token1
    - bottomTick, topTick
    - liquidity, tokenId
    - owner, ranges, entryPrice, timestamp
    - active = true

- [ ] **TEST-XP-022**: User positions array updated
  - Execute 3 investments for same user
  - Verify userPositions[user].length = 3

- [ ] **TEST-XP-023**: Slippage applied correctly
  - Pass slippageBps = 100 (1%)
  - amount0Desired = 100
  - Verify amount0Min = 99 (99% of desired)

### 2.6 Tick Range Calculation Tests

**File:** `test/XCMProxy.tickRange.test.js`

- [ ] **TEST-XP-024**: calculateTickRange works for symmetric ranges
  - Pool current tick = 0, spacing = 60
  - lowerRangePercent = -5, upperRangePercent = 5
  - Verify bottomTick ≈ -500, topTick ≈ +500
  - Verify aligned to tickSpacing

- [ ] **TEST-XP-025**: calculateTickRange works for asymmetric ranges
  - lowerRangePercent = -2, upperRangePercent = 10
  - Verify correct tick calculation
  - Verify alignment to spacing

- [ ] **TEST-XP-026**: calculateTickRange validates bounds
  - lowerRangePercent = -1001 → revert "range out of bounds"
  - upperRangePercent = 1001 → revert "range out of bounds"
  - lower >= upper → revert "range out of bounds"

- [ ] **TEST-XP-027**: calculateTickRange uses current pool state
  - Mock pool with currentTick = 10000
  - Calculate range
  - Verify ticks based on 10000, not 0

### 2.7 Position Monitoring Tests

**File:** `test/XCMProxy.monitoring.test.js`

- [ ] **TEST-XP-028**: isPositionOutOfRange detects out of range
  - Create position with ticks [100, 200]
  - Mock pool currentTick = 50 (below range)
  - Verify isPositionOutOfRange returns true

- [ ] **TEST-XP-029**: isPositionOutOfRange detects in range
  - Position ticks [100, 200]
  - currentTick = 150 (in range)
  - Verify returns false

- [ ] **TEST-XP-030**: isPositionOutOfRange validates position exists
  - Non-existent or inactive position
  - Should revert "Position not active"

- [ ] **TEST-XP-031**: getActivePositions returns only active
  - Create 5 positions, liquidate 2
  - Verify getActivePositions returns 3
  - Verify correct positions returned

- [ ] **TEST-XP-032**: getUserPositions returns user's position IDs
  - User A: 3 positions
  - User B: 2 positions
  - Verify getUserPositions(A) returns [1,2,3]
  - Verify getUserPositions(B) returns [4,5]

### 2.8 Liquidation Tests

**File:** `test/XCMProxy.liquidation.test.js`

- [ ] **TEST-XP-033**: executeFullLiquidation works
  - Create position with liquidity
  - Mock NFPM to return tokens on decrease
  - Operator calls executeFullLiquidation
  - Verify position.active = false
  - Verify position.liquidity = 0
  - Verify PositionLiquidated event emitted
  - Verify NFPM.burn called

- [ ] **TEST-XP-034**: executeFullLiquidation only works on active positions
  - Inactive position → revert "Position not active"

- [ ] **TEST-XP-035**: executeFullLiquidation requires NFPM position
  - Position with tokenId = 0 (non-NFPM)
  - Should revert "NFPM position required"

- [ ] **TEST-XP-036**: executeFullLiquidation collects fees
  - Mock NFPM to return fees on collect
  - Liquidate position
  - Verify fees collected and added to returned amounts

- [ ] **TEST-XP-037**: collectFees works without liquidating
  - Create position
  - Mock NFPM to return fees
  - Operator calls collectFees
  - Verify fees collected
  - Verify position still active

### 2.9 Swap & Return Tests

**File:** `test/XCMProxy.swapAndReturn.test.js`

- [ ] **TEST-XP-038**: liquidateSwapAndReturn full flow (test mode)
  - Create position
  - Enable test mode
  - Mock swaps to return baseAsset
  - Call liquidateSwapAndReturn
  - Verify position liquidated
  - Verify swaps executed (if tokens != baseAsset)
  - Verify events emitted (no XTokens call in test mode)

- [ ] **TEST-XP-039**: liquidateSwapAndReturn validates destination
  - Empty destination → revert "invalid destination"

- [ ] **TEST-XP-040**: liquidateSwapAndReturn validates baseAsset
  - Unsupported baseAsset → revert "base not supported"

- [ ] **TEST-XP-041**: liquidateSwapAndReturn swaps token0 to base
  - Position has token0 (not baseAsset)
  - Mock swap router
  - Verify swap called with correct params
  - Verify ProceedsSwapped event

- [ ] **TEST-XP-042**: liquidateSwapAndReturn swaps token1 to base
  - Position has token1 (not baseAsset)
  - Verify swap executed

- [ ] **TEST-XP-043**: liquidateSwapAndReturn skips swap if token IS base
  - Position has baseAsset as token0
  - Verify no swap called for that token
  - Total proceeds = liquidation amount

- [ ] **TEST-XP-044**: liquidateSwapAndReturn enforces minimum out
  - Set minAmountOut0 = 100
  - Mock swap returns 50
  - Should revert on swap

- [ ] **TEST-XP-045**: liquidateSwapAndReturn requires proceeds > 0
  - Mock liquidation returns 0 tokens
  - Should revert "no proceeds"

- [ ] **TEST-XP-046**: liquidateSwapAndReturn emits LiquidationCompleted
  - Execute full flow
  - Verify event with positionId, assetHubPositionId, user, baseAsset, amount

### 2.10 Return Assets Tests

**File:** `test/XCMProxy.returnAssets.test.js`

- [ ] **TEST-XP-047**: returnAssets works in test mode
  - Transfer tokens to contract
  - Enable test mode
  - Call returnAssets
  - Verify events emitted (no XTokens call)

- [ ] **TEST-XP-048**: returnAssets validates inputs
  - Empty destination → revert
  - Unsupported token → revert
  - Amount > balance → revert

- [ ] **TEST-XP-049**: returnAssets sends full balance when amount = 0
  - Contract has 100 tokens
  - Call returnAssets with amount = 0
  - Verify attempts to send 100

- [ ] **TEST-XP-050**: returnAssets manages allowances
  - Mock xTokensPrecompile
  - Track approve calls
  - Verify approves amount, then resets to 0

### 2.11 Swap Helper Tests

**File:** `test/XCMProxy.swap.test.js`

- [ ] **TEST-XP-051**: swapExactInputSingle executes swap
  - Mock swap router
  - Call swapExactInputSingle
  - Verify router called with correct params
  - Verify allowances managed

- [ ] **TEST-XP-052**: quoteExactInputSingle returns quote
  - Mock quoter to return 100 tokens
  - Call quoteExactInputSingle
  - Verify returns 100

- [ ] **TEST-XP-053**: Swap functions require router/quoter set
  - Don't set router
  - Call swap → revert "router not set"
  - Don't set quoter
  - Call quote → revert "quoter not set"

### 2.12 Edge Cases & Security Tests

**File:** `test/XCMProxy.security.test.js`

- [ ] **TEST-XP-054**: Reentrancy protection on receiveAssets
  - Attempt reentrancy attack
  - Should revert

- [ ] **TEST-XP-055**: Reentrancy protection on liquidation functions
  - Attempt reentrancy
  - Should revert

- [ ] **TEST-XP-056**: Paused state blocks all operations
  - Pause contract
  - Test receiveAssets, executeInvestment, liquidations
  - All should revert

- [ ] **TEST-XP-057**: ERC721Holder allows receiving NFPM tokens
  - Mock NFPM transfer
  - Verify contract can receive NFT

- [ ] **TEST-XP-058**: Multiple positions in same pool
  - Create 3 positions in same pool, different ranges
  - Verify all tracked correctly

- [ ] **TEST-XP-059**: Large liquidity amounts work correctly
  - Create position with uint128.max liquidity
  - Verify no overflow issues

- [ ] **TEST-XP-060**: Zero liquidity edge cases
  - Mock NFPM to mint 0 liquidity
  - Verify position still created (but essentially empty)

---

## 3. Integration Tests

**File:** `test/Integration.test.js`

### 3.1 Full Flow Tests (Test Mode)

- [ ] **TEST-INT-001**: Complete investment flow
  1. User deposits to AssetHubVault
  2. Operator dispatches investment
  3. Simulate XCM: transfer tokens to XCMProxy
  4. Call XCMProxy.receiveAssets
  5. Verify position created on Moonbeam
  6. Verify position tracked on Asset Hub

- [ ] **TEST-INT-002**: Complete liquidation flow
  1. Create position on XCMProxy
  2. Operator liquidates position
  3. Simulate XCM: send tokens to AssetHubVault
  4. Operator settles liquidation on AssetHubVault
  5. User withdraws proceeds
  6. Verify balances correct throughout

- [ ] **TEST-INT-003**: Multiple users, multiple positions
  1. User A and B deposit to AssetHub
  2. Create 2 positions for A, 1 for B
  3. Liquidate A's first position
  4. Verify tracking correct for both users

- [ ] **TEST-INT-004**: Emergency liquidation flow
  1. Create position
  2. Emergency admin force liquidates on AssetHub
  3. Position marked inactive
  4. Verify user notified via event

### 3.2 State Consistency Tests

- [ ] **TEST-INT-005**: Balance accounting stays consistent
  - Track total deposits, withdrawals, investments, returns
  - Verify AssetHubVault balance = sum of user balances + active investments

- [ ] **TEST-INT-006**: Position state sync
  - AssetHub thinks position is active
  - XCMProxy liquidates position
  - AssetHub settles liquidation
  - Verify both contracts agree position is inactive

---

## 4. Foundry Fuzz Tests

**File:** `test/foundry/AssetHubVault.t.sol` and `test/foundry/XCMProxy.t.sol`

### 4.1 AssetHubVault Fuzz Tests

- [ ] **TEST-FUZZ-AHV-001**: Fuzz deposit amounts
  - Fuzz amounts from 1 wei to 10000 ether
  - Verify accounting correct for all values

- [ ] **TEST-FUZZ-AHV-002**: Fuzz withdraw amounts
  - Given random balance, fuzz withdraw amounts
  - Verify always correct or reverts appropriately

- [ ] **TEST-FUZZ-AHV-003**: Fuzz investment parameters
  - Fuzz amounts, ranges, addresses
  - Verify correct validation

- [ ] **TEST-FUZZ-AHV-004**: Fuzz multiple operations sequence
  - Random sequence of deposits, withdrawals, investments
  - Verify state always consistent

### 4.2 XCMProxy Fuzz Tests

- [ ] **TEST-FUZZ-XP-001**: Fuzz tick range calculations
  - Fuzz lowerRangePercent, upperRangePercent
  - Verify always valid ticks or reverts

- [ ] **TEST-FUZZ-XP-002**: Fuzz liquidation amounts
  - Fuzz position sizes, swap amounts
  - Verify no overflows or underflows

- [ ] **TEST-FUZZ-XP-003**: Fuzz slippage values
  - Fuzz slippageBps from 0 to 10000
  - Verify slippage calculation always correct

---

## 5. Gas Optimization Tests

**File:** `test/Gas.test.js`

- [ ] **TEST-GAS-001**: Measure deposit gas cost
  - Target: < 50,000 gas

- [ ] **TEST-GAS-002**: Measure withdraw gas cost
  - Target: < 60,000 gas

- [ ] **TEST-GAS-003**: Measure dispatchInvestment gas cost
  - Target: < 150,000 gas

- [ ] **TEST-GAS-004**: Measure receiveAssets + mint position gas cost
  - Target: < 300,000 gas

- [ ] **TEST-GAS-005**: Measure liquidation gas cost
  - Target: < 250,000 gas

---

## 6. Test Coverage Requirements

### Minimum Coverage Targets:

- **Overall Line Coverage:** ≥ 80%
- **Critical Functions Coverage:** ≥ 90%
  - deposit, withdraw
  - dispatchInvestment, settleLiquidation
  - receiveAssets, executeInvestment
  - executeFullLiquidation, liquidateSwapAndReturn

- **Branch Coverage:** ≥ 75%
- **Function Coverage:** 100% (all public/external functions tested)

### Coverage Report:

```bash
# Generate coverage report
npx hardhat coverage

# Verify meets targets
# Lines: >= 80%
# Statements: >= 80%
# Branches: >= 75%
# Functions: 100%
```

---

## 7. Testing Checklist Summary

### Before Milestone 1 Submission:

- [ ] All AssetHubVault tests pass (60+ tests)
- [ ] All XCMProxy tests pass (60+ tests)
- [ ] Integration tests pass (6+ tests)
- [ ] Foundry fuzz tests pass (7+ tests)
- [ ] Test coverage meets requirements (≥80%)
- [ ] Gas tests show acceptable gas usage
- [ ] All contracts compile without warnings
- [ ] Linter passes with no errors
- [ ] Documentation generated from NatSpec comments
- [ ] Test suite can run on CI/CD

### Test Execution Commands:

```bash
# Run all Hardhat tests
npm run test

# Run with coverage
npm run test:coverage

# Run Foundry tests
forge test

# Run fuzz tests
forge test --fuzz-runs 1000

# Run gas report
npm run test:gas

# Run specific test file
npx hardhat test test/AssetHubVault.deposit.test.js
```

---

## 8. Deployment Instructions

### 8.1 Why We Don't Need Mocks

**Key Insight:** With test mode, we don't need mock XCM precompiles!

- ✅ **Test mode skips XCM calls** - precompile addresses just need to be set to *something*
- ✅ **Real precompiles exist on testnets** - use actual addresses there
- ✅ **Use real Algebra contracts** - deploy actual protocol, not mocks

**Total mocks needed: 0** 🎉

### 8.2 Local Hardhat Deployment

**File:** `scripts/deploy-local-test-env.js`

```javascript
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with:", deployer.address);
    
    const deployment = {
        network: "localhost",
        chainId: 31337,
        deployer: deployer.address,
        timestamp: new Date().toISOString()
    };
    
    // 1. Deploy Test ERC20 Tokens
    console.log("\n1. Deploying test tokens...");
    const TestERC20 = await ethers.getContractFactory("TestERC20");
    
    const token0 = await TestERC20.deploy("TestToken0", "TT0");
    await token0.deployed();
    deployment.token0 = token0.address;
    console.log("Token0:", token0.address);
    
    const token1 = await TestERC20.deploy("TestToken1", "TT1");
    await token1.deployed();
    deployment.token1 = token1.address;
    console.log("Token1:", token1.address);
    
    // 2. Deploy XCMProxy
    console.log("\n2. Deploying XCMProxy...");
    const XCMProxy = await ethers.getContractFactory("XCMProxy");
    const xcmProxy = await XCMProxy.deploy(deployer.address);
    await xcmProxy.deployed();
    deployment.xcmProxy = xcmProxy.address;
    console.log("XCMProxy:", xcmProxy.address);
    
    // 3. Configure XCMProxy for testing
    console.log("\n3. Configuring XCMProxy...");
    await xcmProxy.setTestMode(true);
    await xcmProxy.addSupportedToken(token0.address);
    await xcmProxy.addSupportedToken(token1.address);
    
    // Set dummy XTokens address (test mode skips actual calls)
    const XTOKENS_PRECOMPILE = "0x0000000000000000000000000000000000000804";
    await xcmProxy.setXTokensPrecompile(XTOKENS_PRECOMPILE);
    console.log("Test mode enabled, XTokens set to:", XTOKENS_PRECOMPILE);
    
    // 4. Deploy AssetHubVault (for local testing)
    console.log("\n4. Deploying AssetHubVault...");
    const AssetHubVault = await ethers.getContractFactory("AssetHubVault");
    const assetHubVault = await AssetHubVault.deploy();
    await assetHubVault.deployed();
    deployment.assetHubVault = assetHubVault.address;
    console.log("AssetHubVault:", assetHubVault.address);
    
    // 5. Configure AssetHubVault for testing
    console.log("\n5. Configuring AssetHubVault...");
    await assetHubVault.setTestMode(true);
    await assetHubVault.setOperator(deployer.address);
    
    // Set dummy XCM precompile address (test mode skips actual calls)
    const XCM_PRECOMPILE = "0x0000000000000000000000000000000000000808";
    await assetHubVault.setXcmPrecompile(XCM_PRECOMPILE);
    console.log("Test mode enabled, XCM precompile set to:", XCM_PRECOMPILE);
    
    // 6. Save deployment
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    const filename = path.join(deploymentsDir, "localhost.json");
    fs.writeFileSync(filename, JSON.stringify(deployment, null, 2));
    console.log("\n✅ Deployment saved to:", filename);
    
    return deployment;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
```

**Note:** This doesn't deploy Algebra contracts. Use `test/setup/test-environment.js` for that (it's done in test setup).

### 8.3 Moonbase Alpha Deployment

**File:** `scripts/deploy-moonbase.js`

```javascript
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying to Moonbase Alpha with:", deployer.address);
    
    const deployment = {
        network: "moonbase",
        chainId: 1287,
        deployer: deployer.address,
        timestamp: new Date().toISOString()
    };
    
    // 1. Deploy Test ERC20 Tokens (for testing)
    console.log("\n1. Deploying test tokens...");
    const TestERC20 = await ethers.getContractFactory("TestERC20");
    
    const dot = await TestERC20.deploy("Test DOT", "tDOT");
    await dot.deployed();
    deployment.DOT = dot.address;
    console.log("DOT:", dot.address);
    
    const usdc = await TestERC20.deploy("Test USDC", "tUSDC");
    await usdc.deployed();
    deployment.USDC = usdc.address;
    console.log("USDC:", usdc.address);
    
    // 2. Deploy XCMProxy
    console.log("\n2. Deploying XCMProxy...");
    const XCMProxy = await ethers.getContractFactory("XCMProxy");
    const xcmProxy = await XCMProxy.deploy(deployer.address);
    await xcmProxy.deployed();
    deployment.XCMProxy = xcmProxy.address;
    console.log("XCMProxy:", xcmProxy.address);
    
    // 3. Configure XCMProxy
    console.log("\n3. Configuring XCMProxy...");
    
    // Enable test mode (until XCM channel is established)
    await xcmProxy.setTestMode(true);
    console.log("✅ Test mode enabled");
    
    // Add supported tokens
    await xcmProxy.addSupportedToken(dot.address);
    await xcmProxy.addSupportedToken(usdc.address);
    console.log("✅ Tokens added");
    
    // Set XTokens precompile address (REAL Moonbase precompile)
    const XTOKENS_PRECOMPILE = "0x0000000000000000000000000000000000000804";
    await xcmProxy.setXTokensPrecompile(XTOKENS_PRECOMPILE);
    console.log("✅ XTokens precompile set:", XTOKENS_PRECOMPILE);
    
    // Set Asset Hub Para ID
    const ASSET_HUB_PARA_ID = 1000; // Paseo Asset Hub
    await xcmProxy.setAssetHubParaId(ASSET_HUB_PARA_ID);
    console.log("✅ Asset Hub Para ID set:", ASSET_HUB_PARA_ID);
    
    // Set Algebra integrations (if you know the addresses)
    // const ALGEBRA_QUOTER = "0x...";
    // const ALGEBRA_ROUTER = "0x...";
    // const ALGEBRA_NFPM = "0x...";
    // await xcmProxy.setIntegrations(ALGEBRA_QUOTER, ALGEBRA_ROUTER);
    // await xcmProxy.setNFPM(ALGEBRA_NFPM);
    
    // 4. Save deployment
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    const filename = path.join(deploymentsDir, "moonbase.json");
    fs.writeFileSync(filename, JSON.stringify(deployment, null, 2));
    console.log("\n✅ Deployment saved to:", filename);
    
    console.log("\n⚠️  IMPORTANT NEXT STEPS:");
    console.log("1. Set Algebra integrations when you have the addresses");
    console.log("2. Deploy AssetHubVault to Paseo Asset Hub via Remix");
    console.log("3. Disable test mode when XCM channel is established");
    
    return deployment;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
```

### 8.4 Paseo Asset Hub Deployment (via Remix)

Since AssetHub uses pallet-revive (EVM), deploy via Remix:

**Steps:**

1. Open [Remix IDE](https://remix.ethereum.org)
2. Connect to Paseo Asset Hub RPC:
   - Network: Paseo Asset Hub
   - RPC: `https://paseo-asset-hub-rpc.polkadot.io` (or your RPC)
   - Chain ID: TBD (check Paseo docs)

3. Compile `AssetHubVault.sol` with Solidity 0.8.20

4. Deploy the contract

5. After deployment, configure it:
   ```javascript
   // Call these functions via Remix or script
   await assetHubVault.setOperator("0xYourOperatorAddress");
   await assetHubVault.setTestMode(true); // Until XCM works
   
   // Set XCM precompile (REAL Asset Hub precompile)
   const XCM_PRECOMPILE = "0x0000000000000000000000000000000000000808";
   await assetHubVault.setXcmPrecompile(XCM_PRECOMPILE);
   ```

6. Save the deployed address to `deployments/paseo-assethub.json`:
   ```json
   {
     "network": "paseo-assethub",
     "chainId": 1000,
     "deployer": "0xYourAddress",
     "assetHubVault": "0xDeployedContractAddress",
     "timestamp": "2025-01-15T10:00:00.000Z"
   }
   ```

### 8.5 Deployment Address Management

All deployment addresses are saved to `deployments/*.json`:

- `localhost.json` - Local Hardhat deployment
- `moonbase.json` - Moonbase Alpha deployment
- `paseo-assethub.json` - Paseo Asset Hub deployment

**Load addresses in tests:**

```javascript
const moonbaseDeployment = require("../deployments/moonbase.json");
const xcmProxy = await ethers.getContractAt("XCMProxy", moonbaseDeployment.XCMProxy);
```

---

## 9. XCM Message Construction & Testing

### 9.1 Overview

XCM messages need to be pre-built off-chain and passed to `dispatchInvestment`. This section shows how to construct and test XCM messages.

### 9.2 XCM Message Builder Script

**File:** `scripts/utils/xcm-message-builder.js`

```javascript
const { ApiPromise, WsProvider } = require("@polkadot/api");
const { ethers } = require("ethers");

/**
 * Build an XCM message that sends assets + calls receiveAssets on Moonbeam
 * @param {string} assetHubRpc - Asset Hub RPC endpoint
 * @param {object} params - Message parameters
 * @returns {object} { destination, message } both SCALE-encoded
 */
async function buildInvestmentXcmMessage(assetHubRpc, params) {
    const {
        moonbeamParaId,      // e.g., 2004 for Moonbeam
        xcmProxyAddress,     // XCMProxy contract address on Moonbeam
        tokenAddress,        // Token address (e.g., xc-DOT on Moonbeam)
        amount,              // Amount to send
        user,                // User address
        investmentParams     // ABI-encoded investment parameters
    } = params;
    
    // Connect to Asset Hub
    const provider = new WsProvider(assetHubRpc);
    const api = await ApiPromise.create({ provider });
    
    // 1. Build destination multilocation (points to Moonbeam parachain)
    const destination = {
        V3: {
            parents: 1,
            interior: {
                X1: {
                    Parachain: moonbeamParaId
                }
            }
        }
    };
    
    // 2. Encode the receiveAssets function call
    const XCMProxyInterface = new ethers.Interface([
        "function receiveAssets(address token, address user, uint256 amount, bytes memory investmentParams)"
    ]);
    
    const callData = XCMProxyInterface.encodeFunctionData("receiveAssets", [
        tokenAddress,
        user,
        amount,
        investmentParams
    ]);
    
    // 3. Build XCM message instructions
    const message = {
        V3: [
            // Withdraw asset from Asset Hub sovereign account
            {
                WithdrawAsset: [{
                    id: {
                        Concrete: {
                            parents: 0,
                            interior: { Here: null }
                        }
                    },
                    fun: {
                        Fungible: amount
                    }
                }]
            },
            
            // Buy execution on Moonbeam
            {
                BuyExecution: {
                    fees: {
                        id: {
                            Concrete: {
                                parents: 0,
                                interior: { Here: null }
                            }
                        },
                        fun: { Fungible: "1000000000000000000" } // 1 DOT for fees
                    },
                    weightLimit: {
                        Limited: {
                            refTime: "4000000000",
                            proofSize: "200000"
                        }
                    }
                }
            },
            
            // Deposit asset to XCMProxy contract (as ERC20)
            {
                DepositAsset: {
                    assets: {
                        Wild: {
                            AllCounted: 1
                        }
                    },
                    beneficiary: {
                        parents: 0,
                        interior: {
                            X1: {
                                AccountKey20: {
                                    network: null,
                                    key: xcmProxyAddress // XCMProxy address
                                }
                            }
                        }
                    }
                }
            },
            
            // Execute EVM call to receiveAssets
            {
                Transact: {
                    originKind: "SovereignAccount",
                    requireWeightAtMost: {
                        refTime: "3000000000",
                        proofSize: "150000"
                    },
                    call: {
                        encoded: callData
                    }
                }
            }
        ]
    };
    
    // 4. SCALE encode both destination and message
    const encodedDestination = api.createType("XcmVersionedMultiLocation", destination).toU8a();
    const encodedMessage = api.createType("XcmVersionedXcm", message).toU8a();
    
    await api.disconnect();
    
    return {
        destination: ethers.hexlify(encodedDestination),
        message: ethers.hexlify(encodedMessage),
        decoded: { destination, message } // For debugging
    };
}

/**
 * Example: Build investment XCM message
 */
async function example() {
    const investmentParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256[]", "int24", "int24", "address", "uint16"],
        [
            "0xPoolAddress",
            "0xBaseAsset",
            [ethers.parseEther("50"), ethers.parseEther("50")],
            -5,  // lowerRangePercent
            5,   // upperRangePercent
            "0xUserAddress",
            100  // slippageBps
        ]
    );
    
    const xcmMessage = await buildInvestmentXcmMessage(
        "wss://paseo-asset-hub-rpc.polkadot.io",
        {
            moonbeamParaId: 2004,
            xcmProxyAddress: "0xYourXCMProxyAddress",
            tokenAddress: "0xTokenAddress",
            amount: ethers.parseEther("100"),
            user: "0xUserAddress",
            investmentParams
        }
    );
    
    console.log("Destination (hex):", xcmMessage.destination);
    console.log("Message (hex):", xcmMessage.message);
    
    return xcmMessage;
}

module.exports = {
    buildInvestmentXcmMessage,
    example
};
```

### 9.3 Pre-Built XCM Message Examples

For testing, here are example pre-built XCM messages:

**File:** `test/fixtures/xcm-messages.json`

```json
{
  "investmentMessage": {
    "description": "Send 100 DOT + call receiveAssets on Moonbeam",
    "destination": "0x030100001234",
    "message": "0x0300...",
    "params": {
      "amount": "100000000000000000000",
      "poolId": "0xPoolAddress",
      "user": "0xUserAddress",
      "lowerRange": -5,
      "upperRange": 5
    }
  },
  "minimalTransfer": {
    "description": "Simple asset transfer without call",
    "destination": "0x030100001234",
    "message": "0x0300..."
  }
}
```

### 9.4 Testing XCM Messages

**Test that XCM message is correctly formatted:**

```javascript
// test/XCM.message.test.js
const { buildInvestmentXcmMessage } = require("../scripts/utils/xcm-message-builder");
const { expect } = require("chai");

describe("XCM Message Construction", function() {
    
    it("should build valid investment XCM message", async function() {
        const investmentParams = ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address", "uint256[]", "int24", "int24", "address", "uint16"],
            ["0x1234...", "0x5678...", [100, 100], -5, 5, "0xabcd...", 100]
        );
        
        const xcmMessage = await buildInvestmentXcmMessage(
            "wss://paseo-asset-hub-rpc.polkadot.io",
            {
                moonbeamParaId: 2004,
                xcmProxyAddress: "0xProxyAddress",
                tokenAddress: "0xTokenAddress",
                amount: ethers.parseEther("100"),
                user: "0xUserAddress",
                investmentParams
            }
        );
        
        // Verify message structure
        expect(xcmMessage.destination).to.be.a("string");
        expect(xcmMessage.message).to.be.a("string");
        expect(xcmMessage.decoded.message.V3).to.have.lengthOf(4); // 4 instructions
    });
    
    it("should include WithdrawAsset instruction", async function() {
        // Test that first instruction is WithdrawAsset
        const xcmMessage = await buildInvestmentXcmMessage(...);
        const instructions = xcmMessage.decoded.message.V3;
        expect(instructions[0]).to.have.property("WithdrawAsset");
    });
    
    it("should include Transact instruction with correct calldata", async function() {
        // Test that Transact instruction contains receiveAssets call
        const xcmMessage = await buildInvestmentXcmMessage(...);
        const instructions = xcmMessage.decoded.message.V3;
        expect(instructions[3]).to.have.property("Transact");
        
        const callData = instructions[3].Transact.call.encoded;
        // Verify it's a receiveAssets call (first 4 bytes = function selector)
        const selector = callData.slice(0, 10); // 0x + 8 chars
        expect(selector).to.equal("0x..."); // receiveAssets selector
    });
});
```

### 9.5 Manual XCM Testing Without XCM Connection

Even without XCM channels, you can test XCM message construction:

**Test Setup:**

```javascript
// test/AssetHubVault.xcm.test.js
const { buildInvestmentXcmMessage } = require("../scripts/utils/xcm-message-builder");

describe("AssetHubVault XCM Integration", function() {
    
    it("should accept pre-built XCM message in dispatchInvestment", async function() {
        const { assetHubVault } = await setupTestEnvironment();
        
        // Build XCM message (even though it won't be sent in test mode)
        const xcmMessage = await buildInvestmentXcmMessage(...);
        
        // User deposits
        await assetHubVault.connect(user).deposit({ value: ethers.parseEther("100") });
        
        // Dispatch investment with pre-built XCM message
        await expect(
            assetHubVault.connect(operator).dispatchInvestment(
                user.address,
                2004, // Moonbeam
                poolAddress,
                baseAsset,
                ethers.parseEther("100"),
                -5,
                5,
                xcmMessage.destination,
                xcmMessage.message
            )
        ).to.emit(assetHubVault, "InvestmentInitiated");
        
        // In test mode, XCM send is skipped
        // But message format is validated
    });
});
```

### 9.6 XCM Message Format Reference

**Destination Format (Multilocation):**

```javascript
// Points to Moonbeam parachain
{
  V3: {
    parents: 1,  // Go up to relay chain
    interior: {
      X1: {
        Parachain: 2004  // Moonbeam para ID
      }
    }
  }
}
```

**Message Format (XCM Instructions):**

```javascript
{
  V3: [
    { WithdrawAsset: [...] },   // Take assets from sender
    { BuyExecution: {...} },    // Buy execution weight
    { DepositAsset: {...} },    // Deposit to beneficiary
    { Transact: {...} }         // Execute EVM call
  ]
}
```

**For Testing Purposes:**

You can use simplified/dummy messages since test mode skips execution:

```javascript
// Minimal valid message for testing
const dummyDestination = "0x030100001234"; // Any valid SCALE bytes
const dummyMessage = "0x0300010203";       // Any valid SCALE bytes

await assetHubVault.dispatchInvestment(
    user, chainId, pool, asset, amount, -5, 5,
    dummyDestination,
    dummyMessage
);
// ✅ Works in test mode!
```

### 9.7 Where XCM Messages Are Built

**In Production:**

1. **Backend Service** builds XCM messages off-chain
2. Calls `AssetHubVault.dispatchInvestment()` with pre-built message
3. Contract sends the message via XCM precompile

**File Structure:**

```
Backend/
├── services/
│   └── xcm-message-builder.service.js  ← Builds messages
├── workers/
│   └── investment-decision-worker.js   ← Calls contract with messages
SmartContracts/
├── scripts/
│   └── utils/
│       └── xcm-message-builder.js      ← Shared utility
```

This way, the complex XCM encoding logic lives in the backend/scripts, and contracts just accept and forward the messages!

---

## 10. CI/CD Integration

**File:** `.github/workflows/test.yml`

Required CI/CD checks:
- [ ] All Hardhat tests pass
- [ ] All Foundry tests pass
- [ ] Coverage ≥ 80%
- [ ] Gas usage within acceptable limits
- [ ] Linter passes
- [ ] Contracts compile

---

## Notes:

- Tests should be written in parallel with contract development
- Each PR should include tests for new functionality
- Use descriptive test names that explain what's being tested
- Group related tests in describe blocks
- Use beforeEach hooks to reduce code duplication
- Mock external dependencies (Algebra, NFPM, etc.)
- Test both happy paths and error cases
- Include edge cases and boundary conditions
- Ensure tests are deterministic (no random failures)
- Tests should run in < 5 minutes total

**Total Tests Required:** ~130+ tests across both contracts

**Estimated Testing Time:** 
- Writing tests: 3-4 days
- Creating mocks: 1 day
- Integration tests: 1 day
- Debugging & coverage: 1-2 days
- **Total: ~7 days** (matches Week 1 timeline)

