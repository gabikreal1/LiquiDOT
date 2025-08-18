// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.0;

// DEPRECATED - DO NOT USE.
// AssethubVault.sol is the new contract for this functionality.


// Core interfaces included directly
interface IXCMTransactor {
    function transactThroughDerivative(
        uint32 destination,
        uint16 feeLocation,
        uint64 transactRequiredWeightAtMost,
        bytes memory call,
        uint256 feeAmount,
        uint64 overallWeight
    ) external;
}

contract AILiquidityProvider {
    // Owner management
    address private _owner;
    
    modifier onlyOwner() {
        require(msg.sender == _owner, "!owner");
        _;
    }
    
    // Core constants
    address public constant XCM_TRANSACTOR = 0x0000000000000000000000000000000000000806;
    uint32 public constant MOONBEAM_PARACHAIN_ID = 1287;
    uint16 public constant FEE_LOCATION = 1;
    uint64 public constant TRANSACT_WEIGHT = 1000000000;
    uint64 public constant OVERALL_WEIGHT = 8000000000;
    
    // State variables
    address public xcmProxyAddress;
    uint256 public xcmFeeAmount;
    address public aiAgent;
    
    // Added back four tick range options
    enum TickRangeSize { NARROW, MEDIUM, WIDE, MAXIMUM }
    
    // Events for important operations
    event LiquidityOp(address indexed pool, uint128 amount, bool isAdd);
    event SwapOp(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);
    
    constructor(address _xcmProxyAddress, uint256 _xcmFeeAmount) {
        _owner = msg.sender;
        xcmProxyAddress = _xcmProxyAddress;
        xcmFeeAmount = _xcmFeeAmount;
    }
    
    // AI agent authorization
    modifier onlyAIAgent() {
        require(msg.sender == aiAgent, "!agent");
        _;
    }
    
    // Admin functions
    function setAIAgent(address _aiAgent) external onlyOwner {
        aiAgent = _aiAgent;
    }
    
    // Add liquidity to Moonbeam pools
    function addLiquidity(
        address pool,
        address token0,
        address token1,
        TickRangeSize rangeSize,
        uint128 liquidityDesired
    ) external onlyAIAgent {
        require(pool != address(0) && liquidityDesired > 0, "Invalid input");
        
        // Create params struct matching XCMProxy's LiquidityParams struct
        bytes memory proxyCall = abi.encodeWithSignature(
            "addLiquidityAdapter((address,address,address,uint8,uint128,address))",
            abi.encode(pool, token0, token1, uint8(rangeSize), liquidityDesired, msg.sender)
        );
        
        IXCMTransactor(XCM_TRANSACTOR).transactThroughDerivative(
            MOONBEAM_PARACHAIN_ID,
            FEE_LOCATION,
            TRANSACT_WEIGHT,
            abi.encodePacked(xcmProxyAddress, proxyCall),
            xcmFeeAmount,
            OVERALL_WEIGHT
        );
        
        emit LiquidityOp(pool, liquidityDesired, true);
    }
    
    // Remove liquidity from Moonbeam pools
    function removeLiquidity(
        address pool,
        int24 bottomTick,
        int24 topTick,
        uint128 liquidity
    ) external onlyOwner {
        require(pool != address(0) && liquidity > 0, "Invalid input");
        
        bytes memory proxyCall = abi.encodeWithSignature(
            "executeBurn(address,int24,int24,uint128)",
            pool,
            bottomTick,
            topTick,
            liquidity
        );
        
        IXCMTransactor(XCM_TRANSACTOR).transactThroughDerivative(
            MOONBEAM_PARACHAIN_ID,
            FEE_LOCATION,
            TRANSACT_WEIGHT,
            abi.encodePacked(xcmProxyAddress, proxyCall),
            xcmFeeAmount,
            OVERALL_WEIGHT
        );
        
        emit LiquidityOp(pool, liquidity, false);
    }
    
    // Swap exact input tokens for output tokens via XCMProxy
    function swapExactInputSingle(
        address tokenIn,
        address tokenOut,
        address recipient,
        uint256 amountIn,
        uint256 amountOutMinimum,
        uint160 limitSqrtPrice
    ) external onlyAIAgent {
        require(tokenIn != address(0) && tokenOut != address(0) && amountIn > 0, "Invalid input");
        
        bytes memory proxyCall = abi.encodeWithSignature(
            "swapExactInputSingle(address,address,address,uint256,uint256,uint160)",
            tokenIn,
            tokenOut,
            recipient,
            amountIn,
            amountOutMinimum,
            limitSqrtPrice
        );
        
        IXCMTransactor(XCM_TRANSACTOR).transactThroughDerivative(
            MOONBEAM_PARACHAIN_ID,
            FEE_LOCATION,
            TRANSACT_WEIGHT,
            abi.encodePacked(xcmProxyAddress, proxyCall),
            xcmFeeAmount,
            OVERALL_WEIGHT
        );
        
        emit SwapOp(tokenIn, tokenOut, amountIn, 0); // Note: actual amountOut not available via XCM
    }
    
    // Swap tokens for exact output tokens via XCMProxy
    function swapExactOutputSingle(
        address tokenIn,
        address tokenOut,
        address recipient,
        uint256 amountOut,
        uint256 amountInMaximum,
        uint160 limitSqrtPrice
    ) external onlyAIAgent {
        require(tokenIn != address(0) && tokenOut != address(0) && amountOut > 0, "Invalid input");
        
        bytes memory proxyCall = abi.encodeWithSignature(
            "swapExactOutputSingle(address,address,address,uint256,uint256,uint160)",
            tokenIn,
            tokenOut,
            recipient,
            amountOut,
            amountInMaximum,
            limitSqrtPrice
        );
        
        IXCMTransactor(XCM_TRANSACTOR).transactThroughDerivative(
            MOONBEAM_PARACHAIN_ID,
            FEE_LOCATION,
            TRANSACT_WEIGHT,
            abi.encodePacked(xcmProxyAddress, proxyCall),
            xcmFeeAmount,
            OVERALL_WEIGHT
        );
        
        emit SwapOp(tokenIn, tokenOut, 0, amountOut); // Note: actual amountIn not available via XCM
    }
    
    // Multi-hop swap exact input tokens for output tokens via XCMProxy
    function swapExactInput(
        bytes calldata path,
        address recipient,
        uint256 amountIn,
        uint256 amountOutMinimum
    ) external onlyAIAgent {
        require(path.length >= 40 && amountIn > 0, "Invalid input"); // Minimum path length for 2 tokens
        
        bytes memory proxyCall = abi.encodeWithSignature(
            "swapExactInput(bytes,address,uint256,uint256)",
            path,
            recipient,
            amountIn,
            amountOutMinimum
        );
        
        IXCMTransactor(XCM_TRANSACTOR).transactThroughDerivative(
            MOONBEAM_PARACHAIN_ID,
            FEE_LOCATION,
            TRANSACT_WEIGHT,
            abi.encodePacked(xcmProxyAddress, proxyCall),
            xcmFeeAmount,
            OVERALL_WEIGHT
        );
        
        // Extract tokenIn and tokenOut from path for the event
        address tokenIn;
        address tokenOut;
        assembly {
            tokenIn := shr(96, calldataload(add(path.offset, 0)))
            tokenOut := shr(96, calldataload(add(path.offset, sub(path.length, 20))))
        }
        
        emit SwapOp(tokenIn, tokenOut, amountIn, 0);
    }
    
    // Multi-hop swap tokens for exact output tokens via XCMProxy
    function swapExactOutput(
        bytes calldata path,
        address recipient,
        uint256 amountOut,
        uint256 amountInMaximum
    ) external onlyAIAgent {
        require(path.length >= 40 && amountOut > 0, "Invalid input"); // Minimum path length for 2 tokens
        
        bytes memory proxyCall = abi.encodeWithSignature(
            "swapExactOutput(bytes,address,uint256,uint256)",
            path,
            recipient,
            amountOut,
            amountInMaximum
        );
        
        IXCMTransactor(XCM_TRANSACTOR).transactThroughDerivative(
            MOONBEAM_PARACHAIN_ID,
            FEE_LOCATION,
            TRANSACT_WEIGHT,
            abi.encodePacked(xcmProxyAddress, proxyCall),
            xcmFeeAmount,
            OVERALL_WEIGHT
        );
        
        // Extract tokenIn and tokenOut from path for the event
        // For exactOutput, the first token in path is tokenOut and last is tokenIn
        address tokenIn;
        address tokenOut;
        assembly {
            tokenOut := shr(96, calldataload(add(path.offset, 0)))
            tokenIn := shr(96, calldataload(add(path.offset, sub(path.length, 20))))
        }
        
        emit SwapOp(tokenIn, tokenOut, 0, amountOut);
    }
    
    // Execute general-purpose XCM call
    function executeViaXCM(bytes memory callData) external onlyOwner {
        IXCMTransactor(XCM_TRANSACTOR).transactThroughDerivative(
            MOONBEAM_PARACHAIN_ID, FEE_LOCATION, TRANSACT_WEIGHT,
            abi.encodePacked(xcmProxyAddress, callData),
            xcmFeeAmount, OVERALL_WEIGHT
        );
    }
}