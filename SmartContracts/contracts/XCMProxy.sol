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
 * This contract only handles pool interactions and has no state management logic
 */
contract XCMProxy is IAlgebraMintCallback {
    // Owner address (Asset Hub contract via XCM)
    address public owner;
    
    // Events
    event LiquidityAdded(
        address indexed pool,
        address indexed recipient,
        int24 bottomTick,
        int24 topTick,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
    );
    
    event LiquidityRemoved(
        address indexed pool,
        int24 bottomTick,
        int24 topTick,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
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
            amount1
        );
        
        return (amount0, amount1);
    }
    
    /**
     * @notice Helper to add liquidity with automatic tick range calculation
     * @param pool The Algebra pool address
     * @param token0 Token0 address
     * @param token1 Token1 address
     * @param rangeSize The tick range size (0=NARROW, 1=MEDIUM, 2=WIDE, 3=MAXIMUM)
     * @param liquidityDesired The amount of liquidity to add
     * @return amount0 The amount of token0 used
     * @return amount1 The amount of token1 used
     */
    function addLiquidityAdapter(
        address pool,
        address token0,
        address token1,
        uint8 rangeSize,
        uint128 liquidityDesired
    ) external onlyOwner returns (uint256 amount0, uint256 amount1) {
        // Get the current state of the pool
        (,int24 currentTick,) = IAlgebraPool(pool).globalState();
        int24 tickSpacing = IAlgebraPool(pool).tickSpacing();
        
        // Calculate tick range based on size parameter
        int24 range;
        if (rangeSize == 0) { // NARROW
            range = 500;
        } else if (rangeSize == 1) { // MEDIUM
            range = 1000;
        } else if (rangeSize == 2) { // WIDE
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
        
        // Approve tokens for the pool
        IERC20(token0).approve(pool, type(uint256).max);
        IERC20(token1).approve(pool, type(uint256).max);
        
        // Pack data for callback
        bytes memory data = abi.encode(token0, token1);
        
        // Call mint on the Algebra pool
        (amount0, amount1) = IAlgebraPool(pool).mint(
            address(this),  // sender (this contract handles callbacks)
            owner,          // recipient (set to owner)
            bottomTick,
            topTick,
            liquidityDesired,
            data
        );
        
        emit LiquidityAdded(
            pool,
            owner,
            bottomTick,
            topTick,
            liquidityDesired,
            amount0,
            amount1
        );
        
        return (amount0, amount1);
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