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



// Moonbeam PalletXcm precompile at 0x081A
interface IPalletXcm {
    struct Location {
        uint8 parents;
        bytes[] interior;
    }

    struct AssetAddressInfo {
        address asset;
        uint256 amount;
    }

    function transferAssetsUsingTypeAndThenAddress(
        Location calldata dest,
        AssetAddressInfo[] calldata assets,
        uint8 assetsTransferType,
        uint8 remoteFeesIdIndex,
        uint8 feesTransferType,
        bytes calldata customXcmOnDest
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

/// @title XCMProxy
/// @dev Cross-chain execution engine for LiquiDOT on Moonbeam (Algebra Integral / StellaSwap Pulsar)
/// @dev Operator-triggered liquidation model. See CLAUDE.md for architecture details.
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
    error NotEmergencyAdmin();
    error DeadlineTooFar();

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
    address public xcmPrecompile; // PalletXcm precompile at 0x081A on Moonbeam
    uint32 public assetHubParaId; // target Asset Hub parachain id on the same relay
    address public trustedXcmCaller; // optional: derived XCM caller or allowed system caller
    bool public xcmConfigFrozen; // freeze flag to prevent further config changes

    // Moonbeam XCM Transactor precompile (variant that supports transactThroughDerivative)
    address public xcmTransactorPrecompile; // e.g., 0x0000...0806 on some runtimes

    // Slippage configuration (basis points, 1 = 0.01%) for NFPM mint operations
    uint16 public defaultSlippageBps; // e.g., 100 = 1%

    // Operator role for day-to-day execution
    address public operator;

    // H-5: Emergency admin — separate from owner, can pause the contract
    address public emergencyAdmin;

    // M-1: Maximum deadline offset in seconds (default 5 minutes)
    uint256 public maxDeadlineOffset;

    // Test mode - allows direct contract calls without XCM for local testing
    bool public testMode;
    bool public testModeFrozen;

    // Config events
    event XcmPrecompileSet(address indexed precompile);
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
        xcmPrecompile = 0x000000000000000000000000000000000000081A;
        assetHubParaId = 0; // require admin to set correct paraId
        trustedXcmCaller = address(0);
        xcmConfigFrozen = false;

        // Default known precompile address (can be overridden per-network)
        xcmTransactorPrecompile = address(0);
        operator = initialOwner;
        emergencyAdmin = initialOwner;
        maxDeadlineOffset = 300; // 5 minutes default
    }

    function setIntegrations(address quoter, address router) external onlyOwner {
        quoterContract = quoter;
        swapRouterContract = router;
    }

    function setNFPM(address nfpm) external onlyOwner {
        nfpmContract = nfpm;
    }

