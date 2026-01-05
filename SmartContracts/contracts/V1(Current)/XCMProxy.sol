// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol";
import "@cryptoalgebra/integral-periphery/contracts/interfaces/INonfungiblePositionManager.sol";
import "@cryptoalgebra/integral-periphery/contracts/interfaces/ISwapRouter.sol";
import "@cryptoalgebra/integral-periphery/contracts/interfaces/IQuoter.sol";
import "@cryptoalgebra/integral-periphery/contracts/libraries/LiquidityAmounts.sol";
import "@cryptoalgebra/integral-core/contracts/libraries/TickMath.sol";
import "@cryptoalgebra/integral-core/contracts/libraries/FullMath.sol";


int24 constant MIN_TICK = -887272;
int24 constant MAX_TICK =  887272;
uint256 constant SCALE_1E6 = 1_000_000;        
uint256 constant SCALE_SQRT_AUX = 1_000_000_000_000; 



// Minimal XTokens precompile interface (ABI-compatible placeholder)
interface IXTokens {
    function transfer(
        address token,
        uint256 amount,
        bytes calldata dest,
        uint64 destWeight
    ) external;
}

// XCM Transactor precompile interface (top-level)
interface IXCMTransactor {
    function transactThroughDerivative(
        uint32 destination,
        uint16 feeLocation,
        uint64 transactRequiredWeightAtMost,
        bytes calldata /*call*/,
        uint256 /*feeAmount*/,
        uint64 /*overallWeight*/
    ) external;
}

/**
 * @title XCMProxy
 * @dev Cross-chain execution engine for LiquiDOT on Moonbeam
 *
 * DEX INTEGRATION: Algebra Integral (StellaSwap Pulsar)
 * -----------------------------------------------------
 * This contract is built for Algebra Integral (cryptoalgebra/integral-* npm packages) which
 * includes the `deployer` field in mint/swap parameters.
 *
 * TARGET DEX: StellaSwap Pulsar on Moonbeam
 * StellaSwap uses Algebra Integral v1.2 (stellaswap/Integral-contracts on GitHub).
 * The interfaces are COMPATIBLE - StellaSwap includes the `deployer` field.
 *
 * LIQUIDATION MODEL: Operator-Triggered
 * -------------------------------------
 * Liquidations are NOT automated on-chain. The backend monitors positions using
 * isPositionOutOfRange() and triggers liquidation via executeFullLiquidation() or
 * liquidateSwapAndReturn() when conditions are met.
 *
 * SINGLE-SIDED LIQUIDITY (OPERATOR RESPONSIBILITY):
 * --------------------------------------------------
 * When minting LP positions, token requirements depend on current price vs tick range:
 * - Price below range (currentTick < bottomTick): only token0 needed
 * - Price above range (currentTick > topTick): only token1 needed  
 * - Price within range: BOTH tokens required in correct ratio
 *
 * OPERATOR MUST calculate token amounts BEFORE dispatching investment:
 * 1. Read pool.globalState() to get currentTick
 * 2. Calculate bottomTick/topTick using calculateTickRange()
 * 3. If currentTick is INSIDE [bottomTick, topTick]:
 *    - Use LiquidityAmounts.getAmountsForLiquidity() to compute required ratio
 *    - Swap incoming token to get both token0 and token1 in correct proportions
 *    - Populate amounts[0] and amounts[1] accordingly
 * 4. If currentTick is OUTSIDE the range:
 *    - Only one token is needed (token0 if below, token1 if above)
 *
 * Failure to provide correct token amounts will cause mint to fail or result in
 * suboptimal liquidity positioning.
 *
 * DEX TARGET: StellaSwap Pulsar (Algebra Integral v1.2)
 * -----------------------------------------------------
 * This contract targets StellaSwap Pulsar on Moonbeam, which uses Algebra Integral v1.2.
 * The interfaces imported (from cryptoalgebra/integral-*) include the `deployer` field in
 * mint/swap parameters, which is compatible with StellaSwap's deployment.
 *
 * Target Addresses (Moonbeam):
 * - Factory: 0x... (See deployments/moonbase_bootstrap.json)
 * - Router: 0x...
 * - Quoter: 0x...
 * - NFPM: 0x...
 */
