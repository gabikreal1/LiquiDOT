// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.0;
pragma abicoder v2;

import './IAlgebraPool.sol';
import './IAlgebraMintCallback.sol';

/**
 * @title IERC20
 * @dev Minimal ERC20 interface for token operations
 */
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

/**
 * @title XCMProxy
 * @dev Lightweight proxy contract on Moonbeam that executes operations on behalf of the Asset Hub contract
 * Enhanced with position tracking and management to reduce the size of the AILiquidityProvider contract
 */
contract XCMProxy is IAlgebraMintCallback {
    // Owner address (Asset Hub contract via XCM)
    address public owner;
    
    // Position information
    struct Position {
        address pool;
        address token0;
        address token1;
        int24 bottomTick;
        int24 topTick;
        uint128 liquidity;
        bool active;
        address owner;
    }
    
    // Position tracking
    mapping(bytes32 => Position) public positions;
    mapping(address => bytes32[]) public userPositions;
    bytes32[] public allPositionIds;
    
    // Input for addLiquidity to avoid stack too deep
    struct LiquidityParams {
        address pool;
        address token0;
        address token1;
        uint8 rangeSize;
        uint128 liquidityDesired;
        address positionOwner;
    }
    
    // Events
    event LiquidityAdded(
        address indexed pool,
        address indexed recipient,
        int24 bottomTick,
        int24 topTick,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1,
        bytes32 positionId
    );
    
    event LiquidityRemoved(
        address indexed pool,
        int24 bottomTick,
        int24 topTick,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1,
        bytes32 positionId
    );
    
    constructor(address _owner) {
        owner = _owner;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    /**
     * @notice Execute a function call on a target contract
     * @param target The target contract address
     * @param data The function call data
     * @return The result of the call
     */
    function execute(address target, bytes calldata data) external payable onlyOwner returns (bytes memory) {
        (bool success, bytes memory result) = target.call{value: msg.value}(data);
        require(success, "Call failed");
        return result;
    }
    
    /**
     * @notice Execute a burn operation on a pool
     * @param pool The pool address
     * @param bottomTick The lower tick of the position
     * @param topTick The upper tick of the position
     * @param liquidity The amount of liquidity to burn
     * @return amount0 The amount of token0 received
     * @return amount1 The amount of token1 received
     */
    function executeBurn(
        address pool,
        int24 bottomTick,
        int24 topTick,
        uint128 liquidity
    ) external onlyOwner returns (uint256 amount0, uint256 amount1) {
        // Create a position ID for tracking removal
        bytes32 positionId = keccak256(abi.encodePacked(
            pool,
            bottomTick,
            topTick,
            "burn"
        ));
        
        // Call burn on the Algebra pool
        (amount0, amount1) = IAlgebraPool(pool).burn(
            bottomTick,
            topTick,
            liquidity
        );
        
        emit LiquidityRemoved(
            pool,
            bottomTick,
            topTick,
            liquidity,
            amount0,
            amount1,
            positionId
        );
        
        return (amount0, amount1);
    }
    
    /**
     * @notice Helper to add liquidity with automatic tick range calculation
     * @param params The liquidity parameters struct to avoid stack too deep
     * @return amount0 The amount of token0 used
     * @return amount1 The amount of token1 used
     */
    function addLiquidityAdapter(
        LiquidityParams calldata params
    ) external onlyOwner returns (uint256 amount0, uint256 amount1) {
        return _addLiquidity(params);
    }
    
    /**
     * @notice Helper function for backwards compatibility
     */
    function addLiquidityAdapter(
        address pool,
        address token0,
        address token1,
        uint8 rangeSize,
        uint128 liquidityDesired,
        address positionOwner
    ) external onlyOwner returns (uint256 amount0, uint256 amount1) {
        LiquidityParams memory params = LiquidityParams({
            pool: pool,
            token0: token0,
            token1: token1,
            rangeSize: rangeSize,
            liquidityDesired: liquidityDesired,
            positionOwner: positionOwner
        });
        
        return _addLiquidity(params);
    }
    
    /**
     * @notice Internal implementation for adding liquidity
     */
    function _addLiquidity(
        LiquidityParams memory params
    ) internal returns (uint256 amount0, uint256 amount1) {
        // Get the current state of the pool
        (,int24 currentTick,) = IAlgebraPool(params.pool).globalState();
        int24 tickSpacing = IAlgebraPool(params.pool).tickSpacing();
        
        // Calculate tick range based on size parameter
        int24 range;
        if (params.rangeSize == 0) { // NARROW
            range = 500;
        } else if (params.rangeSize == 1) { // MEDIUM
            range = 1000;
        } else if (params.rangeSize == 2) { // WIDE
            range = 3000;
        } else { // MAXIMUM
            range = 10000;
        }
        
        // Calculate bottom and top ticks
        int24 bottomTick = currentTick - range;
        int24 topTick = currentTick + range;
        
        // Ensure ticks are divisible by tickSpacing
        bottomTick = (bottomTick / tickSpacing) * tickSpacing;
        topTick = (topTick / tickSpacing) * tickSpacing;
        
        // Create position ID for tracking
        bytes32 positionId = keccak256(abi.encodePacked(
            params.pool,
            params.positionOwner,
            params.token0,
            params.token1,
            block.timestamp
        ));
        
        // Store position information
        _storePosition(
            positionId, 
            params.pool, 
            params.token0, 
            params.token1, 
            bottomTick, 
            topTick, 
            params.liquidityDesired, 
            params.positionOwner
        );
        
        // Approve tokens for the pool
        IERC20(params.token0).approve(params.pool, type(uint256).max);
        IERC20(params.token1).approve(params.pool, type(uint256).max);
        
        // Pack data for callback
        bytes memory data = abi.encode(params.token0, params.token1);
        
        // Call mint on the Algebra pool
        (amount0, amount1) = IAlgebraPool(params.pool).mint(
            address(this),  // sender (this contract handles callbacks)
            owner,          // recipient (set to owner)
            bottomTick,
            topTick,
            params.liquidityDesired,
            data
        );
        
        emit LiquidityAdded(
            params.pool,
            params.positionOwner,
            bottomTick,
            topTick,
            params.liquidityDesired,
            amount0,
            amount1,
            positionId
        );
        
        return (amount0, amount1);
    }
    
    /**
     * @notice Store position information
     */
    function _storePosition(
        bytes32 positionId,
        address pool,
        address token0,
        address token1,
        int24 bottomTick,
        int24 topTick,
        uint128 liquidity,
        address positionOwner
    ) internal {
        positions[positionId] = Position({
            pool: pool,
            token0: token0,
            token1: token1,
            bottomTick: bottomTick,
            topTick: topTick,
            liquidity: liquidity,
            active: true,
            owner: positionOwner
        });
        
        userPositions[positionOwner].push(positionId);
        allPositionIds.push(positionId);
    }
    
    /**
     * @notice Callback for Algebra mint
     * @dev Called by the Algebra pool after minting liquidity
     */
    function algebraMintCallback(
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external override {
        (address token0, address token1) = abi.decode(data, (address, address));
        
        // Transfer tokens to the pool (msg.sender is the pool)
        if (amount0 > 0) {
            IERC20(token0).transfer(msg.sender, amount0);
        }
        if (amount1 > 0) {
            IERC20(token1).transfer(msg.sender, amount1);
        }
    }
    
    /**
     * @notice Find a position by pool and ticks
     * @param pool The pool address
     * @param bottomTick The lower tick
     * @param topTick The upper tick
     * @return positionId The ID of the position if found
     */
    function findPosition(address pool, int24 bottomTick, int24 topTick) external view returns (bytes32) {
        for (uint256 i = 0; i < allPositionIds.length; i++) {
            Position storage pos = positions[allPositionIds[i]];
            if (pos.active && pos.pool == pool && pos.bottomTick == bottomTick && pos.topTick == topTick) {
                return allPositionIds[i];
            }
        }
        revert("Position not found");
    }
    
    /**
     * @notice Get all active positions
     * @return Array of position IDs
     */
    function getActivePositions() external view returns (bytes32[] memory) {
        uint256 activeCount = 0;
        
        // First, count active positions
        for (uint256 i = 0; i < allPositionIds.length; i++) {
            if (positions[allPositionIds[i]].active) {
                activeCount++;
            }
        }
        
        // Create array of active positions
        bytes32[] memory activePositions = new bytes32[](activeCount);
        uint256 index = 0;
        
        // Fill array with active position IDs
        for (uint256 i = 0; i < allPositionIds.length; i++) {
            if (positions[allPositionIds[i]].active) {
                activePositions[index] = allPositionIds[i];
                index++;
            }
        }
        
        return activePositions;
    }
    
    /**
     * @notice Get user positions
     * @param user The user address
     * @return Array of user's position IDs
     */
    function getUserPositions(address user) external view returns (bytes32[] memory) {
        return userPositions[user];
    }
    
    /**
     * @notice Get the balance of a token
     * @param token The token address
     * @return The balance of the token
     */
    function getBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
    
    /**
     * @notice Set a new owner
     * @param newOwner The new owner address
     */
    function setOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        owner = newOwner;
    }
    
    // Receive function to handle native asset transfers
    receive() external payable {}
} 