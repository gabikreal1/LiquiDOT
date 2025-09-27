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
 
 */
contract XCMProxy is Ownable, ReentrancyGuard, Pausable, ERC721Holder {
    using SafeERC20 for IERC20;

    // State variables
    mapping(address => bool) public supportedTokens;
    mapping(uint256 => Position) public positions;
    mapping(address => uint256[]) public userPositions;
    uint256 public positionCounter;

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

    // Structs
    struct Position {
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
        bool active;
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
        require(!xcmConfigFrozen, "xcm config frozen");
        xTokensPrecompile = precompile;
        emit XTokensPrecompileSet(precompile);
    }

    function setDefaultDestWeight(uint64 weight) external onlyOwner {
        require(!xcmConfigFrozen, "xcm config frozen");
        defaultDestWeight = weight;
        emit DefaultDestWeightSet(weight);
    }

    function setAssetHubParaId(uint32 paraId) external onlyOwner {
        require(!xcmConfigFrozen, "xcm config frozen");
        assetHubParaId = paraId;
        emit AssetHubParaIdSet(paraId);
    }

    function setTrustedXcmCaller(address caller) external onlyOwner {
        require(!xcmConfigFrozen, "xcm config frozen");
        trustedXcmCaller = caller;
        emit TrustedXcmCallerSet(caller);
    }

    function freezeXcmConfig() external onlyOwner {
        require(!xcmConfigFrozen, "already frozen");
        xcmConfigFrozen = true;
        emit XcmConfigFrozen();
    }

    // ===== XCM Transactor Precompile integration (Moonbeam) =====

    event XcmTransactorPrecompileSet(address indexed precompile);
    event DefaultSlippageSet(uint16 bps);
    event XcmTransferAttempt(address indexed token, bytes dest, uint256 amount, bool success, bytes errorData);
    event XcmRemoteCallAttempt(
        uint32 paraId,
        uint16 feeLocation,
        uint64 transactRequiredWeightAtMost,
        uint256 feeAmount,
        uint64 overallWeight,
        bool success,
        bytes errorData
    );

    modifier onlyOperator() {
        require(msg.sender == operator, "not operator");
        _;
    }

    function setOperator(address newOperator) external onlyOwner {
        operator = newOperator;
        emit OperatorUpdated(newOperator);
    }

    function setXcmTransactorPrecompile(address precompile) external onlyOwner {
        xcmTransactorPrecompile = precompile;
        emit XcmTransactorPrecompileSet(precompile);
    }

    function setDefaultSlippageBps(uint16 bps) external onlyOwner {
        require(bps <= 10_000, "bps too high");
        defaultSlippageBps = bps;
        emit DefaultSlippageSet(bps);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Helper to compose a pallet call payload: [palletIndex (u8)] [callIndex (u8)] [SCALE-encoded args]
     * The args parameter must already be SCALE-encoded for the destination runtime.
     */
    function buildPalletCallBytes(uint8 palletIndex, uint8 callIndex, bytes memory /*scaleEncodedArgs*/)
        public
        pure
        returns (bytes memory)
    {
        // placeholder impl retained for decoding try/catch usage
        return abi.encodePacked(palletIndex, callIndex);
    }

    /**
     * @dev Execute a remote Substrate runtime call on Asset Hub via Moonbeam's XCM Transactor precompile.
     * @param feeLocation Assets location index on destination (implementation-specific); pass 1 for common configs
     * @param transactRequiredWeightAtMost Max weight for destination call execution
     * @param call SCALE-encoded runtime call bytes (palletIndex + callIndex + args)
     * @param feeAmount Amount of fee token for XCM execution on destination
     * @param overallWeight Overall weight allotted for XCM program execution
     */
    function remoteCallAssetHub(
        uint16 feeLocation,
        uint64 transactRequiredWeightAtMost,
        bytes calldata call,
        uint256 feeAmount,
        uint64 overallWeight
    ) external onlyOwner whenNotPaused nonReentrant {
        require(assetHubParaId != 0, "paraId not set");
        require(xcmTransactorPrecompile != address(0), "xcm tx precompile not set");
        bool success = false;
        bytes memory err;
        try IXCMTransactor(xcmTransactorPrecompile).transactThroughDerivative(
            assetHubParaId,
            feeLocation,
            transactRequiredWeightAtMost,
            call,
            feeAmount,
            overallWeight
        ) {
            success = true;
        } catch (bytes memory reason) {
            err = reason;
        }
        emit XcmRemoteCallAttempt(
            assetHubParaId,
            feeLocation,
            transactRequiredWeightAtMost,
            feeAmount,
            overallWeight,
            success,
            err
        );
    }

    // ===== Internal helpers: MultiLocation encoding for destination =====
    /**
     * @dev Receive assets from XCM transfer
     */
    function receiveAssets(
        address token,
        address user,
        uint256 amount,
        bytes memory investmentParams
    ) external whenNotPaused nonReentrant {
        require(
            msg.sender == owner() || (trustedXcmCaller != address(0) && msg.sender == trustedXcmCaller),
            "not authorized"
        );
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Amount must be greater than 0");
        require(user != address(0), "Invalid user address");

        // In a real implementation, this would handle the actual token transfer
        // For local testing, we'll just emit the event
        emit AssetsReceived(token, user, amount, investmentParams);

        // Decode investment parameters coming from Asset Hub (V1 schema)
        // (address poolId, address baseAsset, uint256[] amounts, int24 lowerRangePercent, int24 upperRangePercent, address positionOwner)
        address poolId;
        address baseAsset;
        uint256[] memory amounts;
        int24 lowerRangePercent;
        int24 upperRangePercent;
        address positionOwner;
        uint16 slippageBps;
        (poolId, baseAsset, amounts, lowerRangePercent, upperRangePercent, positionOwner, slippageBps) =
            abi.decode(investmentParams, (address, address, uint256[], int24, int24, address, uint16));

        // Ensure the transferred token matches the declared baseAsset
        require(token == baseAsset, "asset mismatch");

        // Execute investment inline (avoid nonReentrant external self-call)
        (int24 bottomTick, int24 topTick) = calculateTickRange(
            poolId,
            lowerRangePercent,
            upperRangePercent
        );

        address token0 = IAlgebraPool(poolId).token0();
        address token1 = IAlgebraPool(poolId).token1();

        uint256 amount0Desired = amounts.length > 0 ? amounts[0] : 0;
        uint256 amount1Desired = amounts.length > 1 ? amounts[1] : 0;

        require(IERC20(baseAsset).balanceOf(address(this)) >= amount, "insufficient base funding");
        if (amount0Desired > 0) {
            require(IERC20(token0).balanceOf(address(this)) >= amount0Desired, "insufficient token0 funds");
        }
        if (amount1Desired > 0) {
            require(IERC20(token1).balanceOf(address(this)) >= amount1Desired, "insufficient token1 funds");
        }

        uint128 liquidityCreated;
        uint256 tokenId;

        require(nfpmContract != address(0), "NFPM not set");
        // Manage allowances tightly
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

        uint256 bps = slippageBps > 0 ? slippageBps : defaultSlippageBps;
        uint256 amount0Min = amount0Desired == 0 ? 0 : (amount0Desired * (10_000 - bps)) / 10_000;
        uint256 amount1Min = amount1Desired == 0 ? 0 : (amount1Desired * (10_000 - bps)) / 10_000;

        (tokenId, liquidityCreated, , ) = INonfungiblePositionManager(nfpmContract).mint(
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

        // Reset allowances back to 0
        if (amount0Desired > 0) IERC20(token0).forceApprove(nfpmContract, 0);
        if (amount1Desired > 0) IERC20(token1).forceApprove(nfpmContract, 0);

        uint256 positionId = _createPosition(
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

        emit PositionCreated(
            positionId,
            positionOwner,
            poolId,
            token0,
            token1,
            bottomTick,
            topTick,
            liquidityCreated
        );
    }

    /**
     * @dev Create LP position with asymmetric range
     */
    function executeInvestment(
        address baseAsset,
        uint256[] memory amounts,
        address poolId,
        int24 lowerRangePercent,
        int24 upperRangePercent,
        address positionOwner
    ) external onlyOwner whenNotPaused nonReentrant {
        require(amounts.length > 0, "Amounts array cannot be empty");
        require(lowerRangePercent < upperRangePercent, "Invalid range");
        require(positionOwner != address(0), "Invalid position owner");
        require(supportedTokens[baseAsset], "base asset not supported");

        // Calculate tick range based on percentages
        (int24 bottomTick, int24 topTick) = calculateTickRange(
            poolId,
            lowerRangePercent,
            upperRangePercent
        );

        // Determine tokens from the pool
        address token0 = IAlgebraPool(poolId).token0();
        address token1 = IAlgebraPool(poolId).token1();

        uint256 amount0Desired = amounts.length > 0 ? amounts[0] : 0;
        uint256 amount1Desired = amounts.length > 1 ? amounts[1] : 0;

        uint128 liquidityCreated;
        uint256 tokenId;

        require(nfpmContract != address(0), "NFPM not set");
        // Use NFPM flow (enforced). Tight allowances
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

        uint256 amount0Min = amount0Desired == 0 ? 0 : (amount0Desired * (10_000 - defaultSlippageBps)) / 10_000;
        uint256 amount1Min = amount1Desired == 0 ? 0 : (amount1Desired * (10_000 - defaultSlippageBps)) / 10_000;

        (tokenId, liquidityCreated, , ) = INonfungiblePositionManager(nfpmContract).mint(
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

        if (amount0Desired > 0) IERC20(token0).forceApprove(nfpmContract, 0);
        if (amount1Desired > 0) IERC20(token1).forceApprove(nfpmContract, 0);

        // Create position
        uint256 positionId = _createPosition(
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

        emit PositionCreated(
            positionId,
            positionOwner,
            poolId,
            token0,
            token1,
            bottomTick,
            topTick,
            liquidityCreated
        );
    }

    /**
     * @dev Calculate tick range from percentage parameters
     */
    function calculateTickRange(
        address pool,
        int24 lowerRangePercent,
        int24 upperRangePercent
    ) public view returns (int24 bottomTick, int24 topTick) {
        // Sanity caps: [-1000%, 1000%]
        require(lowerRangePercent > -1000 && upperRangePercent <= 1000 && lowerRangePercent < upperRangePercent, "range out of bounds");
        // Use current pool tick and tick spacing; approximate 1% ~= 100 ticks
        (, int24 currentTick, , , , ) = IAlgebraPool(pool).globalState();
        int24 spacing = IAlgebraPool(pool).tickSpacing();

        int24 downTicks = int24(lowerRangePercent * 100);
        int24 upTicks = int24(upperRangePercent * 100);

        // Align to tick spacing
        int24 rawBottom = currentTick + downTicks;
        int24 rawTop = currentTick + upTicks;

        bottomTick = rawBottom - (rawBottom % spacing);
        topTick = rawTop - (rawTop % spacing);

        return (bottomTick, topTick);
    }

    /**
     * @dev Check if position is out of range
     */
    function isPositionOutOfRange(
        uint256 positionId
    ) public view returns (bool outOfRange, uint256 currentPrice) {
        Position storage position = positions[positionId];
        require(position.active, "Position not active");

        // Use current pool tick as proxy for price range evaluation
        (, int24 currentTick, , , , ) = IAlgebraPool(position.pool).globalState();
        // Return tick as an unsigned value for backward compat with event
        currentPrice = uint256(int256(currentTick));
        outOfRange = currentTick < position.bottomTick || currentTick > position.topTick;

        return (outOfRange, currentPrice);
    }

    /**
     * @dev Execute full liquidation of position
     */
    function executeFullLiquidation(
        uint256 positionId
    ) external onlyOperator whenNotPaused nonReentrant returns (uint256 amount0, uint256 amount1) {
        return _liquidatePosition(positionId);
    }

    // Internal liquidation logic shared by multiple flows
    function _liquidatePosition(uint256 positionId) internal returns (uint256 amount0, uint256 amount1) {
        Position storage position = positions[positionId];
        require(position.active, "Position not active");

        require(position.tokenId != 0 && nfpmContract != address(0), "NFPM position required");

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

        // Mark position as inactive
        position.active = false;
        position.liquidity = 0;

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
        require(destination.length != 0, "invalid destination");
        require(supportedTokens[token], "Token not supported");
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 sendAmount = amount == 0 ? balance : amount;
        require(sendAmount <= balance, "insufficient balance");
        require(xTokensPrecompile != address(0), "xtokens not set");
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
     * @dev Liquidate a position, optionally swap all proceeds to a base asset, and return to Asset Hub recipient.
     * minAmountOut0/minAmountOut1 apply to swaps from token0/token1 into baseAsset when needed.
     */
    function liquidateSwapAndReturn(
        uint256 positionId,
        address baseAsset,
        bytes calldata destination,
        uint256 minAmountOut0,
        uint256 minAmountOut1,
        uint160 limitSqrtPrice
    ) external onlyOperator whenNotPaused nonReentrant {
        require(destination.length != 0, "invalid destination");
        Position storage position = positions[positionId];
        require(position.active, "Position not active");
        require(supportedTokens[baseAsset], "base not supported");

        address token0 = position.token0;
        address token1 = position.token1;

        (uint256 amount0, uint256 amount1) = _liquidatePosition(positionId);

        uint256 totalBase;
        // Handle token0 → baseAsset
        if (amount0 > 0) {
            if (token0 == baseAsset) {
                totalBase += amount0;
            } else {
                require(swapRouterContract != address(0), "router not set");
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
                require(swapRouterContract != address(0), "router not set");
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

        require(totalBase > 0, "no proceeds");
        // Send proceeds back. If recipient==address(0), ship via XCM, else local transfer
        require(xTokensPrecompile != address(0), "xtokens not set");
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
        emit AssetsReturned(baseAsset, position.owner, destination, totalBase, positionId);
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
        require(position.active, "Position not active");
        require(position.tokenId != 0 && nfpmContract != address(0), "NFPM not used");

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

    // Swap exact input single via Algebra router
    function swapExactInputSingle(
        address tokenIn,
        address tokenOut,
        address recipient,
        uint256 amountIn,
        uint256 amountOutMinimum,
        uint160 limitSqrtPrice
    ) external onlyOwner whenNotPaused nonReentrant returns (uint256 amountOut) {
        require(swapRouterContract != address(0), "router not set");
        // Tight allowance for router
        uint256 cur = IERC20(tokenIn).allowance(address(this), swapRouterContract);
        if (cur != 0) IERC20(tokenIn).forceApprove(swapRouterContract, 0);
        IERC20(tokenIn).forceApprove(swapRouterContract, amountIn);
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
        IERC20(tokenIn).forceApprove(swapRouterContract, 0);
    }

    // Public quote helper
    function quoteExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint160 limitSqrtPrice
    ) external returns (uint256 amountOut) {
        require(quoterContract != address(0), "quoter not set");
        (amountOut, ) = IQuoter(quoterContract).quoteExactInputSingle(tokenIn, tokenOut,  address(0), amountIn, limitSqrtPrice);
    }

    /**
     * @dev Get active positions
     */
    function getActivePositions() external view returns (Position[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 1; i <= positionCounter; i++) {
            if (positions[i].active) {
                activeCount++;
            }
        }

        Position[] memory activePositions = new Position[](activeCount);
        uint256 index = 0;
        for (uint256 i = 1; i <= positionCounter; i++) {
            if (positions[i].active) {
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

        positions[positionId] = Position({
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
            entryPrice: 1000, // placeholder
            timestamp: block.timestamp,
            active: true
        });

        userPositions[owner].push(positionId);

        return positionId;
    }
} 