    function setXcmPrecompile(address precompile) external onlyOwner {
        if (xcmConfigFrozen) revert XcmConfigAlreadyFrozen();
        xcmPrecompile = precompile;
        emit XcmPrecompileSet(precompile);
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

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    function setOperator(address newOperator) external onlyOwner {
        operator = newOperator;
        emit OperatorUpdated(newOperator);
    }

    event EmergencyAdminUpdated(address indexed emergencyAdmin);

    function setEmergencyAdmin(address _emergencyAdmin) external onlyOwner {
        emergencyAdmin = _emergencyAdmin;
        emit EmergencyAdminUpdated(_emergencyAdmin);
    }

    /// @notice Emergency admin can pause in addition to owner (H-5)
    function emergencyPause() external {
        if (msg.sender != emergencyAdmin && msg.sender != owner()) revert NotEmergencyAdmin();
        _pause();
    }

    function setMaxDeadlineOffset(uint256 _offset) external onlyOwner {
        if (_offset < 30 || _offset > 3600) revert DeadlineTooFar();
        maxDeadlineOffset = _offset;
    }

    /// @dev Returns a meaningful deadline instead of block.timestamp (M-1)
    function _deadline() internal view returns (uint256) {
        return block.timestamp + maxDeadlineOffset;
    }

    event TestModeFrozen();

    function setTestMode(bool _testMode) external onlyOwner {
        if (testModeFrozen) revert XcmConfigAlreadyFrozen();
        testMode = _testMode;
    }

    function freezeTestMode() external onlyOwner {
        if (testModeFrozen) revert XcmConfigAlreadyFrozen();
        testModeFrozen = true;
        testMode = false;
        emit TestModeFrozen();
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

    // ===== Internal helpers: XCM precompile transfers =====

    error XcmPrecompileNotSet();

    /**
     * @dev Build SCALE-encoded VersionedXcm::V4 with DepositAsset to AccountId32 (EE-padded EVM address)
     * @param beneficiary The EVM H160 address to deposit to on Asset Hub
     */
    function _encodeDepositAssetXcm(address beneficiary) internal pure returns (bytes memory) {
        // AccountId32 = H160 address + 12 bytes of 0xEE
        bytes memory buf = new bytes(41); // 1+1+1+2+1+1+1+1+32
        uint256 i = 0;
        buf[i++] = 0x04; // VersionedXcm::V4
        buf[i++] = 0x04; // compact(1) — 1 instruction
        buf[i++] = 0x0d; // DepositAsset
        buf[i++] = 0x01; // AssetFilter::Wild
        buf[i++] = 0x00; // WildAsset::All
        buf[i++] = 0x00; // parents = 0
        buf[i++] = 0x01; // Junctions::X1
        buf[i++] = 0x01; // AccountId32
        buf[i++] = 0x00; // network = None
        // Copy 20-byte address
        bytes20 addr = bytes20(beneficiary);
        for (uint256 j = 0; j < 20; j++) {
            buf[i++] = addr[j];
        }
        // Pad remaining 12 bytes with 0xEE
        for (uint256 j = 0; j < 12; j++) {
            buf[i++] = 0xEE;
        }
        return buf;
    }

    /**
     * @dev Transfer tokens to Asset Hub via XCM precompile using DestinationReserve
     * @param token The ERC20 token to transfer
     * @param amount Amount to transfer
     * @param beneficiary The EVM address that will receive on Asset Hub (converted to AccountId32)
     */
    function _xcmTransferToAssetHub(address token, uint256 amount, address beneficiary) internal {
        if (xcmPrecompile == address(0)) revert XcmPrecompileNotSet();

        // Build Asset Hub destination: { parents: 1, interior: X1(Parachain(assetHubParaId)) }
        bytes[] memory interior = new bytes[](1);
        interior[0] = abi.encodePacked(bytes1(0x00), bytes4(uint32(assetHubParaId)));
        IPalletXcm.Location memory dest = IPalletXcm.Location({ parents: 1, interior: interior });

        IPalletXcm.AssetAddressInfo[] memory assets = new IPalletXcm.AssetAddressInfo[](1);
        assets[0] = IPalletXcm.AssetAddressInfo({ asset: token, amount: amount });

        bytes memory xcmOnDest = _encodeDepositAssetXcm(beneficiary);

        // Approve token spend for the precompile
        IERC20(token).forceApprove(xcmPrecompile, amount);

        IPalletXcm(xcmPrecompile).transferAssetsUsingTypeAndThenAddress(
            dest,
            assets,
            2, // DestinationReserve
            0, // remoteFeesIdIndex
            2, // feesTransferType = DestinationReserve
            xcmOnDest
        );

        IERC20(token).forceApprove(xcmPrecompile, 0);
    }
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
        // H-4: testMode no longer grants open access — owner or trustedXcmCaller required regardless
        if (!(msg.sender == owner() || msg.sender == operator || (trustedXcmCaller != address(0) && msg.sender == trustedXcmCaller))) {
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

        // Step 5: Mint via helper (reduces stack depth)
        (uint256 tokenId, uint128 liquidityCreated) = _mintNfpmPosition(
            token0, token1, amount0Desired, amount1Desired,
            sqrtPriceX96, bottomTick, topTick, slippageBps
        );

        // Step 6: Create position record
        localPositionId = _createPosition(
            assetHubPositionId, poolId, token0, token1,
            bottomTick, topTick, liquidityCreated, tokenId,
            positionOwner, lowerRangePercent, upperRangePercent
        );

        // Step 7: Store mapping and delete pending
        assetHubPositionToLocalId[assetHubPositionId] = localPositionId;
        delete pendingPositions[assetHubPositionId];

        emit PositionExecuted(assetHubPositionId, localPositionId, tokenId, liquidityCreated);
        emit PositionCreated(
            localPositionId, positionOwner, poolId,
            token0, token1, bottomTick, topTick, liquidityCreated
        );

        return localPositionId;
    }

    /// @dev Approve, compute slippage mins, mint NFPM position, reset allowances
    function _mintNfpmPosition(
        address token0, address token1,
        uint256 amount0Desired, uint256 amount1Desired,
        uint160 sqrtPriceX96, int24 bottomTick, int24 topTick,
        uint16 slippageBps
    ) internal returns (uint256 tokenId, uint128 liquidityCreated) {
        if (nfpmContract == address(0)) revert NFPMNotSet();

        if (amount0Desired > 0) IERC20(token0).forceApprove(nfpmContract, amount0Desired);
        if (amount1Desired > 0) IERC20(token1).forceApprove(nfpmContract, amount1Desired);

        uint256 amount0Min;
        uint256 amount1Min;
        {
            uint160 sqrtLo = TickMath.getSqrtRatioAtTick(bottomTick);
            uint160 sqrtHi = TickMath.getSqrtRatioAtTick(topTick);
            uint128 liqPreview = LiquidityAmounts.getLiquidityForAmounts(
                sqrtPriceX96, sqrtLo, sqrtHi, amount0Desired, amount1Desired
            );
            if (liqPreview == 0) revert ZeroLiquidityPreview();
            (uint256 e0, uint256 e1) = LiquidityAmounts.getAmountsForLiquidity(
                sqrtPriceX96, sqrtLo, sqrtHi, liqPreview
            );
            uint256 bps = slippageBps > 0 ? slippageBps : defaultSlippageBps;
            amount0Min = e0 == 0 ? 0 : (e0 * (10_000 - bps)) / 10_000;
            amount1Min = e1 == 0 ? 0 : (e1 * (10_000 - bps)) / 10_000;
        }

        (tokenId, liquidityCreated, , ) = INonfungiblePositionManager(nfpmContract).mint(
            INonfungiblePositionManager.MintParams({
                token0: token0, token1: token1, deployer: address(0),
                tickLower: bottomTick, tickUpper: topTick,
                amount0Desired: amount0Desired, amount1Desired: amount1Desired,
                amount0Min: amount0Min, amount1Min: amount1Min,
                recipient: address(this), deadline: _deadline()
            })
        );

        if (amount0Desired > 0) IERC20(token0).forceApprove(nfpmContract, 0);
        if (amount1Desired > 0) IERC20(token1).forceApprove(nfpmContract, 0);
    }

    /**
     * @dev Cancel a pending position and return assets to Asset Hub
     * @notice Used when execution fails or position needs to be cancelled
     * @param assetHubPositionId The position ID from Asset Hub
     */
    function cancelPendingPosition(
        bytes32 assetHubPositionId
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
            _xcmTransferToAssetHub(token, amount, user);
            emit AssetsReturned(token, user, "", amount, 0);
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
        // Algebra/UV3 convention: in-range means bottomTick <= currentTick < topTick
        outOfRange = currentTick < position.bottomTick || currentTick >= position.topTick;

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
        bool outOfRange = currentTick < position.bottomTick || currentTick >= position.topTick;

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

        // H-3: Compute minimum amounts from known liquidity and tick range for slippage protection
        uint256 amount0Min;
        uint256 amount1Min;
        {
            (uint160 sqrtPriceX96, , , , , ) = IAlgebraPool(position.pool).globalState();
            uint160 sqrtRatioLowerX96 = TickMath.getSqrtRatioAtTick(position.bottomTick);
            uint160 sqrtRatioUpperX96 = TickMath.getSqrtRatioAtTick(position.topTick);
            (uint256 expected0, uint256 expected1) = LiquidityAmounts.getAmountsForLiquidity(
                sqrtPriceX96, sqrtRatioLowerX96, sqrtRatioUpperX96, position.liquidity
            );
            uint256 bps = defaultSlippageBps > 0 ? defaultSlippageBps : 100; // fallback 1%
            amount0Min = (expected0 * (10_000 - bps)) / 10_000;
            amount1Min = (expected1 * (10_000 - bps)) / 10_000;
        }

        // NFPM flow: decrease full liquidity then collect
        // decreaseLiquidity marks tokens as owed but does NOT transfer them.
        // collect() actually transfers and returns the total (decreased + fees).
        INonfungiblePositionManager(nfpmContract).decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: position.tokenId,
                liquidity: position.liquidity,
                amount0Min: amount0Min,
                amount1Min: amount1Min,
                deadline: _deadline()
            })
        );

