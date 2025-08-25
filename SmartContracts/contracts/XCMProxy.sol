// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
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

/**
 * @title XCMProxy
 * @dev Cross-chain execution engine for LiquiDOT on Moonbeam
 */
contract XCMProxy is Ownable, ReentrancyGuard {
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

    // XCM precompile constants (per Frontier/Mandala-style XTokens). Adjust per-network during deployment.
    address private constant XTOKENS_PRECOMPILE = 0x0000000000000000000000000000000000000804;
    uint64 private constant DEFAULT_DEST_WEIGHT = 6_000_000_000; // conservative default

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
        address indexed recipient,
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
        // Initialize with common tokens
        supportedTokens[address(0)] = true; // Native token (DOT)
        supportedTokens[address(1)] = true; // USDC
        supportedTokens[address(2)] = true; // USDT
    }

    function setIntegrations(address quoter, address router) external onlyOwner {
        quoterContract = quoter;
        swapRouterContract = router;
    }

    function setNFPM(address nfpm) external onlyOwner {
        nfpmContract = nfpm;
    }

    /**
     * @dev Receive assets from XCM transfer
     */
    function receiveAssets(
        address token,
        address user,
        uint256 amount,
        bytes memory investmentParams
    ) external onlyOwner nonReentrant {
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Amount must be greater than 0");
        require(user != address(0), "Invalid user address");

        // In a real implementation, this would handle the actual token transfer
        // For local testing, we'll just emit the event
        emit AssetsReceived(token, user, amount, investmentParams);

        // Decode investment parameters coming from Asset Hub and execute
        // Expected encoding: (address poolId, uint256[] amounts, int24 lowerRangePercent, int24 upperRangePercent, address positionOwner)
        // Follow whitepaper flow: custody on AssetHub, execution here
        (
            address poolId,
            uint256[] memory amounts,
            int24 lowerRangePercent,
            int24 upperRangePercent,
            address positionOwner
        ) = abi.decode(investmentParams, (address, uint256[], int24, int24, address));

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

        uint128 liquidityCreated;
        uint256 tokenId;

        if (nfpmContract != address(0)) {
            if (amount0Desired > 0) IERC20(token0).safeIncreaseAllowance(nfpmContract, amount0Desired);
            if (amount1Desired > 0) IERC20(token1).safeIncreaseAllowance(nfpmContract, amount1Desired);

            (tokenId, liquidityCreated, , ) = INonfungiblePositionManager(nfpmContract).mint(
                INonfungiblePositionManager.MintParams({
                    token0: token0,
                    token1: token1,
                    deployer: address(0),
                    tickLower: bottomTick,
                    tickUpper: topTick,
                    amount0Desired: amount0Desired,
                    amount1Desired: amount1Desired,
                    amount0Min: 0,
                    amount1Min: 0,
                    recipient: address(this),
                    deadline: block.timestamp
                })
            );
        } else {
            bytes memory cbData = abi.encode(token0, token1, positionOwner);
            (uint256 a0, uint256 a1, uint128 liq) = IAlgebraPool(poolId).mint(
                address(this),
                positionOwner,
                bottomTick,
                topTick,
                uint128(amounts.length > 2 ? amounts[2] : 0),
                cbData
            );
            liquidityCreated = liq;
        }

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
    ) external onlyOwner nonReentrant {
        require(amounts.length > 0, "Amounts array cannot be empty");
        require(lowerRangePercent < upperRangePercent, "Invalid range");
        require(positionOwner != address(0), "Invalid position owner");

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

        if (nfpmContract != address(0)) {
            // Use NFPM flow (recommended). Approve NFPM to pull funds.
            if (amount0Desired > 0) IERC20(token0).safeIncreaseAllowance(nfpmContract, amount0Desired);
            if (amount1Desired > 0) IERC20(token1).safeIncreaseAllowance(nfpmContract, amount1Desired);

            (tokenId, liquidityCreated, , ) = INonfungiblePositionManager(nfpmContract).mint(
                INonfungiblePositionManager.MintParams({
                    token0: token0,
                    token1: token1,
                    deployer: address(0),
                    tickLower: bottomTick,
                    tickUpper: topTick,
                    amount0Desired: amount0Desired,
                    amount1Desired: amount1Desired,
                    amount0Min: 0,
                    amount1Min: 0,
                    recipient: address(this),
                    deadline: block.timestamp
                })
            );
        } else {
            // Fallback: direct pool mint with callback (legacy path)
            bytes memory cbData = abi.encode(token0, token1, positionOwner);
            (uint256 amount0, uint256 amount1, uint128 liquidityActual) = IAlgebraPool(poolId).mint(
                address(this),
                positionOwner,
                bottomTick,
                topTick,
                uint128(amounts.length > 2 ? amounts[2] : 0),
                cbData
            );
            liquidityCreated = liquidityActual;
        }

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
    ) external onlyOwner nonReentrant returns (uint256 amount0, uint256 amount1) {
        (amount0, amount1) = _liquidatePosition(positionId);
    }

    // Internal liquidation logic shared by multiple flows
    function _liquidatePosition(uint256 positionId) internal returns (uint256 amount0, uint256 amount1) {
        Position storage position = positions[positionId];
        require(position.active, "Position not active");

        if (position.tokenId != 0 && nfpmContract != address(0)) {
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

            // Optionally burn NFT to clean up
            INonfungiblePositionManager(nfpmContract).burn(position.tokenId);
        } else {
            // Direct pool flow
            (amount0, amount1) = IAlgebraPool(position.pool).burn(
                position.bottomTick,
                position.topTick,
                position.liquidity,
                bytes("")
            );

            // Collect everything owed from the pool (if any)
            (uint128 c0, uint128 c1) = IAlgebraPool(position.pool).collect(
                address(this),
                position.bottomTick,
                position.topTick,
                type(uint128).max,
                type(uint128).max
            );
            if (amount0 == 0 && amount1 == 0) {
                amount0 = c0;
                amount1 = c1;
            }
        }

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
        address recipient
    ) external onlyOwner nonReentrant {
        require(recipient != address(0), "invalid recipient");
        require(supportedTokens[token], "Token not supported");
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 sendAmount = amount == 0 ? balance : amount;
        require(sendAmount <= balance, "insufficient balance");
        // If recipient is this chain address: do local transfer; otherwise, optionally send via XCM precompile
        // For cross-chain (Asset Hub) delivery, pass recipient==address(0) upstream and we use XTokens
        if (recipient == address(0)) {
            // Encode destination MultiLocation bytes (placeholder ABI encoding; adjust to network-specific SCALE layout)
            // Using user as AccountId32 target on Asset Hub
            bytes memory accountId32 = abi.encodePacked(bytes12(0), user);
            bytes memory dest = abi.encode(accountId32);
            IERC20(token).safeIncreaseAllowance(XTOKENS_PRECOMPILE, sendAmount);
            IXTokens(XTOKENS_PRECOMPILE).transfer(token, sendAmount, dest, DEFAULT_DEST_WEIGHT);
        } else {
            IERC20(token).safeTransfer(recipient, sendAmount);
        }
        emit AssetsReturned(token, user, recipient, sendAmount, 0);
    }

    /**
     * @dev Liquidate a position, optionally swap all proceeds to a base asset, and return to Asset Hub recipient.
     * minAmountOut0/minAmountOut1 apply to swaps from token0/token1 into baseAsset when needed.
     */
    function liquidateSwapAndReturn(
        uint256 positionId,
        address baseAsset,
        address recipient,
        uint256 minAmountOut0,
        uint256 minAmountOut1,
        uint160 limitSqrtPrice
    ) external onlyOwner nonReentrant {
        require(recipient != address(0), "invalid recipient");
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
        if (recipient == address(0)) {
            bytes memory accountId32 = abi.encodePacked(bytes12(0), position.owner);
            bytes memory dest = abi.encode(accountId32);
            IERC20(baseAsset).safeIncreaseAllowance(XTOKENS_PRECOMPILE, totalBase);
            IXTokens(XTOKENS_PRECOMPILE).transfer(baseAsset, totalBase, dest, DEFAULT_DEST_WEIGHT);
        } else {
            IERC20(baseAsset).safeTransfer(recipient, totalBase);
        }
        emit AssetsReturned(baseAsset, position.owner, recipient, totalBase, positionId);
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
        onlyOwner
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

    // Algebra mint callback to pull tokens during liquidity minting
    function algebraMintCallback(uint256 amount0, uint256 amount1, bytes calldata data) external nonReentrant {
        (address token0, address token1, address _positionOwner) = abi.decode(data, (address, address, address));

        if (amount0 > 0) {
            IERC20(token0).safeTransfer(msg.sender, amount0);
        }
        if (amount1 > 0) {
            IERC20(token1).safeTransfer(msg.sender, amount1);
        }
    }

    // Swap exact input single via Algebra router
    function swapExactInputSingle(
        address tokenIn,
        address tokenOut,
        address recipient,
        uint256 amountIn,
        uint256 amountOutMinimum,
        uint160 limitSqrtPrice
    ) external onlyOwner nonReentrant returns (uint256 amountOut) {
        require(swapRouterContract != address(0), "router not set");
        IERC20(tokenIn).safeIncreaseAllowance(swapRouterContract, amountIn);
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
     * @dev Internal function to create position from XCM parameters
     */
    function _createPositionFromParams(
        address user,
        address token,
        uint256 amount,
        bytes memory params
    ) internal {
        // Parse investment parameters (simplified for local testing)
        // In production, this would decode actual XCM parameters
        
        uint256 positionId = _createPosition(
            address(0), // pool placeholder
            token,
            address(0), // token1 placeholder
            -500, // bottomTick placeholder
            500,  // topTick placeholder
            1000, // liquidity placeholder
            0,    // tokenId placeholder
            user,
            -5,   // lowerRangePercent placeholder
            10    // upperRangePercent placeholder
        );

        emit PositionCreated(
            positionId,
            user,
            address(0),
            token,
            address(0),
            -500,
            500,
            1000
        );
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