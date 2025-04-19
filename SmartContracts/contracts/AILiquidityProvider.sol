// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.0;
pragma abicoder v2;


import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './IReactive.sol';

/**
 * @title AISwapExecutorReactive
 * @dev Simplified contract that allows a single AI agent to execute trades on Uniswap V3 based on price thresholds
 * Supports a single user (the owner) and implements the Reactive interface
 */
contract AISwapExecutorReactive is IReactive, Ownable {
    using SafeERC20 for IERC20;

    // Single AI agent address that can execute trades
    address public aiAgent;
    
    // Token balances storage
    mapping(address => uint256) public tokenBalances;
    
    // Active thresholds tracking
    mapping(bytes32 => bool) public activeThresholds;
    
    // Trade parameters
    struct TradeParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint256 deadline;
    }
    
    // Price threshold for reactive trading
    struct PriceThreshold {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        uint256 thresholdPrice;
        bool isAbove;
        bool isActive;
    }
    
    // Store all price thresholds
    mapping(bytes32 => PriceThreshold) public priceThresholds;
    
    // Events
    event TokenDeposited(
        address indexed token,
        uint256 amount
    );
    
    event TokenWithdrawn(
        address indexed token,
        uint256 amount
    );
    
    event TradeExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );
    
    event PriceThresholdSet(
        bytes32 indexed id,
        address indexed tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 thresholdPrice,
        bool isAbove
    );
    
    event PriceThresholdTriggered(
        bytes32 indexed id,
        uint256 currentPrice,
        uint256 thresholdPrice
    );
    
    address private swapRouter;
    address private quoter;
    
    constructor(address _swapRouter, address _quoter) {
        swapRouter = _swapRouter;
        quoter = _quoter;
    }
    
    modifier onlyAIAgent() {
        require(msg.sender == aiAgent, "Only authorized AI agent");
        _;
    }
    
    // Setup function for AI agent
    function setAIAgent(address agent) external onlyOwner {
        aiAgent = agent;
    }
    
    // Function for owner to deposit tokens
    function depositTokens(address token, uint256 amount) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(amount > 0, "Amount must be greater than 0");
        
        // Transfer tokens from owner to this contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        // Update token balance
        tokenBalances[token] += amount;
        // Ensure the router is approved to spend tokens
        IERC20(token).approve(swapRouter, amount);
        
        emit TokenDeposited(token, amount);
    }
    
    // Function for owner to withdraw tokens
    function withdrawTokens(address token, uint256 amount) external onlyOwner {
        require(tokenBalances[token] >= amount, "Insufficient balance");
        
        // Update token balance
        tokenBalances[token] -= amount;
        
        // Transfer tokens back to the owner
        IERC20(token).safeTransfer(msg.sender, amount);
        
        emit TokenWithdrawn(token, amount);
    }
    
    // Get token balance
    function getTokenBalance(address token) external view returns (uint256) {
        return tokenBalances[token];
    }
    
    // Set price threshold for reactive trading
    function setPriceThreshold(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 thresholdPrice,
        bool isAbove
    ) external onlyOwner returns (bytes32 thresholdId) {
        // Create a unique ID for this threshold
        thresholdId = keccak256(abi.encodePacked(
            tokenIn,
            tokenOut,
            fee,
            thresholdPrice,
            isAbove,
            block.timestamp
        ));
        
        // Store the threshold
        priceThresholds[thresholdId] = PriceThreshold({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: fee,
            thresholdPrice: thresholdPrice,
            isAbove: isAbove,
            isActive: true
        });
        
        // Mark threshold as active
        activeThresholds[thresholdId] = true;
        
        emit PriceThresholdSet(
            thresholdId,
            tokenIn,
            tokenOut,
            fee,
            thresholdPrice,
            isAbove
        );
        
        return thresholdId;
    }
    
    // Function to cancel a price threshold
    function cancelPriceThreshold(bytes32 thresholdId) external onlyOwner {
        PriceThreshold storage threshold = priceThresholds[thresholdId];
        
        require(threshold.isActive, "Threshold not active");
        
        threshold.isActive = false;
        activeThresholds[thresholdId] = false;
    }

    
    
    // Function to react to on-chain events (for Reactive Network integration)
    function react(bytes calldata logData) external override {
        // Parse log data to extract event information
        (bytes32 thresholdId, uint256 currentPrice) = abi.decode(logData, (bytes32, uint256));
        
        PriceThreshold storage threshold = priceThresholds[thresholdId];
        
        // Check if threshold is active
        if (!threshold.isActive) {
            return;
        }
        
        // Check if price threshold is met
        bool triggered = threshold.isAbove ? 
            currentPrice >= threshold.thresholdPrice : 
            currentPrice <= threshold.thresholdPrice;
            
        if (triggered) {
            emit PriceThresholdTriggered(thresholdId, currentPrice, threshold.thresholdPrice);
            
            // Deactivate the threshold to prevent repeat executions
            threshold.isActive = false;
            activeThresholds[thresholdId] = false;
        }
    }
    
    // Emergency function to recover tokens that aren't tracked by the token balance system
    function recoverTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}