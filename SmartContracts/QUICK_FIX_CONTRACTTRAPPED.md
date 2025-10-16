# Quick Reference: Fixing ContractTrapped Errors

## The Problem
```
❌ Error: ContractTrapped
Cause: getUserPositions() returns too much data (60+ positions)
Why: Substrate EVM has stricter memory limits than standard Ethereum
```

## The Solution (3 Options)

### Option 1: Add Pagination Functions (Recommended for Production)

**Add to contract:**
```solidity
function getUserPositionCount(address user) external view returns (uint256) {
    return userPositions[user].length;
}

function getUserPositionsPage(
    address user,
    uint256 start,
    uint256 count
) external view returns (Position[] memory) {
    // ... implementation in PAGINATION_SOLUTION.md
}
```

**Use in tests:**
```javascript
const total = await vault.getUserPositionCount(user);
const pageSize = 10;
for (let i = 0; i < total; i += pageSize) {
    const positions = await vault.getUserPositionsPage(user, i, pageSize);
    // Process page
}
```

**Status:** ✅ Best solution, requires contract update + redeploy

---

### Option 2: Use Filtered Queries (Also requires contract update)

**Add to contract:**
```solidity
function getUserPositionsByStatus(
    address user,
    PositionStatus status,
    uint256 maxResults
) external view returns (Position[] memory) {
    // ... implementation in PAGINATION_SOLUTION.md
}
```

**Use in tests:**
```javascript
// Get only active positions (much smaller array)
const active = await vault.getUserPositionsByStatus(user, 1, 20);
```

**Status:** ✅ More efficient than pagination, requires contract update

---

### Option 3: Quick Test Fix (No Contract Changes)

**Add helper to test files:**
```javascript
async function getPositionStatsSafe(vault, user) {
    try {
        const positions = await vault.getUserPositions(user);
        return {
            total: positions.length,
            pending: positions.filter(p => Number(p[7]) === 0).length,
            active: positions.filter(p => Number(p[7]) === 1).length,
            liquidated: positions.filter(p => Number(p[7]) === 2).length
        };
    } catch (error) {
        if (error.message.includes('ContractTrapped')) {
            console.log('   ⚠️  Too many positions - skipping detailed check');
            return { total: 'unknown', pending: 0, active: 0, liquidated: 0 };
        }
        throw error;
    }
}

// Use in tests:
it("should display position summary", async function () {
    const stats = await getPositionStatsSafe(vault, admin.address);
    console.log(`Total: ${stats.total}, Active: ${stats.active}`);
});
```

**Status:** ⚠️ Workaround only, doesn't fix root cause

---

## Recommended Page Sizes

| Data Type | Page Size | Reason |
|-----------|-----------|--------|
| Position IDs (bytes32[]) | 50-100 | Lightweight, 32 bytes each |
| Position Structs (Position[]) | 10-20 | Heavy, ~320 bytes each |
| Filtered Results | 20-50 | Depends on filter efficiency |

---

## Gas Costs

| Function | Gas | Use Case |
|----------|-----|----------|
| `getUserPositionCount()` | ~3K | Always call first |
| `getUserPositionsPage(user, 0, 10)` | ~28K | Paginate through all |
| `getUserPositionsByStatus(user, 1, 20)` | ~65K | Get specific status |
| `getUserPositionStats()` | ~53K | Dashboard overview |

---

## Implementation Priority

### For Current Testing
1. ✅ Use try/catch wrapper (Option 3) - **Immediate**
2. ✅ Skip detailed position checks in summary tests
3. ✅ Focus on functional tests (dispatch, settle, etc.)

### For Production Deployment
1. 🔧 Add pagination functions (Option 1) - **Required**
2. 🔧 Add filter functions (Option 2) - **Recommended**
3. 🔧 Add stats function for dashboards
4. 📝 Update frontend to use pagination
5. 📝 Document page size limits

---

## Files to Update

**Contract:**
- `contracts/V1(Current)/AssetHubVault.sol`
  - Add functions from `PAGINATION_SOLUTION.md`

**Tests (if contract updated):**
- `test/AssetHubVault/testnet/3.investment.test.js` - Line 186, 193, 322, 411
- `test/AssetHubVault/testnet/4.liquidation.test.js` - Line 328, 399, 502
- `test/AssetHubVault/testnet/5.emergency.test.js` - Line 121, 373

**Frontend (when ready):**
- Add pagination components
- Use `getUserPositionStats()` for dashboards
- Implement lazy loading for position lists

---

## Quick Decision Tree

```
Do you have 50+ positions accumulated?
│
├─ YES → Need pagination
│   │
│   ├─ Can redeploy contract?
│   │   ├─ YES → Add pagination functions ✅
│   │   └─ NO → Use try/catch workaround ⚠️
│   │
│   └─ Is this production?
│       ├─ YES → MUST add pagination ✅
│       └─ NO → Workaround acceptable ⚠️
│
└─ NO → Current function works fine ✅
    └─ But add pagination preventively!
```

---

## Testing After Fix

```bash
# Test with pagination functions added
npx hardhat test test/AssetHubVault/testnet/*.test.js --network passethub

# Expected: All 51 tests passing (no ContractTrapped errors)
```

---

## TL;DR

**Problem:** `getUserPositions()` fails with 60+ positions  
**Root Cause:** Substrate EVM memory limits  
**Quick Fix:** Wrap in try/catch, skip on error  
**Proper Fix:** Add pagination functions, redeploy  
**Best Practice:** Always use pagination in production  

📖 See `PAGINATION_SOLUTION.md` for full implementation
📖 See `VIEW_FUNCTION_LIMITS_EXPLAINED.md` for technical details
