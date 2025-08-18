// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

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

    // Structs
    struct Position {
        address pool;
        address token0;
        address token1;
        int24 bottomTick;
        int24 topTick;
        uint128 liquidity;
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

        // Parse investment parameters and create position
        _createPositionFromParams(user, token, amount, investmentParams);
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

        // Create position
        uint256 positionId = _createPosition(
            poolId,
            baseAsset,
            address(0), // token1 placeholder
            bottomTick,
            topTick,
            1000, // liquidity placeholder
            positionOwner,
            lowerRangePercent,
            upperRangePercent
        );

        emit PositionCreated(
            positionId,
            positionOwner,
            poolId,
            baseAsset,
            address(0),
            bottomTick,
            topTick,
            1000
        );
    }

    /**
     * @dev Calculate tick range from percentage parameters
     */
    function calculateTickRange(
        address pool,
        int24 lowerRangePercent,
        int24 upperRangePercent
    ) public pure returns (int24 bottomTick, int24 topTick) {
        // Simplified calculation for local testing
        // In production, this would use actual pool price and tick math
        bottomTick = int24(lowerRangePercent * 100); // Convert percentage to tick
        topTick = int24(upperRangePercent * 100);
        
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

        // Simplified check for local testing
        // In production, this would check actual pool price against tick range
        currentPrice = 1000; // Placeholder price
        outOfRange = currentPrice < uint256(int256(position.bottomTick)) || 
                    currentPrice > uint256(int256(position.topTick));

        return (outOfRange, currentPrice);
    }

    /**
     * @dev Execute full liquidation of position
     */
    function executeFullLiquidation(
        uint256 positionId
    ) external onlyOwner nonReentrant returns (uint256 amount0, uint256 amount1) {
        Position storage position = positions[positionId];
        require(position.active, "Position not active");

        // Mark position as inactive
        position.active = false;

        // Calculate liquidation amounts (simplified for local testing)
        amount0 = 500; // Placeholder amounts
        amount1 = 500;

        emit PositionLiquidated(positionId, position.owner, amount0, amount1);

        return (amount0, amount1);
    }

    // Minimal adapter to interact with a pool's mint function (mock Algebra)
    function addLiquidityAdapter(
        address pool,
        address token0,
        address token1,
        uint8 /*rangeSize*/,
        uint128 liquidityDesired,
        address positionOwner
    ) external onlyOwner nonReentrant returns (uint256 amount0, uint256 amount1) {
        require(pool != address(0) && positionOwner != address(0), "invalid");

        // Simplified tick range for demo
        (int24 bottomTick, int24 topTick) = calculateTickRange(pool, -5, 10);

        // Call mock pool mint
        (amount0, amount1) = IAlgebraPool(pool).mint(
            address(this),
            positionOwner,
            bottomTick,
            topTick,
            liquidityDesired,
            bytes("")
        );

        uint256 positionId = _createPosition(
            pool,
            token0,
            token1,
            bottomTick,
            topTick,
            liquidityDesired,
            positionOwner,
            -5,
            10
        );

        emit LiquidityAdded(pool, positionOwner, bottomTick, topTick, liquidityDesired, amount0, amount1);
        emit PositionCreated(positionId, positionOwner, pool, token0, token1, bottomTick, topTick, liquidityDesired);
    }

    function executeBurn(
        address pool,
        int24 bottomTick,
        int24 topTick,
        uint128 liquidity
    ) external onlyOwner nonReentrant returns (uint256 amount0, uint256 amount1) {
        (amount0, amount1) = IAlgebraPool(pool).burn(bottomTick, topTick, liquidity);
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