        // collect returns the actual tokens transferred (removed liquidity + accrued fees)
        (amount0, amount1) = INonfungiblePositionManager(nfpmContract).collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: position.tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );

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
     * @param beneficiary The EVM address to deposit to on Asset Hub (converted to AccountId32 with EE-padding)
     */
    function returnAssets(
        address token,
        address user,
        uint256 amount,
        address beneficiary
    ) external onlyOwner whenNotPaused nonReentrant {
        if (!supportedTokens[token]) revert TokenNotSupported();
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 sendAmount = amount == 0 ? balance : amount;
        if (sendAmount > balance) revert InsufficientToken0();

        if (!testMode) {
            _xcmTransferToAssetHub(token, sendAmount, beneficiary);
        }

        emit AssetsReturned(token, user, "", sendAmount, 0);
    }

    /**
     * @dev Liquidate a position, swap all proceeds to base asset, and return to Asset Hub
     * @notice Operator must separately call settleLiquidation on AssetHub after assets arrive
     * @param positionId The Moonbeam position ID
     * @param baseAsset The asset to convert all proceeds to
     * @param beneficiary EVM address to deposit to on Asset Hub (converted to AccountId32)
     * @param minAmountOut0 Minimum output for token0 → baseAsset swap
     * @param minAmountOut1 Minimum output for token1 → baseAsset swap
     * @param limitSqrtPrice Price limit for swaps
     * @param assetHubPositionId The corresponding position ID on Asset Hub for reconciliation
     */
    function liquidateSwapAndReturn(
        uint256 positionId,
        address baseAsset,
        address beneficiary,
        uint256 minAmountOut0,
        uint256 minAmountOut1,
        uint160 limitSqrtPrice,
        bytes32 assetHubPositionId
    ) external onlyOperator whenNotPaused nonReentrant {
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
                IERC20(token0).forceApprove(swapRouterContract, amount0);
                uint256 out0 = ISwapRouter(swapRouterContract).exactInputSingle(
                    ISwapRouter.ExactInputSingleParams({
                        tokenIn: token0,
                        tokenOut: baseAsset,
                        recipient: address(this),
                        deadline: _deadline(),
                        amountIn: amount0,
                        amountOutMinimum: minAmountOut0,
                        limitSqrtPrice: limitSqrtPrice,
                        deployer: address(0)
                    })
                );
                IERC20(token0).forceApprove(swapRouterContract, 0);
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
                IERC20(token1).forceApprove(swapRouterContract, amount1);
                uint256 out1 = ISwapRouter(swapRouterContract).exactInputSingle(
                    ISwapRouter.ExactInputSingleParams({
                        tokenIn: token1,
                        tokenOut: baseAsset,
                        recipient: address(this),
                        deadline: _deadline(),
                        amountIn: amount1,
                        amountOutMinimum: minAmountOut1,
                        limitSqrtPrice: limitSqrtPrice,
                        deployer: address(0)
                    })
                );
                IERC20(token1).forceApprove(swapRouterContract, 0);
                totalBase += out1;
                emit ProceedsSwapped(token1, baseAsset, amount1, out1, positionId);
            }
        }

        if (totalBase == 0) revert SwapZeroOutput();

        if (!testMode) {
            _xcmTransferToAssetHub(baseAsset, totalBase, beneficiary);
        }

        // Mark position as fully Returned (phase 2 complete)
        position.status = PositionStatus.Returned;

        emit AssetsReturned(baseAsset, position.owner, "", totalBase, positionId);
        emit LiquidationCompleted(positionId, assetHubPositionId, position.owner, baseAsset, totalBase);
    }

    /**
     * @dev Phase 2: Swap liquidated proceeds and return to Asset Hub
     * @notice Use this AFTER calling executeFullLiquidation() or liquidateIfOutOfRange()
     * @param positionId The position ID (must be in Liquidated status)
     * @param baseAsset The asset to convert all proceeds to
     * @param beneficiary EVM address to deposit to on Asset Hub (converted to AccountId32)
     * @param minAmountOut0 Minimum output for token0 → baseAsset swap
     * @param minAmountOut1 Minimum output for token1 → baseAsset swap
     * @param limitSqrtPrice Price limit for swaps
     */
    function swapAndReturn(
        uint256 positionId,
        address baseAsset,
        address beneficiary,
        uint256 minAmountOut0,
        uint256 minAmountOut1,
        uint160 limitSqrtPrice
    ) external onlyOperator whenNotPaused nonReentrant {
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
                IERC20(token0).forceApprove(swapRouterContract, amount0);
                uint256 out0 = ISwapRouter(swapRouterContract).exactInputSingle(
                    ISwapRouter.ExactInputSingleParams({
                        tokenIn: token0,
                        tokenOut: baseAsset,
                        recipient: address(this),
                        deadline: _deadline(),
                        amountIn: amount0,
                        amountOutMinimum: minAmountOut0,
                        limitSqrtPrice: limitSqrtPrice,
                        deployer: address(0)
                    })
                );
                IERC20(token0).forceApprove(swapRouterContract, 0);
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
                IERC20(token1).forceApprove(swapRouterContract, amount1);
                uint256 out1 = ISwapRouter(swapRouterContract).exactInputSingle(
                    ISwapRouter.ExactInputSingleParams({
                        tokenIn: token1,
                        tokenOut: baseAsset,
                        recipient: address(this),
                        deadline: _deadline(),
                        amountIn: amount1,
                        amountOutMinimum: minAmountOut1,
                        limitSqrtPrice: limitSqrtPrice,
                        deployer: address(0)
                    })
                );
                IERC20(token1).forceApprove(swapRouterContract, 0);
                totalBase += out1;
                emit ProceedsSwapped(token1, baseAsset, amount1, out1, positionId);
            }
        }

        if (totalBase == 0) revert SwapZeroOutput();

        if (!testMode) {
            _xcmTransferToAssetHub(baseAsset, totalBase, beneficiary);
        }

        // Mark position as fully Returned
        position.status = PositionStatus.Returned;

        emit AssetsReturned(baseAsset, position.owner, "", totalBase, positionId);
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
                deadline: _deadline(),
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
        uint160 sqrtRatioLowerX96 = TickMath.getSqrtRatioAtTick(bottomTick);
        uint160 sqrtRatioUpperX96 = TickMath.getSqrtRatioAtTick(topTick);

        (uint256 ratio0, uint256 ratio1) = LiquidityAmounts.getAmountsForLiquidity(
            sqrtPriceX96, sqrtRatioLowerX96, sqrtRatioUpperX96, 1e18
        );

        if (ratio0 == 0 && ratio1 == 0) {
            if (tokenToUse == token0) return (totalAmount, 0);
            return (0, totalAmount);
        }

        // Convert ratio0 (token0 raw units) to token1-equivalent using the pool price.
        // price(token1/token0) = (sqrtPriceX96 / 2^96)^2
        // ratio0InToken1 = ratio0 * sqrtPriceX96^2 / 2^192
        //
        // Split the multiplication to avoid overflow: mulDiv twice by sqrtPriceX96 / 2^96.
        // This is safe because FullMath handles intermediate 512-bit products.
        uint256 Q96 = 1 << 96;
        uint256 ratio0InToken1 = FullMath.mulDiv(
            FullMath.mulDiv(ratio0, sqrtPriceX96, Q96),
            sqrtPriceX96,
            Q96
        );

        // Both values are now in token1 units — safe to add regardless of decimal mismatch
        uint256 totalValue = ratio0InToken1 + ratio1;
        if (totalValue == 0) {
            if (tokenToUse == token0) return (totalAmount, 0);
            return (0, totalAmount);
        }

        // The ideal ratio is computed at the pre-swap price, but the swap itself
        // moves the price AND loses value to slippage.  If we swap the "ideal"
        // amount we over-deplete the held token and under-receive the other.
        //
        // Fix: swap LESS than the ideal by a slippage-sized margin.  The NFPM
        // mint accepts `amount{0,1}Desired` and refunds unused tokens, so a
        // slight surplus of the held token is harmless.  A deficit of the
        // swapped-into token would revert the mint — so we'd rather keep more
        // of the held token than risk too little of the swapped token.
        uint256 bps = slippageBps > 0 ? slippageBps : defaultSlippageBps;

        uint256 amountToSwap;
        if (tokenToUse == token0) {
            // We hold token0, swap some to get token1
            uint256 idealSwap = FullMath.mulDiv(totalAmount, ratio1, totalValue);
            // Reduce swap by slippage margin so we keep enough token0
            amountToSwap = FullMath.mulDiv(idealSwap, 10_000 - bps, 10_000);
        } else if (tokenToUse == token1) {
            // We hold token1, swap some to get token0
            uint256 idealSwap = FullMath.mulDiv(totalAmount, ratio0InToken1, totalValue);
            amountToSwap = FullMath.mulDiv(idealSwap, 10_000 - bps, 10_000);
        } else {
            revert BaseAssetNotSupported();
        }

        if (tokenToUse == token0) {
            if (amountToSwap > 0) {
                uint256 received1 = _swapWithSlippage(token0, token1, amountToSwap, slippageBps);
                amount0 = totalAmount - amountToSwap;
                amount1 = received1;
                emit ProceedsSwapped(token0, token1, amountToSwap, received1, 1);
            } else {
                amount0 = totalAmount;
            }
        } else {
            if (amountToSwap > 0) {
                uint256 received0 = _swapWithSlippage(token1, token0, amountToSwap, slippageBps);
                amount0 = received0;
                amount1 = totalAmount - amountToSwap;
                emit ProceedsSwapped(token1, token0, amountToSwap, received0, 1);
            } else {
                amount1 = totalAmount;
            }
        }
    }


    /// @dev Get user position IDs with pagination
    function getUserPositions(address user, uint256 start, uint256 count) external view returns (uint256[] memory ids) {
        uint256[] storage allIds = userPositions[user];
        if (start >= allIds.length) return new uint256[](0);
        uint256 remaining = allIds.length - start;
        uint256 returnSize = count > remaining ? remaining : count;
        ids = new uint256[](returnSize);
        for (uint256 i = 0; i < returnSize; i++) {
            ids[i] = allIds[start + i];
        }
    }

    /// @dev Returns total number of positions for a user
    function getUserPositionCount(address user) external view returns (uint256) {
        return userPositions[user].length;
    }

    /// @dev Swap tokens held by this contract (e.g. collected fees, rebalancing)
    function swapExactInputSingle(
        address tokenIn,
        address tokenOut,
        address recipient,
        uint256 amountIn,
        uint256 amountOutMinimum,
        uint160 limitSqrtPrice
    ) external onlyOwner whenNotPaused nonReentrant returns (uint256 amountOut) {
        if (swapRouterContract == address(0)) revert SwapRouterNotSet();
        IERC20(tokenIn).forceApprove(swapRouterContract, amountIn);
        amountOut = _swapExactInputSingle(tokenIn, tokenOut, recipient, amountIn, amountOutMinimum, limitSqrtPrice);
        IERC20(tokenIn).forceApprove(swapRouterContract, 0);
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