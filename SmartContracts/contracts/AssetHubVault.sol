// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.so  l";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AssetHubVault
 * @dev Primary custody layer for LiquiDOT cross-chain liquidity management
 */
contract AssetHubVault is 
    Initializable, 
    ReentrancyGuardUpgradeable, 
    AccessControlUpgradeable, 
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    // Role definitions
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // State variables
    mapping(address => mapping(address => uint256)) public userBalances; // user => token => balance
    mapping(bytes32 => Position) public positions; // positionId => Position
    mapping(address => bytes32[]) public userPositions; // user => positionIds

    // Events
    event Deposit(address indexed user, address indexed token, uint256 amount);
    event Withdrawal(address indexed user, address indexed token, uint256 amount);
    event InvestmentInitiated(
        bytes32 indexed positionId,
        address indexed user,
        uint32 chainId,
        bytes32 poolId,
        uint256[] amounts
    );
    event PositionLiquidated(
        bytes32 indexed positionId,
        address indexed user,
        uint256[] finalAmounts
    );

    // Structs
    struct Position {
        address user;
        uint32 chainId;
        bytes32 poolId;
        address baseAsset;
        uint256[] amounts;
        int24 lowerRangePercent;
        int24 upperRangePercent;
        uint256 timestamp;
        bool active;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __ReentrancyGuard_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
    }

    /**
     * @dev Deposit tokens into the vault
     */
    function deposit(address token, uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(token != address(0), "Invalid token address");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        userBalances[msg.sender][token] += amount;

        emit Deposit(msg.sender, token, amount);
    }

    /**
     * @dev Withdraw tokens from the vault
     */
    function withdraw(address token, uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(userBalances[msg.sender][token] >= amount, "Insufficient balance");

        userBalances[msg.sender][token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);

        emit Withdrawal(msg.sender, token, amount);
    }

    /**
     * @dev Initiate cross-chain investment
     */
    function investInPool(
        uint32 chainId,
        bytes32 poolId,
        address baseAsset,
        uint256[] memory amounts,
        int24 lowerRangePercent,
        int24 upperRangePercent
    ) external onlyRole(OPERATOR_ROLE) {
        require(amounts.length > 0, "Amounts array cannot be empty");
        require(lowerRangePercent < upperRangePercent, "Invalid range");

        bytes32 positionId = keccak256(
            abi.encodePacked(
                msg.sender,
                chainId,
                poolId,
                baseAsset,
                block.timestamp
            )
        );

        positions[positionId] = Position({
            user: msg.sender,
            chainId: chainId,
            poolId: poolId,
            baseAsset: baseAsset,
            amounts: amounts,
            lowerRangePercent: lowerRangePercent,
            upperRangePercent: upperRangePercent,
            timestamp: block.timestamp,
            active: true
        });

        userPositions[msg.sender].push(positionId);

        emit InvestmentInitiated(positionId, msg.sender, chainId, poolId, amounts);
    }

    /**
     * @dev Receive liquidation proceeds from XCM
     */
    function receiveProceeds(
        uint32 chainId,
        bytes32 positionId,
        uint256[] memory finalAmounts
    ) external onlyRole(OPERATOR_ROLE) {
        Position storage position = positions[positionId];
        require(position.active, "Position not active");
        require(position.chainId == chainId, "Chain ID mismatch");

        position.active = false;

        // Update user balances with proceeds
        for (uint256 i = 0; i < finalAmounts.length; i++) {
            if (finalAmounts[i] > 0) {
                userBalances[position.user][position.baseAsset] += finalAmounts[i];
            }
        }

        emit PositionLiquidated(positionId, position.user, finalAmounts);
    }

    /**
     * @dev Emergency liquidation override
     */
    function emergencyLiquidatePosition(
        uint32 chainId,
        bytes32 positionId
    ) external onlyRole(EMERGENCY_ROLE) {
        Position storage position = positions[positionId];
        require(position.active, "Position not active");
        require(position.chainId == chainId, "Chain ID mismatch");

        position.active = false;

        emit PositionLiquidated(positionId, position.user, new uint256[](0));
    }

    /**
     * @dev Get user balance for a specific token
     */
    function getUserBalance(address user, address token) external view returns (uint256) {
        return userBalances[user][token];
    }

    /**
     * @dev Get user's active positions
     */
    function getUserActivePositions(address user) external view returns (bytes32[] memory) {
        bytes32[] memory allPositions = userPositions[user];
        bytes32[] memory activePositions = new bytes32[](allPositions.length);
        uint256 activeCount = 0;

        for (uint256 i = 0; i < allPositions.length; i++) {
            if (positions[allPositions[i]].active) {
                activePositions[activeCount] = allPositions[i];
                activeCount++;
            }
        }

        // Resize array to actual active count
        bytes32[] memory result = new bytes32[](activeCount);
        for (uint256 i = 0; i < activeCount; i++) {
            result[i] = activePositions[i];
        }

        return result;
    }

    /**
     * @dev Get position details
     */
    function getPosition(bytes32 positionId) external view returns (Position memory) {
        return positions[positionId];
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
} 