// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.0;
pragma abicoder v2;

import './IReactive.sol';
import './IAlgebraPool.sol';

/**
 * @title IXCMTransactor
 * @dev Interface for the XCM Transactor precompile on Polkadot
 */
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

/**
 * @title AssetTransferInterface
 * @dev Interface for Asset XCM transfer on Asset Hub
 */
interface AssetTransferInterface {
    function transferToParachain(
        uint32 paraId,
        address assetId,
        uint256 amount,
        address recipient,
        uint64 weight
    ) external;
}

/**
 * @title IERC20
 * @dev Minimal ERC20 interface for AssetHub tokens
 */
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

/**
 * @title Ownable
 * @dev Minimal Ownable implementation
 */
contract Ownable {
    address private _owner;
    
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    constructor() {
        _owner = msg.sender;
        emit OwnershipTransferred(address(0), _owner);
    }
    
    function owner() public view returns (address) {
        return _owner;
    }
    
    modifier onlyOwner() {
        require(_owner == msg.sender, "Ownable: caller is not the owner");
        _;
    }
    
    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }
}

/**
 * @title AILiquidityProvider
 * @dev Main contract for managing liquidity on Moonbeam via XCM from Asset Hub
 * Deployed on Asset Hub and communicates with a proxy on Moonbeam
 */
