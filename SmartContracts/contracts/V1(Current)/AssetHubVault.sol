// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
 

// XCM precompile interface - the ONLY precompile available on Asset Hub
interface IXcm {
    function send(bytes calldata destination, bytes calldata message) external;
}

/**
* @title AssetHubVault
* @dev Primary custody layer for cross-chain liquidity management on Asset Hub
* @notice Uses ONLY the IXcm precompile interface available on Asset Hub
* @notice Does NOT use XTokens or XcmTransactor precompiles (not available on Asset Hub)
*/
contract AssetHubVault is ReentrancyGuard {
    

    // Minimal role system (single accounts)
    address public admin;
    address public operator;
    address public emergency;

    // Custom errors (smaller bytecode than revert strings)
    error NotAdmin();
    error NotOperator();
    error NotEmergency();
    error Paused();
    error ZeroAddress();
    error AmountZero();
    error InsufficientBalance();
    error InvalidRange();
    
    error XcmPrecompileNotSet();
    error UnauthorizedXcmCall();
    error PositionNotActive();
    error ChainIdMismatch();
    error AmountMismatch();
    error AssetMismatch();

    modifier onlyAdmin() { if (msg.sender != admin) revert NotAdmin(); _; }
    modifier onlyOperator() { if (msg.sender != operator) revert NotOperator(); _; }
    modifier onlyEmergency() { if (msg.sender != emergency) revert NotEmergency(); _; }

    // Minimal pause
    bool public paused;
    modifier whenNotPaused() { if (paused) revert Paused(); _; }

    // State variables
    mapping(address => uint256) public userBalances; // user => native balance
    mapping(bytes32 => Position) public positions; // positionId => Position
	mapping(address => bytes32[]) public userPositions; // user => positionIds

    // Events
    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);
    event InvestmentInitiated(
        bytes32 indexed positionId,
        address indexed user,
        uint32 chainId,
        address poolId,
        uint256 amount
    );
    event PositionLiquidated(
        bytes32 indexed positionId,
        address indexed user,
        uint256 finalAmount
    );
    event XCMMessageSent(
        bytes32 indexed messageHash,
        bytes destination,
        bytes message
    );
    event XcmSendAttempt(bytes32 indexed messageHash, bytes destination, bool success, bytes errorData);
    event LiquidationSettled(
        bytes32 indexed positionId,
        address indexed user,
        uint256 receivedAmount,
        uint256 expectedAmount
    );

    // Structs (packed for smaller storage)
    struct Position {
        address user;
        address poolId;
        address baseAsset;
        uint32 chainId;
        int24 lowerRangePercent;
        int24 upperRangePercent;
        uint64 timestamp;
        bool active;
        uint256 amount;
    }
    // Polkadot XCM precompile (PolkaVM) configurable address; depends on runtime
    address public XCM_PRECOMPILE;
    bool public xcmPrecompileFrozen;
    
    // Test mode - allows direct contract calls without XCM for local testing
    bool public testMode;
    

    constructor() {
        admin = msg.sender;
        operator = msg.sender;
        emergency = msg.sender;
        XCM_PRECOMPILE = address(0);
        xcmPrecompileFrozen = false;
        paused = false;
    }

    event XcmPrecompileSet(address indexed precompile);

    function setXcmPrecompile(address precompile) external onlyAdmin {
        require(!xcmPrecompileFrozen, "xcm precompile frozen");
        XCM_PRECOMPILE = precompile;
        emit XcmPrecompileSet(precompile);
    }

    function pause() external onlyAdmin { paused = true; }

    function unpause() external onlyAdmin { paused = false; }

    

    function freezeXcmPrecompile() external onlyAdmin {
        require(!xcmPrecompileFrozen, "already frozen");
        xcmPrecompileFrozen = true;
    }

    function setTestMode(bool _testMode) external onlyAdmin {
        testMode = _testMode;
    }

    // Role management
    function transferAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert ZeroAddress();
        admin = newAdmin;
    }

    function setOperator(address account) external onlyAdmin {
        if (account == address(0)) revert ZeroAddress();
        operator = account;
    }

    function setEmergency(address account) external onlyAdmin {
        if (account == address(0)) revert ZeroAddress();
        emergency = account;
    }

    /**
    * @dev Deposit native assets into the vault
    */
    function deposit() external payable nonReentrant {
        if (msg.value == 0) revert AmountZero();

        userBalances[msg.sender] += msg.value;

        emit Deposit(msg.sender, msg.value);
    }

    /**
    * @dev Withdraw native assets from the vault
    */
    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert AmountZero();
        if (userBalances[msg.sender] < amount) revert InsufficientBalance();

        userBalances[msg.sender] -= amount;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "TRANSFER_FAILED");

        emit Withdrawal(msg.sender, amount);
    }

    /**
    * @dev Dispatch cross-chain investment using off-chain prepared XCM message
    * All XCM creation and configuration is handled off-chain by the operator
    */
    function dispatchInvestment(
        address user,
        uint32 chainId,
        address poolId,
        address baseAsset,
        uint256 amount,
        int24 lowerRangePercent,
        int24 upperRangePercent,
        bytes calldata destination,
        bytes calldata preBuiltXcmMessage
    ) external onlyOperator whenNotPaused {
        if (user == address(0)) revert ZeroAddress();
        if (amount == 0) revert AmountZero();
        if (!(lowerRangePercent < upperRangePercent)) revert InvalidRange();
        if (XCM_PRECOMPILE == address(0)) revert XcmPrecompileNotSet();

        if (userBalances[user] < amount) revert InsufficientBalance();

        bytes32 positionId = keccak256(
            abi.encodePacked(
                user,
                chainId,
                poolId,
                baseAsset,
                block.timestamp
            )
        );

        positions[positionId] = Position({
            user: user,
            poolId: poolId,
            baseAsset: baseAsset,
            chainId: chainId,
            lowerRangePercent: lowerRangePercent,
            upperRangePercent: upperRangePercent,
            timestamp: uint64(block.timestamp),
            active: true,
            amount: amount
        });

		userPositions[user].push(positionId);


        userBalances[user] -= amount;

        emit InvestmentInitiated(positionId, user, chainId, poolId, amount);

        // Dispatch the provided XCM message to the provided destination
        // In test mode, skip actual XCM send to allow local testing
        if (!testMode) {
            bytes32 messageHash = keccak256(preBuiltXcmMessage);
            bool success = false;
            bytes memory err;
            try IXcm(XCM_PRECOMPILE).send(destination, preBuiltXcmMessage) {
                success = true;
            } catch (bytes memory reason) {
                err = reason;
            }
            emit XCMMessageSent(messageHash, destination, preBuiltXcmMessage);
            emit XcmSendAttempt(messageHash, destination, success, err);
        }
    }


    

    /**
    * @dev Settle liquidation after assets have been returned from Moonbeam
    * @notice Called by operator after XTokens transfer deposits assets to this contract
    * @notice Assets arrive at Substrate level without triggering execution - manual settlement required
    * @param positionId The position being settled
    * @param receivedAmount Amount of assets received (should match contract balance increase)
    */
    function settleLiquidation(
        bytes32 positionId,
        uint256 receivedAmount
    ) external onlyOperator nonReentrant {
        if (receivedAmount == 0) revert AmountZero();
        
        Position storage position = positions[positionId];
        if (!position.active) revert PositionNotActive();
        
        // Verify contract has sufficient balance to settle
        // Note: In production, you may want to track expected amounts more precisely
        require(address(this).balance >= receivedAmount, "Insufficient contract balance");
        
        // Update position and user balance
        position.active = false;
        userBalances[position.user] += receivedAmount;
        
        emit PositionLiquidated(positionId, position.user, receivedAmount);
        emit LiquidationSettled(positionId, position.user, receivedAmount, position.amount);
    }

    
    /**
    * @dev Emergency liquidation override
    */
    function emergencyLiquidatePosition(
        uint32 chainId,
        bytes32 positionId
    ) external onlyEmergency {
        Position storage position = positions[positionId];
        if (!position.active) revert PositionNotActive();
        if (position.chainId != chainId) revert ChainIdMismatch();

		position.active = false;

        emit PositionLiquidated(positionId, position.user, 0);
    }

    /**
    * @dev Get user balance for native assets
    */
    function getUserBalance(address user) external view returns (uint256) {
        return userBalances[user];
    }

	/**
	* @dev Check if a specific position is active for a user
	*/
	function isPositionActive(address user, bytes32 positionId) external view returns (bool) {
		Position storage position = positions[positionId];
		return position.user == user && position.active;
	}

    function getUserPositions(address user) external view returns (Position[] memory) {
        bytes32[] storage ids = userPositions[user];
        Position[] memory list = new Position[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            list[i] = positions[ids[i]];
        }
        return list;
    }

    /**
    * @dev Get position details
    */
    function getPosition(bytes32 positionId) external view returns (Position memory) {
        return positions[positionId];
    }

} 