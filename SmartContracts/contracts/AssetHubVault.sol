// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// XCM precompile (Polkadot Hub / Revive) minimal interface
interface IXcm {
    struct Weight { uint64 refTime; uint64 proofSize; }
    function execute(bytes calldata message, Weight calldata weight) external;
    function send(bytes calldata destination, bytes calldata message) external;
    function weighMessage(bytes calldata message) external view returns (Weight memory weight);
}

+

/**
 * @title AssetHubVault
 * @dev Primary custody layer for LiquiDOT cross-chain liquidity management
 */
contract AssetHubVault is ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;

    // Role definitions
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

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

    // Precompile addresses and weights (adjust per network at deployment time)
    address private constant XTOKENS_PRECOMPILE = 0x0000000000000000000000000000000000000804;
    address private constant XCM_TRANSACTOR_PRECOMPILE = 0x0000000000000000000000000000000000000806;
    // Polkadot XCM precompile (Revive/PolkaVM) fixed address
    address private constant XCM_PRECOMPILE = address(0xA0000);
    uint64 private constant DEFAULT_DEST_WEIGHT = 6_000_000_000; // conservative default
    // Destination MultiLocation encoded as bytes (SCALE). Configure off-chain and set via deployment script if needed.
    bytes private destinationLocation; // default empty

    // Optional: strict dispatch to a pre-approved destination and message template for IXcm.send
    bytes private fixedXcmDestination; // SCALE-encoded MultiLocation for destination (e.g., PassetHub or EVM parachain)
    mapping(bytes32 => bool) private allowedXcmMessageHashes; // keccak256(message) allowlist

    // Optional: allowlist of destination ALM EVM addresses (as AccountKey20 on the destination chain)
    mapping(address => bool) public isAllowedALMBeneficiary;

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
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

        // Encode investment params for destination EVM executor
        address poolIdAsAddress = address(uint160(uint256(poolId)));
        bytes memory investmentParams = abi.encode(
            poolIdAsAddress,
            amounts,
            lowerRangePercent,
            upperRangePercent,
            msg.sender
        );

        // Calculate total to transfer (sum of amounts)
        uint256 total;
        for (uint256 i = 0; i < amounts.length; i++) {
            total += amounts[i];
        }

        // Send assets cross-chain via XTokens (Moonbeam-style). If using IXcm instead, see sendPreencodedXcm below.
        if (total > 0) {
            IERC20(baseAsset).safeIncreaseAllowance(XTOKENS_PRECOMPILE, total);
            IXTokens(XTOKENS_PRECOMPILE).transfer(
                baseAsset,
                total,
                destinationLocation,
                DEFAULT_DEST_WEIGHT
            );
        }

        // Dispatch instruction via XCM Transactor to destination XCMProxy.receiveAssets
        bytes memory callData = abi.encodeWithSelector(
            IXCMProxyReceiver.receiveAssets.selector,
            baseAsset,
            msg.sender,
            total,
            investmentParams
        );
        IXcmTransactor(XCM_TRANSACTOR_PRECOMPILE).transact(destinationLocation, callData, DEFAULT_DEST_WEIGHT);
    }

    /**
     * @dev Admin: set the fixed IXcm destination (SCALE-encoded MultiLocation)
     */
    function setFixedXcmDestination(bytes calldata dest) external onlyRole(DEFAULT_ADMIN_ROLE) {
        fixedXcmDestination = dest;
    }

    /**
     * @dev Admin: manage allowed IXcm message hashes (keccak256 of full SCALE-encoded VersionedXcm bytes)
     */
    function setAllowedXcmMessageHash(bytes32 messageHash, bool allowed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        allowedXcmMessageHashes(messageHash);
        allowedXcmMessageHashes[messageHash] = allowed;
    }

    /**
     * @dev Admin: manage allowed destination ALM beneficiaries (on destination EVM, AccountKey20)
     */
    function setAllowedALMBeneficiary(address alm, bool allowed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        isAllowedALMBeneficiary[alm] = allowed;
    }

    /**
     * @dev Dispatch a pre-encoded XCM message via the XCM precompile to the fixed destination.
     * Security model: off-chain tooling constructs the XCM bytes targeting a whitelisted ALM and
     * the admin registers its hash here. The operator can only send messages whose hashes are pre-approved.
     */
    function sendPreencodedXcm(bytes calldata message) external onlyRole(OPERATOR_ROLE) {
        require(fixedXcmDestination.length != 0, "XCM dest not set");
        bytes32 h = keccak256(message);
        require(allowedXcmMessageHashes[h], "XCM message not allowed");
        IXcm(XCM_PRECOMPILE).send(fixedXcmDestination, message);
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

} 