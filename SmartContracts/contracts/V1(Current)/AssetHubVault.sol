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
    error ChainNotSupported();
    error ExecutorNotAuthorized();

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
    
    // Chain registry for multi-chain support
    mapping(uint32 => ChainConfig) public supportedChains; // chainId => config
    mapping(uint32 => address) public chainExecutors; // chainId => authorized executor contract address

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
    event PositionExecutionConfirmed(
        bytes32 indexed positionId,
        uint32 indexed chainId,
        bytes32 remotePositionId,
        uint128 liquidity
    );
    event ChainAdded(uint32 indexed chainId, bytes xcmDestination, address executor);
    event ChainRemoved(uint32 indexed chainId);
    event ExecutorUpdated(uint32 indexed chainId, address executor);

    // Position status enum
    enum PositionStatus {
        PendingExecution,  // Waiting for remote chain to execute
        Active,            // Position is active on remote chain
        Liquidated         // Position has been closed
    }

    // Chain configuration for multi-chain support
    struct ChainConfig {
        bool supported;
        bytes xcmDestination;  // XCM MultiLocation for this chain
        string chainName;      // Human-readable name (e.g., "Moonbeam", "Hydration")
        uint64 timestamp;      // When chain was added
    }

    // Structs (packed for smaller storage)
    struct Position {
        address user;
        address poolId;
        address baseAsset;
        uint32 chainId;                // Which chain is executing this position
        int24 lowerRangePercent;
        int24 upperRangePercent;
        uint64 timestamp;
        PositionStatus status;
        uint256 amount;
        bytes32 remotePositionId;      // Generic remote position identifier (could be uint256, tokenId, etc.)
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
        testMode = false;
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
    * @dev Add a new execution chain (e.g., Moonbeam, Hydration, Acala)
    * @param chainId Parachain ID or unique chain identifier
    * @param xcmDestination XCM MultiLocation bytes for this chain
    * @param chainName Human-readable chain name
    * @param executor Address of the executor contract on this chain (for authorization)
    */
    function addChain(
        uint32 chainId,
        bytes calldata xcmDestination,
        string calldata chainName,
        address executor
    ) external onlyAdmin {
        require(!supportedChains[chainId].supported, "Chain already supported");
        require(xcmDestination.length > 0, "Invalid XCM destination");
        
        supportedChains[chainId] = ChainConfig({
            supported: true,
            xcmDestination: xcmDestination,
            chainName: chainName,
            timestamp: uint64(block.timestamp)
        });
        
        if (executor != address(0)) {
            chainExecutors[chainId] = executor;
        }
        
        emit ChainAdded(chainId, xcmDestination, executor);
    }

    /**
    * @dev Remove support for a chain
    */
    function removeChain(uint32 chainId) external onlyAdmin {
        require(supportedChains[chainId].supported, "Chain not supported");
        delete supportedChains[chainId];
        delete chainExecutors[chainId];
        emit ChainRemoved(chainId);
    }

    /**
    * @dev Update executor address for a chain
    */
    function updateChainExecutor(uint32 chainId, address executor) external onlyAdmin {
        require(supportedChains[chainId].supported, "Chain not supported");
        chainExecutors[chainId] = executor;
        emit ExecutorUpdated(chainId, executor);
    }

    /**
    * @dev Check if a chain is supported
    */
    function isChainSupported(uint32 chainId) external view returns (bool) {
        return supportedChains[chainId].supported;
    }

    /**
    * @dev Get chain configuration
    */
    function getChainConfig(uint32 chainId) external view returns (ChainConfig memory) {
        return supportedChains[chainId];
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
    * @dev Dispatch cross-chain investment to any supported execution chain
    * @notice Chain-agnostic: works with Moonbeam, Hydration, Acala, or any future chain
    * @param chainId The target execution chain (must be registered via addChain)
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
        if (!supportedChains[chainId].supported) revert ChainNotSupported();

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
            status: PositionStatus.PendingExecution,
            amount: amount,
            remotePositionId: bytes32(0)  // Will be set when execution confirms
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
    * @dev Confirm position execution from any execution chain
    * @notice Chain-agnostic: works for Moonbeam, Hydration, Acala, etc.
    * @notice Called by operator after remote chain successfully executes pending investment
    * @param positionId The Asset Hub position ID
    * @param remotePositionId Remote chain's position identifier (tokenId, positionId, etc.)
    * @param liquidity The liquidity amount created
    */
    function confirmExecution(
        bytes32 positionId,
        bytes32 remotePositionId,
        uint128 liquidity
    ) external nonReentrant {
        Position storage position = positions[positionId];
        require(position.status == PositionStatus.PendingExecution, "Position not pending");

        // Access control: allow operator OR authorized executor for the target chain
        if (msg.sender != operator) {
            address authorizedExecutor = chainExecutors[position.chainId];
            if (authorizedExecutor == address(0) || msg.sender != authorizedExecutor) {
                revert ExecutorNotAuthorized();
            }
        }

        position.status = PositionStatus.Active;
        position.remotePositionId = remotePositionId;

        emit PositionExecutionConfirmed(positionId, position.chainId, remotePositionId, liquidity);
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
        require(position.status == PositionStatus.Active, "Position not active");

        // Verify contract has sufficient balance to settle
        // Note: In production, you may want to track expected amounts more precisely
        require(address(this).balance >= receivedAmount, "Insufficient contract balance");

        // Update position and user balance
        position.status = PositionStatus.Liquidated;
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
    ) external payable onlyEmergency {
        Position storage position = positions[positionId];
        require(position.status != PositionStatus.Liquidated, "Position already liquidated");
        if (position.chainId != chainId) revert ChainIdMismatch();

		position.status = PositionStatus.Liquidated;

        // In emergency cases, may receive funds as part of liquidation
        if (msg.value > 0) {
            userBalances[position.user] += msg.value;
        }

        emit PositionLiquidated(positionId, position.user, msg.value);
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
		return position.user == user && position.status == PositionStatus.Active;
	}

    // ==================== PAGINATION FUNCTIONS ====================

    /**
     * @dev Get total count of user positions
     * @param user The user address
     * @return count Total number of positions for the user
     * @notice Gas-efficient way to check position count before pagination
     */
    function getUserPositionCount(address user) external view returns (uint256 count) {
        return userPositions[user].length;
    }

    /**
     * @dev Get paginated user position IDs
     * @param user The user address
     * @param start Starting index (0-based)
     * @param count Number of positions to return
     * @return positionIds Array of position IDs for the requested range
     * @notice Returns empty array if start >= total count
     * @notice Returns fewer items if count exceeds available positions
     */
    function getUserPositionIds(
        address user,
        uint256 start,
        uint256 count
    ) external view returns (bytes32[] memory positionIds) {
        bytes32[] storage allIds = userPositions[user];
        
        // Handle edge cases
        if (start >= allIds.length) {
            return new bytes32[](0);
        }
        
        // Calculate actual return size
        uint256 remaining = allIds.length - start;
        uint256 returnSize = count > remaining ? remaining : count;
        
        // Build result array
        positionIds = new bytes32[](returnSize);
        for (uint256 i = 0; i < returnSize; i++) {
            positionIds[i] = allIds[start + i];
        }
        
        return positionIds;
    }

    /**
     * @dev Get paginated user positions with full data
     * @param user The user address
     * @param start Starting index (0-based)
     * @param count Number of positions to return
     * @return list Array of Position structs for the requested range
     * @notice RECOMMENDED: Use page size of 10-20 for safety
     * @notice Returns empty array if start >= total count
     */
    function getUserPositionsPage(
        address user,
        uint256 start,
        uint256 count
    ) external view returns (Position[] memory list) {
        bytes32[] storage allIds = userPositions[user];
        
        // Handle edge cases
        if (start >= allIds.length) {
            return new Position[](0);
        }
        
        // Calculate actual return size
        uint256 remaining = allIds.length - start;
        uint256 returnSize = count > remaining ? remaining : count;
        
        // Build result array
        list = new Position[](returnSize);
        for (uint256 i = 0; i < returnSize; i++) {
            list[i] = positions[allIds[start + i]];
        }
        
        return list;
    }

    /**
     * @dev Get positions filtered by status
     * @param user The user address
     * @param status Position status to filter by (0=Pending, 1=Active, 2=Liquidated)
     * @param maxResults Maximum number of results to return (0 = return all)
     * @return list Array of Position structs matching the status
     * @notice More efficient than getUserPositions when you only need specific status
     * @notice RECOMMENDED: Set maxResults to 20-50 to avoid gas issues
     */
    function getUserPositionsByStatus(
        address user,
        PositionStatus status,
        uint256 maxResults
    ) external view returns (Position[] memory list) {
        bytes32[] storage allIds = userPositions[user];
        
        // First pass: count matching positions
        uint256 matchCount = 0;
        for (uint256 i = 0; i < allIds.length && (maxResults == 0 || matchCount < maxResults); i++) {
            if (positions[allIds[i]].status == status) {
                matchCount++;
            }
        }
        
        // Second pass: collect matching positions
        list = new Position[](matchCount);
        uint256 resultIndex = 0;
        for (uint256 i = 0; i < allIds.length && resultIndex < matchCount; i++) {
            if (positions[allIds[i]].status == status) {
                list[resultIndex] = positions[allIds[i]];
                resultIndex++;
            }
        }
        
        return list;
    }

    /**
     * @dev Get position summary statistics
     * @param user The user address
     * @return total Total number of positions
     * @return pending Number of pending positions
     * @return active Number of active positions
     * @return liquidated Number of liquidated positions
     * @notice Gas-efficient way to get overview without loading all position data
     */
    function getUserPositionStats(address user) external view returns (
        uint256 total,
        uint256 pending,
        uint256 active,
        uint256 liquidated
    ) {
        bytes32[] storage allIds = userPositions[user];
        total = allIds.length;
        
        for (uint256 i = 0; i < allIds.length; i++) {
            PositionStatus status = positions[allIds[i]].status;
            if (status == PositionStatus.PendingExecution) {
                pending++;
            } else if (status == PositionStatus.Active) {
                active++;
            } else if (status == PositionStatus.Liquidated) {
                liquidated++;
            }
        }
        
        return (total, pending, active, liquidated);
    }

    /**
     * @dev LEGACY: Get all user positions (kept for backwards compatibility)
     * @param user The user address
     * @return list Array of all Position structs
     * @notice ⚠️ WARNING: May fail with ContractTrapped if user has 50+ positions
     * @notice RECOMMENDED: Use getUserPositionsPage() instead for large position counts
     */
    function getUserPositions(address user) external view returns (Position[] memory list) {
        bytes32[] storage ids = userPositions[user];
        list = new Position[](ids.length);
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

    /**
    * @dev Receive function to accept ETH transfers (for XCM returns and testing)
    * @notice Only accepts ETH - no other functions can be called via this interface
    */
    receive() external payable {
        // Accept ETH transfers for XCM returns and testing
        // No additional logic needed - balance tracking is handled in settleLiquidation
    }

} 