contract AILiquidityProvider is Ownable, IReactive {
    // Tick range size options for positions
    enum TickRangeSize {
        NARROW,  // ±5% range
        MEDIUM,  // ±10% range
        WIDE,    // ±30% range
        MAXIMUM  // ±100% range
    }
    
    // Position information
    struct Position {
        address pool;
        address token0;
        address token1;
        int24 bottomTick;
        int24 topTick;
        uint128 liquidity;
        bool active;
    }

    // XCM precompile addresses
    address public constant XCM_TRANSACTOR = 0x0000000000000000000000000000000000000806;
    address public constant ASSET_TRANSFER = 0x0000000000000000000000000000000000000815;
    
    // Moonbeam parachain ID
    uint32 public constant MOONBEAM_PARACHAIN_ID = 1287; // Use 1000 for Moonbase Alpha testnet
    
    // XCM proxy contract address on Moonbeam
    address public xcmProxyAddress;
    
    // Fee location (typically 0 for parent, 1 for sibling)
    uint16 public constant FEE_LOCATION = 1; // Sibling parachain
    
    // XCM weight constants
    uint64 public constant TRANSACT_WEIGHT = 1000000000;
    uint64 public constant OVERALL_WEIGHT = 8000000000;
    uint64 public constant ASSET_TRANSFER_WEIGHT = 5000000000;
    
    // XCM fee amount
    uint256 public xcmFeeAmount;
    
    // Token balances storage
    mapping(address => uint256) public tokenBalances;
    
    // Position tracking
    mapping(bytes32 => Position) public positions;
    mapping(address => bytes32[]) public userPositions;
    bytes32[] public allPositionIds;
    
    // AI agent address
    address public aiAgent;
    
    // Events
    event TokenDeposited(address indexed token, uint256 amount);
    event TokenWithdrawn(address indexed token, uint256 amount);
    event XCMRequestSent(address indexed pool, address indexed recipient, uint128 liquidityDesired);
    event PositionCreated(bytes32 indexed positionId, address pool, address recipient, int24 bottomTick, int24 topTick);
    event PositionRemoved(bytes32 indexed positionId, uint256 amount0, uint256 amount1);
    event AssetsTransferred(address indexed token, uint256 amount, address recipient);
    
    constructor(address _xcmProxyAddress, uint256 _xcmFeeAmount) {
        xcmProxyAddress = _xcmProxyAddress;
        xcmFeeAmount = _xcmFeeAmount;
    }
    
    modifier onlyAIAgent() {
        require(msg.sender == aiAgent, "Only authorized AI agent");
        _;
    }
    
    /**
     * @notice Set the AI agent address
     * @param _aiAgent The address of the AI agent
     */
    function setAIAgent(address _aiAgent) external onlyOwner {
        aiAgent = _aiAgent;
    }
    
    /**
     * @notice Set the XCM proxy address on Moonbeam
     * @param _xcmProxyAddress The address of the XCM proxy on Moonbeam
     */
    function setXCMProxyAddress(address _xcmProxyAddress) external onlyOwner {
        xcmProxyAddress = _xcmProxyAddress;
    }
    
    /**
     * @notice Update the XCM fee amount
     * @param _xcmFeeAmount The new XCM fee amount
     */
    function setXCMFeeAmount(uint256 _xcmFeeAmount) external onlyOwner {
        xcmFeeAmount = _xcmFeeAmount;
    }
    
    /**
     * @notice Deposit tokens into the contract
     * @param token The token address
     * @param amount The amount to deposit
     */
    function depositTokens(address token, uint256 amount) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(amount > 0, "Amount must be greater than 0");
        
        // Transfer tokens from owner to this contract
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        
        // Update token balance
        tokenBalances[token] += amount;
        
        emit TokenDeposited(token, amount);
    }
    
    /**
     * @notice Withdraw tokens from the contract
     * @param token The token address
     * @param amount The amount to withdraw
     */
    function withdrawTokens(address token, uint256 amount) external onlyOwner {
        require(tokenBalances[token] >= amount, "Insufficient balance");
        
        // Update token balance
        tokenBalances[token] -= amount;
        
        // Transfer tokens back to the owner
        IERC20(token).transfer(msg.sender, amount);
        
        emit TokenWithdrawn(token, amount);
    }
    
    /**
     * @notice Transfer Assets from Asset Hub to Moonbeam
     * @dev Sends tokens to the XCM proxy on Moonbeam
     * @param token The token address on Asset Hub
     * @param amount The amount to transfer
     */
    function transferAssetsToMoonbeam(address token, uint256 amount) external onlyOwner {
        require(tokenBalances[token] >= amount, "Insufficient balance");
        
        // Update token balance
        tokenBalances[token] -= amount;
        
        // Transfer to Moonbeam via XCM
        AssetTransferInterface(ASSET_TRANSFER).transferToParachain(
            MOONBEAM_PARACHAIN_ID,
            token,
            amount,
            xcmProxyAddress,
            ASSET_TRANSFER_WEIGHT
        );
        
        emit AssetsTransferred(token, amount, xcmProxyAddress);
    }
    
    /**
     * @notice Add liquidity to an Algebra pool via XCM
     * @param pool The Algebra pool address on Moonbeam
     * @param recipient The address to receive the position
     * @param token0 The address of token0 on Moonbeam
     * @param token1 The address of token1 on Moonbeam
     * @param rangeSize The size of the range around current price
     * @param liquidityDesired The amount of liquidity to add
     */
    function addLiquidity(
        address pool,
        address recipient,
        address token0,
        address token1,
        TickRangeSize rangeSize,
        uint128 liquidityDesired
    ) external onlyAIAgent {
        require(pool != address(0), "Invalid pool address");
        require(liquidityDesired > 0, "Liquidity must be greater than 0");
        
        // Call the proxy's adapter function that handles all the complexity
        bytes memory proxyCall = abi.encodeWithSignature(
            "addLiquidityAdapter(address,address,address,uint8,uint128)",
            pool,
            token0,
            token1,
            uint8(rangeSize),
            liquidityDesired
        );
        
        // Send XCM message to execute the proxy call on Moonbeam
        IXCMTransactor(XCM_TRANSACTOR).transactThroughDerivative(
            MOONBEAM_PARACHAIN_ID,
            FEE_LOCATION,
            TRANSACT_WEIGHT,
            abi.encodePacked(xcmProxyAddress, proxyCall),
            xcmFeeAmount,
            OVERALL_WEIGHT
        );
        
        // Create a position ID for tracking
        bytes32 positionId = keccak256(abi.encodePacked(
            pool,
            recipient,
            token0,
            token1,
            block.timestamp
        ));
        
        // Store position information locally (tick information will be updated later)
        positions[positionId] = Position({
            pool: pool,
            token0: token0,
            token1: token1,
            bottomTick: 0,  // Will be populated by an event
            topTick: 0,     // Will be populated by an event
            liquidity: liquidityDesired,
            active: true
        });
        
        // Track user positions
        userPositions[recipient].push(positionId);
        allPositionIds.push(positionId);
        
        emit XCMRequestSent(pool, recipient, liquidityDesired);
        emit PositionCreated(positionId, pool, recipient, 0, 0);
    }
    
    /**
     * @notice Remove liquidity from a position via XCM
     * @param positionId The position ID
     * @param liquidity The amount of liquidity to remove (0 for all)
     */
    function removeLiquidity(bytes32 positionId, uint128 liquidity) external onlyOwner {
        Position storage position = positions[positionId];
        require(position.active, "Position does not exist or is inactive");
        
        // If liquidity is 0, remove all liquidity
        uint128 liquidityToRemove = liquidity == 0 ? position.liquidity : liquidity;
        require(liquidityToRemove <= position.liquidity, "Not enough liquidity");
        
        // Prepare the burn call for the proxy to execute on the pool
        bytes memory proxyCall = abi.encodeWithSignature(
            "executeBurn(address,int24,int24,uint128)",
            position.pool,
            position.bottomTick,
            position.topTick,
            liquidityToRemove
        );
        
        // Send XCM message to execute the call on Moonbeam
        IXCMTransactor(XCM_TRANSACTOR).transactThroughDerivative(
            MOONBEAM_PARACHAIN_ID,
            FEE_LOCATION,
            TRANSACT_WEIGHT,
            abi.encodePacked(xcmProxyAddress, proxyCall),
            xcmFeeAmount,
            OVERALL_WEIGHT
        );
        
        // Update position locally
        position.liquidity -= liquidityToRemove;
        if (position.liquidity == 0) {
            position.active = false;
        }
        
        emit PositionRemoved(positionId, 0, 0); // Actual amounts will be updated via event
    }
    
    /**
     * @notice React to on-chain events (for updating position information)
     * @param logData Encoded event data from reactive network
     */
    function react(bytes calldata logData) external override {
        // This would be used to receive updates from Moonbeam about position changes
        // Implementation depends on the event monitoring system
        
        // Example format: (bytes32 positionId, int24 bottomTick, int24 topTick, uint256 amount0, uint256 amount1)
        (bytes32 positionId, int24 bottomTick, int24 topTick, uint256 amount0, uint256 amount1) = 
            abi.decode(logData, (bytes32, int24, int24, uint256, uint256));
        
        // Update position with the actual tick information
        Position storage position = positions[positionId];
        if (position.active) {
            position.bottomTick = bottomTick;
            position.topTick = topTick;
        }
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
}