contract XCMProxy is Ownable, ReentrancyGuard, Pausable, ERC721Holder {
    using SafeERC20 for IERC20;

    // Custom Errors
    error PendingPositionNotFound();
    error SwapRouterNotSet();
    error SwapZeroOutput();
    error InsufficientSwappedFunding();
    error InsufficientToken0();
    error InsufficientToken1();
    error NFPMNotSet();
    error ZeroLiquidityPreview();
    error QuoterNotSet();
    error XTokensNotSet();
    error InvalidDestination();
    error BaseAssetNotSupported();
    error PositionNotActive();
    error PositionNotLiquidated();
    error RangeOutOfBounds();
    error InvalidPercent();
    error NotOperator();
    error BpsTooHigh();
    error XcmConfigAlreadyFrozen();
    error TokenNotSupported();
    error AmountZero();
    error InvalidUser();
    error PositionAlreadyPending();
    error XcmTransferFailed();
    error UnauthorizedCaller();

    // State variables
    mapping(address => bool) public supportedTokens;
    mapping(uint256 => Position) public positions;
    mapping(address => uint256[]) public userPositions;
    uint256 public positionCounter;
    
    // Pending positions awaiting execution
    mapping(bytes32 => PendingPosition) public pendingPositions;
    mapping(bytes32 => uint256) public assetHubPositionToLocalId; // assetHubPositionId => local positionId

    // External integrations
    address public quoterContract;
    address public swapRouterContract;
    address public nfpmContract;

    // XCM configuration (set per-network during deployment)
    address public xTokensPrecompile; // e.g., 0x...0804 on Moonbeam-family chains
    uint64 public defaultDestWeight; // conservative default; tune per target chain
    uint32 public assetHubParaId; // target Asset Hub parachain id on the same relay
    address public trustedXcmCaller; // optional: derived XCM caller or allowed system caller
    bool public xcmConfigFrozen; // freeze flag to prevent further config changes

    // Moonbeam XCM Transactor precompile (variant that supports transactThroughDerivative)
    address public xcmTransactorPrecompile; // e.g., 0x0000...0806 on some runtimes

    // Slippage configuration (basis points, 1 = 0.01%) for NFPM mint operations
    uint16 public defaultSlippageBps; // e.g., 100 = 1%

    // Operator role for day-to-day execution
    address public operator;
    
    // Test mode - allows direct contract calls without XCM for local testing
    bool public testMode;

    // Config events
    event XTokensPrecompileSet(address indexed precompile);
    event DefaultDestWeightSet(uint64 weight);
    event AssetHubParaIdSet(uint32 paraId);
    event TrustedXcmCallerSet(address indexed caller);
    event XcmConfigFrozen();

    // Events
    event AssetsReceived(
        address indexed token,
        address indexed user,
        uint256 amount,
        bytes investmentParams
    );
    event PendingPositionCreated(
        bytes32 indexed assetHubPositionId,
        address indexed user,
        address token,
        uint256 amount,
        address poolId
    );
    event PositionExecuted(
        bytes32 indexed assetHubPositionId,
        uint256 indexed localPositionId,
        uint256 nfpmTokenId,
        uint128 liquidity
    );
    event PositionCreated(
        uint256 indexed positionId,
        address indexed user,
        address pool,
        address token0,
        address token1,
        int24 bottomTick,
        int24 topTick,
        uint128 liquidity
    );
    event PositionLiquidated(
        uint256 indexed positionId,
        address indexed user,
        uint256 amount0,
        uint256 amount1
    );

    event LiquidityAdded(
        address indexed pool,
        address indexed recipient,
        int24 bottomTick,
        int24 topTick,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
    );

    // Proceeds/XCM return events
    event AssetsReturned(
        address indexed token,
        address indexed user,
        bytes destination,
        uint256 amount,
        uint256 positionId
    );

    event ProceedsSwapped(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 positionId
    );

    event OperatorUpdated(address indexed operator);
    
    event LiquidationCompleted(
        uint256 indexed positionId,
        bytes32 assetHubPositionId,
        address indexed user,
        address baseAsset,
        uint256 totalReturned
    );
    
    event PendingPositionCancelled(
        bytes32 indexed assetHubPositionId,
        address indexed user,
        uint256 refundAmount
    );

    // Position lifecycle states
    enum PositionStatus {
        Active,      // LP position exists, can be liquidated
        Liquidated,  // LP removed, tokens in contract, awaiting swap/return
        Returned     // Tokens sent back to Asset Hub, position closed
    }

    // Structs
    struct PendingPosition {
        bytes32 assetHubPositionId;
        address token;
        address user;
        uint256 amount;
        address poolId;
        address baseAsset;
        uint256[] amounts;
        int24 lowerRangePercent;
        int24 upperRangePercent;
        uint16 slippageBps;
        uint256 timestamp;
        bool exists;
    }

    struct Position {
        bytes32 assetHubPositionId; // Link to AssetHub position
        address pool;
        address token0;
        address token1;
        int24 bottomTick;
        int24 topTick;
        uint128 liquidity;
        uint256 tokenId; // NFPM token id if minted via NFPM (0 if direct pool)
        address owner;
        int24 lowerRangePercent;
        int24 upperRangePercent;
        uint256 entryPrice;
        uint256 timestamp;
        PositionStatus status;          // Replaces bool active
        uint256 liquidatedAmount0;      // Token0 amount from liquidation (set in phase 1)
        uint256 liquidatedAmount1;      // Token1 amount from liquidation (set in phase 1)
    }

    constructor(address initialOwner) Ownable(initialOwner) {
        // Reasonable defaults; override via admin setters per deployment
        xTokensPrecompile = address(0);
        defaultDestWeight = 6_000_000_000;
        assetHubParaId = 0; // require admin to set correct paraId
        trustedXcmCaller = address(0);
        xcmConfigFrozen = false;

        // Default known precompile address (can be overridden per-network)
        xcmTransactorPrecompile = address(0);
        operator = initialOwner;
    }

    function setIntegrations(address quoter, address router) external onlyOwner {
        quoterContract = quoter;
        swapRouterContract = router;
    }

    function setNFPM(address nfpm) external onlyOwner {
        nfpmContract = nfpm;
    }

    function setXTokensPrecompile(address precompile) external onlyOwner {
        if (xcmConfigFrozen) revert XcmConfigAlreadyFrozen();
        xTokensPrecompile = precompile;
        emit XTokensPrecompileSet(precompile);
    }

    function setDefaultDestWeight(uint64 weight) external onlyOwner {
        if (xcmConfigFrozen) revert XcmConfigAlreadyFrozen();
        defaultDestWeight = weight;
        emit DefaultDestWeightSet(weight);
    }

    function setAssetHubParaId(uint32 paraId) external onlyOwner {
        if (xcmConfigFrozen) revert XcmConfigAlreadyFrozen();
        assetHubParaId = paraId;
        emit AssetHubParaIdSet(paraId);
    }

    function setTrustedXcmCaller(address caller) external onlyOwner {
        if (xcmConfigFrozen) revert XcmConfigAlreadyFrozen();
        trustedXcmCaller = caller;
        emit TrustedXcmCallerSet(caller);
    }

    function freezeXcmConfig() external onlyOwner {
        if (xcmConfigFrozen) revert XcmConfigAlreadyFrozen();
        xcmConfigFrozen = true;
        emit XcmConfigFrozen();
    }

    // ===== XCM Transactor Precompile integration (Moonbeam) =====

    event XcmTransactorPrecompileSet(address indexed precompile);
    event DefaultSlippageSet(uint16 bps);
    event XcmTransferAttempt(address indexed token, bytes dest, uint256 amount, bool success, bytes errorData);

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    function setOperator(address newOperator) external onlyOwner {
        operator = newOperator;
        emit OperatorUpdated(newOperator);
    }

    function setTestMode(bool _testMode) external onlyOwner {
        testMode = _testMode;
    }

    function setXcmTransactorPrecompile(address precompile) external onlyOwner {
        xcmTransactorPrecompile = precompile;
        emit XcmTransactorPrecompileSet(precompile);
    }

    function setDefaultSlippageBps(uint16 bps) external onlyOwner {
        if (bps > 10_000) revert BpsTooHigh();
        defaultSlippageBps = bps;
        emit DefaultSlippageSet(bps);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ===== Internal helpers: MultiLocation encoding for destination =====
    /**
     * @dev Receive assets from XCM transfer and create pending position
     * @notice Called via XCM Transact instruction from AssetHub's dispatchInvestment
     * @notice The composite XCM message from Asset Hub deposits ERC20 tokens then calls this function
     * @param assetHubPositionId The position ID generated on Asset Hub
     * @param token The ERC20 token address (xc-DOT or other cross-chain asset)
     * @param user The position owner
     * @param amount The amount of tokens received
     * @param investmentParams ABI-encoded parameters for the investment
     */
    function receiveAssets(
        bytes32 assetHubPositionId,
        address token,
        address user,
        uint256 amount,
        bytes memory investmentParams
    ) external whenNotPaused nonReentrant {
        if (!(testMode || msg.sender == owner() || (trustedXcmCaller != address(0) && msg.sender == trustedXcmCaller))) {
            revert UnauthorizedCaller();
        }
        if (!supportedTokens[token]) revert TokenNotSupported();
        if (amount == 0) revert AmountZero();
        if (user == address(0)) revert InvalidUser();
        if (pendingPositions[assetHubPositionId].exists) revert PositionAlreadyPending();

        // Decode investment parameters coming from Asset Hub
        // (address poolId, address baseAsset, uint256[] amounts, int24 lowerRangePercent, int24 upperRangePercent, address positionOwner, uint16 slippageBps)
        (
            address poolId,
            address baseAsset,
            uint256[] memory amounts,
            int24 lowerRangePercent,
            int24 upperRangePercent,
            address positionOwner,
            uint16 slippageBps
        ) = abi.decode(investmentParams, (address, address, uint256[], int24, int24, address, uint16));

        // Store as pending position
        pendingPositions[assetHubPositionId] = PendingPosition({
            assetHubPositionId: assetHubPositionId,
            token: token,
            user: positionOwner,
            amount: amount,
            poolId: poolId,
            baseAsset: baseAsset,
            amounts: amounts,
            lowerRangePercent: lowerRangePercent,
            upperRangePercent: upperRangePercent,
            slippageBps: slippageBps,
            timestamp: block.timestamp,
            exists: true
        });

        emit AssetsReceived(token, user, amount, investmentParams);
        emit PendingPositionCreated(assetHubPositionId, positionOwner, token, amount, poolId);
    }

    /**
     * @dev Execute a pending investment by swapping tokens and minting NFPM position
     * @notice Called by operator after receiveAssets creates pending position
     * @param assetHubPositionId The position ID from Asset Hub
     */
    function executePendingInvestment(
        bytes32 assetHubPositionId
    ) external onlyOperator whenNotPaused nonReentrant returns (uint256 localPositionId) {
        PendingPosition storage pending = pendingPositions[assetHubPositionId];
        if (!pending.exists) revert PendingPositionNotFound();

        // Extract pending position data
        address token = pending.token;
        address baseAsset = pending.baseAsset;
        uint256 amount = pending.amount;
        address poolId = pending.poolId;
        uint256[] memory amounts = pending.amounts;
        int24 lowerRangePercent = pending.lowerRangePercent;
        int24 upperRangePercent = pending.upperRangePercent;
        address positionOwner = pending.user;
        uint16 slippageBps = pending.slippageBps;

        // Step 1: Swap if received token != baseAsset
        address tokenToUse = token;
        uint256 swapAmount = amount;

        if (token != baseAsset) {
            swapAmount = _swapWithSlippage(token, baseAsset, amount, slippageBps);
            tokenToUse = baseAsset;
            emit ProceedsSwapped(token, baseAsset, amount, swapAmount, 0);
            if (swapAmount == 0) revert SwapZeroOutput();
        }

        // Step 2: Calculate tick range
        (int24 bottomTick, int24 topTick) = calculateTickRange(
            poolId,
            lowerRangePercent,
            upperRangePercent
        );

        // Step 3: Get pool tokens and current price state
        address token0 = IAlgebraPool(poolId).token0();
        address token1 = IAlgebraPool(poolId).token1();
        (uint160 sqrtPriceX96, int24 currentTick, , , , ) = IAlgebraPool(poolId).globalState();

        // Step 4: Determine if we need to split into both tokens (price within range)
        uint256 amount0Desired;
        uint256 amount1Desired;
        
        bool priceInRange = currentTick >= bottomTick && currentTick < topTick;
        
        if (priceInRange && swapAmount > 0) {
            // Price is within range - we need both tokens
            // Calculate the ratio needed based on current price and tick range
            (amount0Desired, amount1Desired) = _splitForDualSided(
                tokenToUse, token0, token1, swapAmount,
                sqrtPriceX96, bottomTick, topTick, slippageBps
            );
        } else {
            // Price outside range OR using pre-specified amounts - use original logic
            amount0Desired = amounts.length > 0 ? amounts[0] : 0;
            amount1Desired = amounts.length > 1 ? amounts[1] : 0;

            // If we swapped, adjust the amounts based on which token we got
            if (tokenToUse == token0 && token != baseAsset) {
                amount0Desired = swapAmount;
            } else if (tokenToUse == token1 && token != baseAsset) {
                amount1Desired = swapAmount;
            }
        }

        // Verify balances
        if (IERC20(tokenToUse).balanceOf(address(this)) < swapAmount) revert InsufficientSwappedFunding();
        if (amount0Desired > 0) {
            if (IERC20(token0).balanceOf(address(this)) < amount0Desired) revert InsufficientToken0();
        }
        if (amount1Desired > 0) {
            if (IERC20(token1).balanceOf(address(this)) < amount1Desired) revert InsufficientToken1();
        }

        // Step 5: Mint NFPM position
        if (nfpmContract == address(0)) revert NFPMNotSet();

        // Approve tokens for NFPM
        if (amount0Desired > 0) {
            uint256 cur = IERC20(token0).allowance(address(this), nfpmContract);
            if (cur != 0) IERC20(token0).forceApprove(nfpmContract, 0);
            IERC20(token0).forceApprove(nfpmContract, amount0Desired);
        }
        if (amount1Desired > 0) {
            uint256 cur1 = IERC20(token1).allowance(address(this), nfpmContract);
            if (cur1 != 0) IERC20(token1).forceApprove(nfpmContract, 0);
            IERC20(token1).forceApprove(nfpmContract, amount1Desired);
        }

    uint256 amount0Min = 0;
    uint256 amount1Min = 0;

        if (amount0Desired > 0 || amount1Desired > 0) {
            // Reuse sqrtPriceX96 from Step 3 (already fetched above)
            uint160 sqrtRatioLowerX96 = TickMath.getSqrtRatioAtTick(bottomTick);
            uint160 sqrtRatioUpperX96 = TickMath.getSqrtRatioAtTick(topTick);

            uint128 liquidityPreview = LiquidityAmounts.getLiquidityForAmounts(
                sqrtPriceX96,
                sqrtRatioLowerX96,
                sqrtRatioUpperX96,
                amount0Desired,
                amount1Desired
            );
            require(liquidityPreview > 0, "zero liquidity preview");

            (uint256 expected0, uint256 expected1) = LiquidityAmounts.getAmountsForLiquidity(
                sqrtPriceX96,
                sqrtRatioLowerX96,
                sqrtRatioUpperX96,
                liquidityPreview
            );

            uint256 bps = slippageBps > 0 ? slippageBps : defaultSlippageBps;
            amount0Min = expected0 == 0 ? 0 : (expected0 * (10_000 - bps)) / 10_000;
            amount1Min = expected1 == 0 ? 0 : (expected1 * (10_000 - bps)) / 10_000;
        }

        // Mint the position
        (uint256 tokenId, uint128 liquidityCreated, , ) = INonfungiblePositionManager(nfpmContract).mint(
            INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                deployer: address(0),
                tickLower: bottomTick,
                tickUpper: topTick,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: amount0Min,
                amount1Min: amount1Min,
                recipient: address(this),
                deadline: block.timestamp
            })
        );

        // Reset allowances
        if (amount0Desired > 0) IERC20(token0).forceApprove(nfpmContract, 0);
        if (amount1Desired > 0) IERC20(token1).forceApprove(nfpmContract, 0);

        // Step 6: Create position record
        localPositionId = _createPosition(
            assetHubPositionId,
            poolId,
            token0,
            token1,
            bottomTick,
            topTick,
            liquidityCreated,
            tokenId,
            positionOwner,
            lowerRangePercent,
            upperRangePercent
        );

        // Step 7: Store mapping and delete pending
        assetHubPositionToLocalId[assetHubPositionId] = localPositionId;
        delete pendingPositions[assetHubPositionId];

        emit PositionExecuted(assetHubPositionId, localPositionId, tokenId, liquidityCreated);
        emit PositionCreated(
            localPositionId,
            positionOwner,
            poolId,
            token0,
            token1,
            bottomTick,
            topTick,
            liquidityCreated
        );

        return localPositionId;
    }

    /**
     * @dev Cancel a pending position and return assets to Asset Hub
     * @notice Used when execution fails or position needs to be cancelled
     * @param assetHubPositionId The position ID from Asset Hub
     * @param destination XCM destination for asset return (AssetHub location)
     */
    function cancelPendingPosition(
        bytes32 assetHubPositionId,
        bytes calldata destination
    ) external onlyOperator whenNotPaused nonReentrant {
        PendingPosition storage pending = pendingPositions[assetHubPositionId];
        if (!pending.exists) revert PendingPositionNotFound();

        address token = pending.token;
        address user = pending.user;
        uint256 amount = pending.amount;

        // Delete pending position first (checks-effects-interactions pattern)
        delete pendingPositions[assetHubPositionId];

        // Return assets to Asset Hub via XCM
        if (!testMode) {
            if (xTokensPrecompile == address(0)) revert XTokensNotSet();
            if (destination.length == 0) revert InvalidDestination();

            uint256 cur = IERC20(token).allowance(address(this), xTokensPrecompile);
            if (cur != 0) IERC20(token).forceApprove(xTokensPrecompile, 0);
            IERC20(token).forceApprove(xTokensPrecompile, amount);

            try IXTokens(xTokensPrecompile).transfer(token, amount, destination, defaultDestWeight) {
                // Success
            } catch (bytes memory err) {
                emit XcmTransferAttempt(token, destination, amount, false, err);
                revert XcmTransferFailed();
            }

            IERC20(token).forceApprove(xTokensPrecompile, 0);
            emit AssetsReturned(token, user, destination, amount, 0);
        }

        emit PendingPositionCancelled(assetHubPositionId, user, amount);
    }

    /**
     * @dev Calculate tick range from percentage parameters
     */
    function calculateTickRange(
        address pool,
        int24 lowerRangePercent,
        int24 upperRangePercent
    ) public view returns (int24 bottomTick, int24 topTick) {
        // Require factors remain positive: percent must be > -100%
        // Note: Input is scaled by 10000 (1% = 10000). So -100% = -1000000.
        if (lowerRangePercent <= -1000000 || upperRangePercent <= -1000000 || lowerRangePercent >= upperRangePercent) revert RangeOutOfBounds();

        (uint160 sqrtPriceX96, int24 currentTick, , , , ) = IAlgebraPool(pool).globalState();
        int24 spacing = IAlgebraPool(pool).tickSpacing();

        // Compute target sqrt prices from percent factors
        uint160 sqrtLower = _targetSqrtFromPercent(sqrtPriceX96, lowerRangePercent);
        uint160 sqrtUpper = _targetSqrtFromPercent(sqrtPriceX96, upperRangePercent);

        // Convert to ticks via helper; Algebra TickMath provides getTickAtSqrtRatio
        int24 rawBottom = TickMath.getTickAtSqrtRatio(sqrtLower);
        int24 rawTop = TickMath.getTickAtSqrtRatio(sqrtUpper);

        // Snap to spacing: floor lower, ceil upper
        bottomTick = _floorToSpacing(rawBottom, spacing);
        topTick = _ceilToSpacing(rawTop, spacing);

        // Clamp to MIN/MAX multiples
        int24 minAllowed = _ceilToSpacing(MIN_TICK, spacing);
        int24 maxAllowed = _floorToSpacing(MAX_TICK, spacing);
        if (bottomTick < minAllowed) bottomTick = minAllowed;
        if (topTick > maxAllowed) topTick = maxAllowed;

        // Ensure strictly ordered and non-equal after snapping
        if (bottomTick >= topTick) {
            bottomTick = _floorToSpacing(currentTick - spacing, spacing);
            topTick = _ceilToSpacing(currentTick + spacing, spacing);
            if (bottomTick < minAllowed) bottomTick = minAllowed;
            if (topTick > maxAllowed) topTick = maxAllowed;
        }

        return (bottomTick, topTick);
    }

    function _targetSqrtFromPercent(uint160 sqrtCurrentX96, int24 percent) internal pure returns (uint160) {
        uint256 sqrtFactor = _sqrtFactorScaledFromPercent(percent); // 1e6-scaled
        uint256 target = FullMath.mulDiv(uint256(sqrtCurrentX96), sqrtFactor, SCALE_1E6);
        if (target < TickMath.MIN_SQRT_RATIO) target = TickMath.MIN_SQRT_RATIO;
        if (target >= TickMath.MAX_SQRT_RATIO) target = TickMath.MAX_SQRT_RATIO - 1;
        return uint160(target);
    }

    function _floorToSpacing(int24 tick, int24 spacing) internal pure returns (int24) {
        int24 rem = tick % spacing;
        if (rem == 0) return tick;
        if (tick >= 0) return tick - rem;
        // for negative ticks, floor away from zero
        return tick - (rem + spacing);
    }

    function _ceilToSpacing(int24 tick, int24 spacing) internal pure returns (int24) {
        int24 rem = tick % spacing;
        if (rem == 0) return tick;
        if (tick >= 0) return tick + (spacing - rem);
        // for negative ticks, ceil towards zero
        return tick - rem;
    }

    function _sqrtFactorScaledFromPercent(int24 percent) internal pure returns (uint256) {
        // factor f = 1 + percent/100 => scaled as 1e6
        int256 scaled = int256(SCALE_1E6) + int256(percent); // 1% => 10_000 (since 1e6 * 1/100)
        if (scaled <= 0) revert InvalidPercent();
        // Compute sqrt(f) in 1e6 scale by: sqrt(scaled * 1e12) / 1e3
        uint256 sqrtArg = uint256(scaled) * SCALE_SQRT_AUX;
        uint256 s = _sqrt(sqrtArg) / 1_000; // yields 1e6-scaled sqrt(f)
        return s;
    }

    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        // Initial guess: 2^(log2(x)/2)
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    /**
     * @dev Check if position is out of range (VIEW ONLY - does not trigger liquidation)
     * @notice This is a passive monitoring function. Liquidation must be triggered by operator.
     * @notice LiquiDOT uses an OPERATOR-TRIGGERED liquidation model:
     *         - Backend monitors positions off-chain using this view function
     *         - Operator calls executeFullLiquidation() or liquidateSwapAndReturn() when needed
     *         - No automated on-chain keepers or triggers
     * @param positionId The position to check
     * @return outOfRange True if current price is outside the position's tick range
     * @return currentPrice The current tick (as uint256 for event compatibility)
     */
    function isPositionOutOfRange(
        uint256 positionId
    ) public view returns (bool outOfRange, uint256 currentPrice) {
        Position storage position = positions[positionId];
        if (position.status != PositionStatus.Active) revert PositionNotActive();

        // Use current pool tick as proxy for price range evaluation
        (, int24 currentTick, , , , ) = IAlgebraPool(position.pool).globalState();
        // Return tick as an unsigned value for backward compat with event
        currentPrice = uint256(int256(currentTick));
        outOfRange = currentTick < position.bottomTick || currentTick > position.topTick;

        return (outOfRange, currentPrice);
    }

    /**
     * @dev Execute full liquidation of position (OPERATOR-TRIGGERED)
     * @notice Liquidation is NOT automated. Operator must call this after monitoring positions.
     */
    function executeFullLiquidation(
        uint256 positionId
    ) external onlyOperator whenNotPaused nonReentrant returns (uint256 amount0, uint256 amount1) {
        return _liquidatePosition(positionId);
    }

    /**
     * @dev Check if position is out of range, and if so, execute liquidation in one atomic call.
     * @notice This is a convenience function for operators. It combines the range check and
     *         liquidation into a single transaction, reducing gas costs and race conditions.
     * @notice Still OPERATOR-TRIGGERED - just more efficient than separate check + liquidate calls.
     * @param positionId The position to check and potentially liquidate
     * @return liquidated True if the position was out of range and liquidated
     * @return amount0 Amount of token0 returned (0 if not liquidated)
     * @return amount1 Amount of token1 returned (0 if not liquidated)
     */
    function liquidateIfOutOfRange(
        uint256 positionId
    ) external onlyOperator whenNotPaused nonReentrant returns (bool liquidated, uint256 amount0, uint256 amount1) {
        Position storage position = positions[positionId];
        if (position.status != PositionStatus.Active) revert PositionNotActive();

        // Check if out of range
        (, int24 currentTick, , , , ) = IAlgebraPool(position.pool).globalState();
        bool outOfRange = currentTick < position.bottomTick || currentTick > position.topTick;

        if (!outOfRange) {
            return (false, 0, 0);
        }

        // Position is out of range - liquidate it
        (amount0, amount1) = _liquidatePosition(positionId);
        return (true, amount0, amount1);
    }

    // Internal liquidation logic shared by multiple flows
    // Sets position to Liquidated state and stores amounts for phase 2
    function _liquidatePosition(uint256 positionId) internal returns (uint256 amount0, uint256 amount1) {
        Position storage position = positions[positionId];
        if (position.status != PositionStatus.Active) revert PositionNotActive();

        if (position.tokenId == 0) revert PositionNotActive();
        if (nfpmContract == address(0)) revert NFPMNotSet();

        // NFPM flow: decrease full liquidity then collect
        (amount0, amount1) = INonfungiblePositionManager(nfpmContract).decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: position.tokenId,
                liquidity: position.liquidity,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            })
        );

        (uint256 c0, uint256 c1) = INonfungiblePositionManager(nfpmContract).collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: position.tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );

        if (c0 > 0 || c1 > 0) {
            amount0 += c0;
            amount1 += c1;
        }

        INonfungiblePositionManager(nfpmContract).burn(position.tokenId);

        // Mark position as Liquidated (phase 1 complete, awaiting phase 2)
        position.status = PositionStatus.Liquidated;
        position.liquidity = 0;
        position.liquidatedAmount0 = amount0;
        position.liquidatedAmount1 = amount1;

        emit PositionLiquidated(positionId, position.owner, amount0, amount1);

        return (amount0, amount1);
    }

    /**
     * @dev Return arbitrary token assets to Asset Hub recipient (owner-only).
     * If amount is 0, transfers full balance. "user" is logged for reconciliation.
     */
    function returnAssets(
        address token,
        address user,
        uint256 amount,
        bytes calldata destination
    ) external onlyOwner whenNotPaused nonReentrant {
        if (destination.length == 0) revert InvalidDestination();
        if (!supportedTokens[token]) revert TokenNotSupported();
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 sendAmount = amount == 0 ? balance : amount;
        if (sendAmount > balance) revert InsufficientToken0();
        if (xTokensPrecompile == address(0)) revert XTokensNotSet();
        uint256 cur = IERC20(token).allowance(address(this), xTokensPrecompile);
        if (cur != 0) IERC20(token).forceApprove(xTokensPrecompile, 0);
        IERC20(token).forceApprove(xTokensPrecompile, sendAmount);
        bool success = false;
        bytes memory err;
        try IXTokens(xTokensPrecompile).transfer(token, sendAmount, destination, defaultDestWeight) {
            success = true;
        } catch (bytes memory reason) {
            err = reason;
        }
        emit XcmTransferAttempt(token, destination, sendAmount, success, err);
        IERC20(token).forceApprove(xTokensPrecompile, 0);
        emit AssetsReturned(token, user, destination, sendAmount, 0);
    }

    /**
     * @dev Liquidate a position, swap all proceeds to base asset, and return to Asset Hub
     * @notice This sends assets via XTokens but does NOT automatically call AssetHub contract
     * @notice Operator must separately call settleLiquidation on AssetHub after assets arrive
     * @param positionId The Moonbeam position ID
     * @param baseAsset The asset to convert all proceeds to
     * @param destination SCALE-encoded multilocation pointing to AssetHubVault contract (AccountKey20)
     * @param minAmountOut0 Minimum output for token0 → baseAsset swap
     * @param minAmountOut1 Minimum output for token1 → baseAsset swap
     * @param limitSqrtPrice Price limit for swaps
     * @param assetHubPositionId The corresponding position ID on Asset Hub for reconciliation
     */
    function liquidateSwapAndReturn(
        uint256 positionId,
        address baseAsset,
        bytes calldata destination,
        uint256 minAmountOut0,
        uint256 minAmountOut1,
        uint160 limitSqrtPrice,
        bytes32 assetHubPositionId
    ) external onlyOperator whenNotPaused nonReentrant {
        if (destination.length == 0) revert InvalidDestination();
        Position storage position = positions[positionId];
        if (position.status != PositionStatus.Active) revert PositionNotActive();
        if (!supportedTokens[baseAsset]) revert BaseAssetNotSupported();

        address token0 = position.token0;
        address token1 = position.token1;

        (uint256 amount0, uint256 amount1) = _liquidatePosition(positionId);

        uint256 totalBase;
        // Handle token0 → baseAsset
        if (amount0 > 0) {
            if (token0 == baseAsset) {
                totalBase += amount0;
            } else {
                if (swapRouterContract == address(0)) revert SwapRouterNotSet();
                IERC20(token0).safeIncreaseAllowance(swapRouterContract, amount0);
                uint256 out0 = ISwapRouter(swapRouterContract).exactInputSingle(
                    ISwapRouter.ExactInputSingleParams({
                        tokenIn: token0,
                        tokenOut: baseAsset,
                        recipient: address(this),
                        deadline: block.timestamp,
                        amountIn: amount0,
                        amountOutMinimum: minAmountOut0,
                        limitSqrtPrice: limitSqrtPrice,
                        deployer: address(0)
                    })
                );
                totalBase += out0;
                emit ProceedsSwapped(token0, baseAsset, amount0, out0, positionId);
            }
        }

        // Handle token1 → baseAsset
        if (amount1 > 0) {
            if (token1 == baseAsset) {
                totalBase += amount1;
            } else {
                if (swapRouterContract == address(0)) revert SwapRouterNotSet();
                IERC20(token1).safeIncreaseAllowance(swapRouterContract, amount1);
                uint256 out1 = ISwapRouter(swapRouterContract).exactInputSingle(
                    ISwapRouter.ExactInputSingleParams({
                        tokenIn: token1,
                        tokenOut: baseAsset,
                        recipient: address(this),
                        deadline: block.timestamp,
                        amountIn: amount1,
                        amountOutMinimum: minAmountOut1,
                        limitSqrtPrice: limitSqrtPrice,
                        deployer: address(0)
                    })
                );
                totalBase += out1;
                emit ProceedsSwapped(token1, baseAsset, amount1, out1, positionId);
            }
        }

        if (totalBase == 0) revert SwapZeroOutput();
        
        // Send proceeds back to Asset Hub via XTokens
        // NOTE: This ONLY transfers assets, does NOT call handleIncomingXCM or settleLiquidation
        // Assets will be deposited at Substrate level to the AssetHubVault contract address
        // Operator must separately call settleLiquidation(assetHubPositionId, totalBase) on AssetHub
        // In test mode, skip actual XCM transfer to allow local testing
        if (!testMode) {
            if (xTokensPrecompile == address(0)) revert XTokensNotSet();
            
            uint256 cur = IERC20(baseAsset).allowance(address(this), xTokensPrecompile);
            if (cur != 0) IERC20(baseAsset).forceApprove(xTokensPrecompile, 0);
            IERC20(baseAsset).forceApprove(xTokensPrecompile, totalBase);
            
            bool success = false;
            bytes memory err;
            try IXTokens(xTokensPrecompile).transfer(baseAsset, totalBase, destination, defaultDestWeight) {
                success = true;
            } catch (bytes memory reason) {
                err = reason;
            }
            
            emit XcmTransferAttempt(baseAsset, destination, totalBase, success, err);
            IERC20(baseAsset).forceApprove(xTokensPrecompile, 0);
        }
        
        // Mark position as fully Returned (phase 2 complete)
        position.status = PositionStatus.Returned;
        
        emit AssetsReturned(baseAsset, position.owner, destination, totalBase, positionId);
        emit LiquidationCompleted(positionId, assetHubPositionId, position.owner, baseAsset, totalBase);
    }

    /**
     * @dev Phase 2: Swap liquidated proceeds and return to Asset Hub
     * @notice Use this AFTER calling executeFullLiquidation() or liquidateIfOutOfRange()
     * @notice Worker reads liquidatedAmount0/1 from position or PositionLiquidated event,
     *         calculates slippage params, then calls this function
     * @param positionId The position ID (must be in Liquidated status)
     * @param baseAsset The asset to convert all proceeds to
     * @param destination SCALE-encoded multilocation pointing to AssetHubVault
     * @param minAmountOut0 Minimum output for token0 → baseAsset swap
     * @param minAmountOut1 Minimum output for token1 → baseAsset swap
     * @param limitSqrtPrice Price limit for swaps
     */
    function swapAndReturn(
        uint256 positionId,
        address baseAsset,
        bytes calldata destination,
        uint256 minAmountOut0,
        uint256 minAmountOut1,
        uint160 limitSqrtPrice
    ) external onlyOperator whenNotPaused nonReentrant {
        if (destination.length == 0) revert InvalidDestination();
        Position storage position = positions[positionId];
        if (position.status != PositionStatus.Liquidated) revert PositionNotLiquidated();
        if (!supportedTokens[baseAsset]) revert BaseAssetNotSupported();

        address token0 = position.token0;
        address token1 = position.token1;
        uint256 amount0 = position.liquidatedAmount0;
        uint256 amount1 = position.liquidatedAmount1;

        uint256 totalBase;
        
        // Handle token0 → baseAsset
        if (amount0 > 0) {
            if (token0 == baseAsset) {
                totalBase += amount0;
            } else {
                if (swapRouterContract == address(0)) revert SwapRouterNotSet();
                IERC20(token0).safeIncreaseAllowance(swapRouterContract, amount0);
                uint256 out0 = ISwapRouter(swapRouterContract).exactInputSingle(
                    ISwapRouter.ExactInputSingleParams({
                        tokenIn: token0,
                        tokenOut: baseAsset,
                        recipient: address(this),
                        deadline: block.timestamp,
                        amountIn: amount0,
                        amountOutMinimum: minAmountOut0,
                        limitSqrtPrice: limitSqrtPrice,
                        deployer: address(0)
                    })
                );
                totalBase += out0;
                emit ProceedsSwapped(token0, baseAsset, amount0, out0, positionId);
            }
        }

        // Handle token1 → baseAsset
        if (amount1 > 0) {
            if (token1 == baseAsset) {
                totalBase += amount1;
            } else {
                if (swapRouterContract == address(0)) revert SwapRouterNotSet();
                IERC20(token1).safeIncreaseAllowance(swapRouterContract, amount1);
                uint256 out1 = ISwapRouter(swapRouterContract).exactInputSingle(
                    ISwapRouter.ExactInputSingleParams({
                        tokenIn: token1,
                        tokenOut: baseAsset,
                        recipient: address(this),
                        deadline: block.timestamp,
                        amountIn: amount1,
                        amountOutMinimum: minAmountOut1,
                        limitSqrtPrice: limitSqrtPrice,
                        deployer: address(0)
                    })
                );
                totalBase += out1;
                emit ProceedsSwapped(token1, baseAsset, amount1, out1, positionId);
            }
        }

        if (totalBase == 0) revert SwapZeroOutput();
        
        // Send proceeds back to Asset Hub via XTokens
        if (!testMode) {
            if (xTokensPrecompile == address(0)) revert XTokensNotSet();
            
            uint256 cur = IERC20(baseAsset).allowance(address(this), xTokensPrecompile);
            if (cur != 0) IERC20(baseAsset).forceApprove(xTokensPrecompile, 0);
            IERC20(baseAsset).forceApprove(xTokensPrecompile, totalBase);
            
            bool success = false;
            bytes memory err;
            try IXTokens(xTokensPrecompile).transfer(baseAsset, totalBase, destination, defaultDestWeight) {
                success = true;
            } catch (bytes memory reason) {
                err = reason;
            }
            
            emit XcmTransferAttempt(baseAsset, destination, totalBase, success, err);
            IERC20(baseAsset).forceApprove(xTokensPrecompile, 0);
        }
        
        // Mark position as fully Returned
        position.status = PositionStatus.Returned;
        
        emit AssetsReturned(baseAsset, position.owner, destination, totalBase, positionId);
        emit LiquidationCompleted(positionId, position.assetHubPositionId, position.owner, baseAsset, totalBase);
    }

    /**
     * @dev Get this contract's token balance
     */
    function getBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    // Fee harvest without changing liquidity (NFPM path)
    function collectFees(uint256 positionId)
        external
        onlyOperator
        nonReentrant
        returns (uint256 amount0, uint256 amount1)
    {
        Position storage position = positions[positionId];
        if (position.status != PositionStatus.Active) revert PositionNotActive();
        if (position.tokenId == 0 || nfpmContract == address(0)) revert NFPMNotSet();

        (amount0, amount1) = INonfungiblePositionManager(nfpmContract).collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: position.tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );
    }

    // Algebra mint callback removed: NFPM-only path enforced

    // Internal swap function (no reentrancy guard)
    function _swapExactInputSingle(
        address tokenIn,
        address tokenOut,
        address recipient,
        uint256 amountIn,
        uint256 amountOutMinimum,
        uint160 limitSqrtPrice
    ) internal returns (uint256 amountOut) {
        if (swapRouterContract == address(0)) revert SwapRouterNotSet();
        
        amountOut = ISwapRouter(swapRouterContract).exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                recipient: recipient,
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum,
                limitSqrtPrice: limitSqrtPrice,
                deployer: address(0)
            })
        );
    }

    /**
     * @dev Internal swap with automatic quote, slippage, and approval handling
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount to swap
     * @param slippageBps Slippage tolerance in basis points (uses default if 0)
     * @return amountOut Amount received from swap
     */
    function _swapWithSlippage(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint16 slippageBps
    ) internal returns (uint256 amountOut) {
        if (quoterContract == address(0)) revert QuoterNotSet();
        if (swapRouterContract == address(0)) revert SwapRouterNotSet();
        
        // Get quote
        (uint256 expectedOut, ) = IQuoter(quoterContract).quoteExactInputSingle(
            tokenIn, tokenOut, address(0), amountIn, 0
        );
        
        // Calculate minimum with slippage
        uint256 bps = slippageBps > 0 ? slippageBps : defaultSlippageBps;
        uint256 minOut = (expectedOut * (10_000 - bps)) / 10_000;
        
        // Approve, swap, reset
        IERC20(tokenIn).forceApprove(swapRouterContract, amountIn);
        amountOut = _swapExactInputSingle(tokenIn, tokenOut, address(this), amountIn, minOut, 0);
        IERC20(tokenIn).forceApprove(swapRouterContract, 0);
    }

    /**
     * @dev Split a single token into both pool tokens for in-range LP minting
     * @param tokenToUse The token we currently have (after initial swap)
     * @param token0 Pool's token0
     * @param token1 Pool's token1
     * @param totalAmount Total amount of tokenToUse available
     * @param sqrtPriceX96 Current pool sqrt price
     * @param bottomTick Lower tick bound
     * @param topTick Upper tick bound
     * @param slippageBps Slippage tolerance
     * @return amount0 Amount of token0 for minting
     * @return amount1 Amount of token1 for minting
     */
    function _splitForDualSided(
        address tokenToUse,
        address token0,
        address token1,
        uint256 totalAmount,
        uint160 sqrtPriceX96,
        int24 bottomTick,
        int24 topTick,
        uint16 slippageBps
    ) internal returns (uint256 amount0, uint256 amount1) {
        // Calculate the ratio needed based on current price and tick range
        uint160 sqrtRatioLowerX96 = TickMath.getSqrtRatioAtTick(bottomTick);
        uint160 sqrtRatioUpperX96 = TickMath.getSqrtRatioAtTick(topTick);
        
        // Calculate amounts needed for reference liquidity at current price
        (uint256 ratio0, uint256 ratio1) = LiquidityAmounts.getAmountsForLiquidity(
            sqrtPriceX96, sqrtRatioLowerX96, sqrtRatioUpperX96, 1e18
        );
        
        uint256 totalRatio = ratio0 + ratio1;
        if (totalRatio == 0) {
            // Edge case: return all as the token we have
            if (tokenToUse == token0) {
                return (totalAmount, 0);
            } else {
                return (0, totalAmount);
            }
        }
        
        if (tokenToUse == token0) {
            // We have token0, need to swap some to get token1
            uint256 amountToSwap = (totalAmount * ratio1) / totalRatio;
            if (amountToSwap > 0) {
                uint256 received1 = _swapWithSlippage(token0, token1, amountToSwap, slippageBps);
                amount0 = totalAmount - amountToSwap;
                amount1 = received1;
                emit ProceedsSwapped(token0, token1, amountToSwap, received1, 1);
            } else {
                amount0 = totalAmount;
                amount1 = 0;
            }
        } else if (tokenToUse == token1) {
            // We have token1, need to swap some to get token0
            uint256 amountToSwap = (totalAmount * ratio0) / totalRatio;
            if (amountToSwap > 0) {
                uint256 received0 = _swapWithSlippage(token1, token0, amountToSwap, slippageBps);
                amount0 = received0;
                amount1 = totalAmount - amountToSwap;
                emit ProceedsSwapped(token1, token0, amountToSwap, received0, 1);
            } else {
                amount0 = 0;
                amount1 = totalAmount;
            }
        } else {
            revert("baseAsset must be token0 or token1");
        }
    }

    // Swap exact input single via Algebra router (external wrapper with reentrancy protection)
    function swapExactInputSingle(
        address tokenIn,
        address tokenOut,
        address recipient,
        uint256 amountIn,
        uint256 amountOutMinimum,
        uint160 limitSqrtPrice
    ) external onlyOwner whenNotPaused nonReentrant returns (uint256 amountOut) {
        if (swapRouterContract == address(0)) revert SwapRouterNotSet();
        // Tight allowance for router
        uint256 cur = IERC20(tokenIn).allowance(address(this), swapRouterContract);
        if (cur != 0) IERC20(tokenIn).forceApprove(swapRouterContract, 0);
        IERC20(tokenIn).forceApprove(swapRouterContract, amountIn);
        
        amountOut = _swapExactInputSingle(tokenIn, tokenOut, recipient, amountIn, amountOutMinimum, limitSqrtPrice);
        
        IERC20(tokenIn).forceApprove(swapRouterContract, 0);
    }

    // Public quote helper
    function quoteExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint160 limitSqrtPrice
    ) external returns (uint256 amountOut) {
        if (quoterContract == address(0)) revert QuoterNotSet();
        (amountOut, ) = IQuoter(quoterContract).quoteExactInputSingle(tokenIn, tokenOut,  address(0), amountIn, limitSqrtPrice);
    }

    /**
     * @dev Get active positions
     */
    function getActivePositions() external view returns (Position[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 1; i <= positionCounter; i++) {
            if (positions[i].status == PositionStatus.Active) {
                activeCount++;
            }
        }

        Position[] memory activePositions = new Position[](activeCount);
        uint256 index = 0;
        for (uint256 i = 1; i <= positionCounter; i++) {
            if (positions[i].status == PositionStatus.Active) {
                activePositions[index] = positions[i];
                index++;
            }
        }

        return activePositions;
    }

    /**
     * @dev Get user positions
     */
    function getUserPositions(address user) external view returns (uint256[] memory) {
        return userPositions[user];
    }

    /**
     * @dev Add supported token
     */
    function addSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = true;
    }

    /**
     * @dev Remove supported token
     */
    function removeSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = false;
    }

    /**
     * @dev Internal function to create position
     */
    function _createPosition(
        bytes32 assetHubPositionId,
        address pool,
        address token0,
        address token1,
        int24 bottomTick,
        int24 topTick,
        uint128 liquidity,
        uint256 tokenId,
        address owner,
        int24 lowerRangePercent,
        int24 upperRangePercent
    ) internal returns (uint256 positionId) {
        positionCounter++;
        positionId = positionCounter;

        // Capture entry at creation time; store current tick as entry reference for monitoring
        (, int24 entryTick, , , , ) = IAlgebraPool(pool).globalState();

        positions[positionId] = Position({
            assetHubPositionId: assetHubPositionId,
            pool: pool,
            token0: token0,
            token1: token1,
            bottomTick: bottomTick,
            topTick: topTick,
            liquidity: liquidity,
            tokenId: tokenId,
            owner: owner,
            lowerRangePercent: lowerRangePercent,
            upperRangePercent: upperRangePercent,
            entryPrice: uint256(int256(entryTick)),
            timestamp: block.timestamp,
            status: PositionStatus.Active,
            liquidatedAmount0: 0,
            liquidatedAmount1: 0
        });

        userPositions[owner].push(positionId);

        return positionId;
    }
}