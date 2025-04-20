// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.0;
pragma abicoder v2;

import './IAlgebraPool.sol';
import './IAlgebraMintCallback.sol';

// Interface for Algebra Quoter
interface IQuoter {
    function quoteExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint160 limitSqrtPrice
    ) external returns (uint256 amountOut, uint16 fee);
    
    function quoteExactInput(
        bytes memory path,
        uint256 amountIn
    ) external returns (uint256 amountOut, uint16[] memory fees);
    
    function quoteExactOutputSingle(
        address tokenIn,
        address tokenOut,
        uint256 amountOut,
        uint160 limitSqrtPrice
    ) external returns (uint256 amountIn, uint16 fee);
    
    function quoteExactOutput(
        bytes memory path,
        uint256 amountOut
    ) external returns (uint256 amountIn, uint16[] memory fees);
}

// Interface for Algebra SwapRouter
interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 limitSqrtPrice;
    }
    
    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }
    
    struct ExactOutputSingleParams {
        address tokenIn;
        address tokenOut;
        address recipient;
        uint256 deadline;
        uint256 amountOut;
        uint256 amountInMaximum;
        uint160 limitSqrtPrice;
    }
    
    struct ExactOutputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountOut;
        uint256 amountInMaximum;
    }
    
    function exactInputSingle(
        ExactInputSingleParams calldata params
    ) external payable returns (uint256 amountOut);
    
    function exactInput(
        ExactInputParams calldata params
    ) external payable returns (uint256 amountOut);
    
    function exactOutputSingle(
        ExactOutputSingleParams calldata params
    ) external payable returns (uint256 amountIn);
    
    function exactOutput(
        ExactOutputParams calldata params
    ) external payable returns (uint256 amountIn);
}

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
    
    // Algebra contracts
    address public immutable quoterContract;
    address public immutable swapRouterContract;
    
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
    
    // Token balances tracking
    mapping(address => mapping(address => uint256)) public tokenBalances;
    
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
    
    event TokenDeposited(address indexed token, address indexed user, uint256 amount);
    event TokenWithdrawn(address indexed token, address indexed user, uint256 amount);
    event Swapped(
        address indexed tokenIn,
        address indexed tokenOut,
        address indexed user,
        uint256 amountIn,
        uint256 amountOut
    );
    event QuoteReceived(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint16 fee
    );
    
    constructor(address _owner, address _quoterContract, address _swapRouterContract) {
        owner = _owner;
        quoterContract = _quoterContract;
        swapRouterContract = _swapRouterContract;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    /**
     * @notice Direct deposit of tokens by users
     * @param token The token address to deposit
     * @param amount The amount to deposit
     */
    function deposit(address token, uint256 amount) external {
        require(token != address(0), "Invalid token");
        require(amount > 0, "Zero amount");
        
        // Transfer tokens from sender to this contract
        bool success = IERC20(token).transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");
        
        // Update user balance
        tokenBalances[msg.sender][token] += amount;
        
        emit TokenDeposited(token, msg.sender, amount);
    }
    
    /**
     * @notice Direct withdrawal of tokens by users
     * @param token The token address to withdraw
     * @param amount The amount to withdraw
     */
    function withdraw(address token, uint256 amount) external {
        require(tokenBalances[msg.sender][token] >= amount, "Insufficient balance");
        
        // Update user balance
        tokenBalances[msg.sender][token] -= amount;
        
        // Transfer tokens to sender
        bool success = IERC20(token).transfer(msg.sender, amount);
        require(success, "Transfer failed");
        
        emit TokenWithdrawn(token, msg.sender, amount);
    }
    
    /**
     * @notice Deposit tokens into the contract via XCM
     * @param token The token address
     * @param user The user who owns these tokens
     * @param amount The amount to deposit
     */
    function depositTokens(address token, address user, uint256 amount) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(amount > 0, "Zero amount");
        
        // When called via XCM, tokens will already be in this contract
        // Just update the user's balance
        tokenBalances[user][token] += amount;
        
        emit TokenDeposited(token, user, amount);
    }
    
    /**
     * @notice Withdraw tokens from the contract via XCM
     * @param token The token address
     * @param user The user receiving the tokens
     * @param amount The amount to withdraw
     * @param recipient The address to receive the tokens
     */
    function withdrawTokens(address token, address user, uint256 amount, address recipient) external onlyOwner {
        require(tokenBalances[user][token] >= amount, "Insufficient balance");
        
        // Update user balance
        tokenBalances[user][token] -= amount;
        
        // Transfer tokens to recipient
        bool success = IERC20(token).transfer(recipient, amount);
        require(success, "Transfer failed");
        
        emit TokenWithdrawn(token, user, amount);
    }
    
    /**
     * @notice Transfer tokens between users in this contract
     * @param token The token address
     * @param to The recipient address
     * @param amount The amount to transfer
     */
    function transferBalance(address token, address to, uint256 amount) external {
        require(tokenBalances[msg.sender][token] >= amount, "Insufficient balance");
        require(to != address(0), "Invalid recipient");
        
        // Update balances
        tokenBalances[msg.sender][token] -= amount;
        tokenBalances[to][token] += amount;
        
        emit TokenWithdrawn(token, msg.sender, amount);
        emit TokenDeposited(token, to, amount);
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
     * @notice Get token balance for a user
     * @param user The user address
     * @param token The token address
     * @return The user's balance of the token
     */
    function getUserTokenBalance(address user, address token) external view returns (uint256) {
        return tokenBalances[user][token];
    }
    
    /**
     * @notice Get the balance of a token in this contract
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
    
    /**
     * @notice Get a quote for an exact input swap
     * @param tokenIn The token to swap from
     * @param tokenOut The token to swap to
     * @param amountIn The amount of tokenIn to swap
     * @param limitSqrtPrice The price limit (0 for no limit)
     * @return amountOut The amount of tokenOut that would be received
     * @return fee The fee percentage in basis points
     */
    function quoteExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint160 limitSqrtPrice
    ) external returns (uint256 amountOut, uint16 fee) {
        (amountOut, fee) = IQuoter(quoterContract).quoteExactInputSingle(
            tokenIn,
            tokenOut,
            amountIn,
            limitSqrtPrice
        );
        
        emit QuoteReceived(tokenIn, tokenOut, amountIn, amountOut, fee);
        return (amountOut, fee);
    }
    
    /**
     * @notice Get a quote for an exact output swap
     * @param tokenIn The token to swap from
     * @param tokenOut The token to swap to
     * @param amountOut The amount of tokenOut to receive
     * @param limitSqrtPrice The price limit (0 for no limit)
     * @return amountIn The amount of tokenIn that would be required
     * @return fee The fee percentage in basis points
     */
    function quoteExactOutputSingle(
        address tokenIn,
        address tokenOut,
        uint256 amountOut,
        uint160 limitSqrtPrice
    ) external returns (uint256 amountIn, uint16 fee) {
        (amountIn, fee) = IQuoter(quoterContract).quoteExactOutputSingle(
            tokenIn,
            tokenOut,
            amountOut,
            limitSqrtPrice
        );
        
        emit QuoteReceived(tokenIn, tokenOut, amountIn, amountOut, fee);
        return (amountIn, fee);
    }
    
    /**
     * @notice Execute an exact input swap via the router
     * @param tokenIn The token to swap from
     * @param tokenOut The token to swap to
     * @param recipient The address to receive the output tokens
     * @param amountIn The amount of input tokens to send
     * @param amountOutMinimum The minimum amount of output tokens to receive
     * @param limitSqrtPrice The price limit (0 for no limit)
     * @return amountOut The amount of tokens received
     */
    function swapExactInputSingle(
        address tokenIn,
        address tokenOut,
        address recipient,
        uint256 amountIn,
        uint256 amountOutMinimum,
        uint160 limitSqrtPrice
    ) external returns (uint256 amountOut) {
        // Check if user has enough balance
        require(tokenBalances[msg.sender][tokenIn] >= amountIn, "Insufficient balance");
        
        // Deduct from user's balance
        tokenBalances[msg.sender][tokenIn] -= amountIn;
        
        // Approve router to spend tokens
        IERC20(tokenIn).approve(swapRouterContract, amountIn);
        
        // Set up swap parameters
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            recipient: address(this),  // First receive to this contract
            deadline: block.timestamp + 300, // 5 minute deadline
            amountIn: amountIn,
            amountOutMinimum: amountOutMinimum,
            limitSqrtPrice: limitSqrtPrice
        });
        
        // Execute swap
        amountOut = ISwapRouter(swapRouterContract).exactInputSingle(params);
        
        // If recipient is this contract, update user balance
        if (recipient == address(this)) {
            tokenBalances[msg.sender][tokenOut] += amountOut;
        } else {
            // Otherwise transfer tokens to recipient
            IERC20(tokenOut).transfer(recipient, amountOut);
        }
        
        emit Swapped(tokenIn, tokenOut, msg.sender, amountIn, amountOut);
        return amountOut;
    }
    
    /**
     * @notice Execute an exact output swap via the router
     * @param tokenIn The token to swap from
     * @param tokenOut The token to swap to
     * @param recipient The address to receive the output tokens
     * @param amountOut The exact amount of output tokens to receive
     * @param amountInMaximum The maximum amount of input tokens to send
     * @param limitSqrtPrice The price limit (0 for no limit)
     * @return amountIn The amount of tokens sent
     */
    function swapExactOutputSingle(
        address tokenIn,
        address tokenOut,
        address recipient,
        uint256 amountOut,
        uint256 amountInMaximum,
        uint160 limitSqrtPrice
    ) external returns (uint256 amountIn) {
        // Check if user has enough balance
        require(tokenBalances[msg.sender][tokenIn] >= amountInMaximum, "Insufficient balance");
        
        // First approve maximum amount (will refund unused)
        IERC20(tokenIn).approve(swapRouterContract, amountInMaximum);
        
        // Set up swap parameters
        ISwapRouter.ExactOutputSingleParams memory params = ISwapRouter.ExactOutputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            recipient: address(this),  // First receive to this contract
            deadline: block.timestamp + 300, // 5 minute deadline
            amountOut: amountOut,
            amountInMaximum: amountInMaximum,
            limitSqrtPrice: limitSqrtPrice
        });
        
        // Execute swap
        amountIn = ISwapRouter(swapRouterContract).exactOutputSingle(params);
        
        // Deduct actual amount used from user's balance
        tokenBalances[msg.sender][tokenIn] -= amountIn;
        
        // If recipient is this contract, update user balance
        if (recipient == address(this)) {
            tokenBalances[msg.sender][tokenOut] += amountOut;
        } else {
            // Otherwise transfer tokens to recipient
            IERC20(tokenOut).transfer(recipient, amountOut);
        }
        
        emit Swapped(tokenIn, tokenOut, msg.sender, amountIn, amountOut);
        return amountIn;
    }
    
    /**
     * @notice Execute a multi-hop exact input swap
     * @param path The encoded swap path
     * @param recipient The address to receive the output tokens
     * @param amountIn The amount of input tokens to send
     * @param amountOutMinimum The minimum amount of output tokens to receive
     * @return amountOut The amount of tokens received
     */
    function swapExactInput(
        bytes calldata path,
        address recipient,
        uint256 amountIn,
        uint256 amountOutMinimum
    ) external returns (uint256 amountOut) {
        // Extract tokenIn from the path
        address tokenIn;
        assembly {
            tokenIn := shr(96, calldataload(path.offset))
        }
        
        // Extract tokenOut from the path (last token)
        address tokenOut;
        uint256 pathLength = path.length;
        assembly {
            tokenOut := shr(96, calldataload(add(path.offset, sub(pathLength, 20))))
        }
        
        // Check if user has enough balance
        require(tokenBalances[msg.sender][tokenIn] >= amountIn, "Insufficient balance");
        
        // Deduct from user's balance
        tokenBalances[msg.sender][tokenIn] -= amountIn;
        
        // Approve router to spend tokens
        IERC20(tokenIn).approve(swapRouterContract, amountIn);
        
        // Set up swap parameters
        ISwapRouter.ExactInputParams memory params = ISwapRouter.ExactInputParams({
            path: path,
            recipient: address(this),  // First receive to this contract
            deadline: block.timestamp + 300, // 5 minute deadline
            amountIn: amountIn,
            amountOutMinimum: amountOutMinimum
        });
        
        // Execute swap
        amountOut = ISwapRouter(swapRouterContract).exactInput(params);
        
        // If recipient is this contract, update user balance
        if (recipient == address(this)) {
            tokenBalances[msg.sender][tokenOut] += amountOut;
        } else {
            // Otherwise transfer tokens to recipient
            IERC20(tokenOut).transfer(recipient, amountOut);
        }
        
        emit Swapped(tokenIn, tokenOut, msg.sender, amountIn, amountOut);
        return amountOut;
    }
    
    /**
     * @notice Execute a multi-hop exact output swap
     * @param path The encoded swap path (in reverse order)
     * @param recipient The address to receive the output tokens
     * @param amountOut The exact amount of output tokens to receive
     * @param amountInMaximum The maximum amount of input tokens to send
     * @return amountIn The amount of tokens sent
     */
    function swapExactOutput(
        bytes calldata path,
        address recipient,
        uint256 amountOut,
        uint256 amountInMaximum
    ) external returns (uint256 amountIn) {
        // For exactOutput, the first token in the path is the output token
        // and the last token in the path is the input token
        
        // Extract tokenIn from the path (last token)
        address tokenIn;
        uint256 pathLength = path.length;
        assembly {
            tokenIn := shr(96, calldataload(add(path.offset, sub(pathLength, 20))))
        }
        
        // Extract tokenOut from the path (first token)
        address tokenOut;
        assembly {
            tokenOut := shr(96, calldataload(path.offset))
        }
        
        // Check if user has enough balance
        require(tokenBalances[msg.sender][tokenIn] >= amountInMaximum, "Insufficient balance");
        
        // Approve router to spend tokens
        IERC20(tokenIn).approve(swapRouterContract, amountInMaximum);
        
        // Set up swap parameters
        ISwapRouter.ExactOutputParams memory params = ISwapRouter.ExactOutputParams({
            path: path,
            recipient: address(this),  // First receive to this contract
            deadline: block.timestamp + 300, // 5 minute deadline
            amountOut: amountOut,
            amountInMaximum: amountInMaximum
        });
        
        // Execute swap
        amountIn = ISwapRouter(swapRouterContract).exactOutput(params);
        
        // Deduct actual amount used from user's balance
        tokenBalances[msg.sender][tokenIn] -= amountIn;
        
        // If recipient is this contract, update user balance
        if (recipient == address(this)) {
            tokenBalances[msg.sender][tokenOut] += amountOut;
        } else {
            // Otherwise transfer tokens to recipient
            IERC20(tokenOut).transfer(recipient, amountOut);
        }
        
        emit Swapped(tokenIn, tokenOut, msg.sender, amountIn, amountOut);
        return amountIn;
    }
    
    // Receive function to handle native asset transfers
    receive() external payable {}
} 