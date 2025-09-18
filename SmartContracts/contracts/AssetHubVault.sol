// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./libraries/XCMEncoder.sol";

// XCM precompile interface - the ONLY precompile available on Asset Hub
interface IXcm {
    struct Weight { uint64 refTime; uint64 proofSize; }
    function execute(bytes calldata message, Weight calldata weight) external;
    function send(bytes calldata destination, bytes calldata message) external;
    function weighMessage(bytes calldata message) external view returns (Weight memory weight);
}

// Interface for receiving XCM messages 
interface IXCMMessageReceiver {
    function receiveAssets(
        address token,
        address user,
        uint256 amount,
        bytes calldata params
    ) external;
}

/**
* @title AssetHubVault
* @dev Primary custody layer for cross-chain liquidity management on Asset Hub
* @notice Uses ONLY the IXcm precompile interface available on Asset Hub
* @notice Does NOT use XTokens or XcmTransactor precompiles (not available on Asset Hub)
*/
contract AssetHubVault is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using XCMEncoder for *;

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
    error DestinationNotConfigured();
    error DestinationNotAllowed();
    error RuntimeCallRequired();
    error ChainConfigMissing();
    error XcmPrecompileNotSet();
    error UnauthorizedXcmCall();
    error PositionNotActive();
    error ChainIdMismatch();
    error AmountMismatch();

    modifier onlyAdmin() { if (msg.sender != admin) revert NotAdmin(); _; }
    modifier onlyOperator() { if (msg.sender != operator) revert NotOperator(); _; }
    modifier onlyEmergency() { if (msg.sender != emergency) revert NotEmergency(); _; }

    // Minimal pause
    bool public paused;
    modifier whenNotPaused() { if (paused) revert Paused(); _; }

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
        address poolId,
        uint256[] amounts
    );
    event PositionLiquidated(
        bytes32 indexed positionId,
        address indexed user,
        uint256[] finalAmounts
    );
    event XCMMessageSent(
        bytes32 indexed messageHash,
        bytes destination,
        bytes message
    );
    event XCMConfigurationUpdated(
        bytes newDestination
    );
    event XCMChainDestinationUpdated(uint32 indexed chainId, bytes destination);
    event XcmSendAttempt(bytes32 indexed messageHash, bytes destination, bool success, bytes errorData);

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
        uint256[] amounts;
    }
    // Polkadot XCM precompile (PolkaVM) configurable address; depends on runtime
    address public XCM_PRECOMPILE;
    bool public xcmPrecompileFrozen;
    // Destination MultiLocation per chainId encoded as bytes (SCALE). chainId=0 is default.
    mapping(uint32 => bytes) private chainDestinations;
    // Allowlist of destination contracts on remote chains
    mapping(address => bool) private isAllowedDestination;

    // Generic per-chain configuration for building deposit destinations inside XCM programs
    struct ChainConfig { uint32 parachainId; uint8 accountKey20Network; }
    mapping(uint32 => ChainConfig) public chainConfigs; // chainId => config

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

    // Selector for XCMProxy.receiveAssets(address,address,uint256,bytes)
    bytes4 private constant RECEIVE_ASSETS_SELECTOR = bytes4(keccak256("receiveAssets(address,address,uint256,bytes)"));

    function freezeXcmPrecompile() external onlyAdmin {
        require(!xcmPrecompileFrozen, "already frozen");
        xcmPrecompileFrozen = true;
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
    * @dev Deposit tokens into the vault
    */
    function deposit(address token, uint256 amount) external nonReentrant {
        if (amount == 0) revert AmountZero();
        if (token == address(0)) revert ZeroAddress();

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        userBalances[msg.sender][token] += amount;

        emit Deposit(msg.sender, token, amount);
    }

    /**
    * @dev Withdraw tokens from the vault
    */
    function withdraw(address token, uint256 amount) external nonReentrant {
        if (amount == 0) revert AmountZero();
        if (userBalances[msg.sender][token] < amount) revert InsufficientBalance();

        userBalances[msg.sender][token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);

        emit Withdrawal(msg.sender, token, amount);
    }

    /**
    * @dev Initiate cross-chain investment with pre-encoded runtime call (Transact)
    * The runtime call MUST be SCALE-encoded for the destination chain to execute
    * pallet-evm (or equivalent) to call XCMProxy.receiveAssets with the encoded params.
    */
    function investInPool(
        uint32 chainId,
        address poolId,
        address baseAsset,
        uint256[] memory amounts,
        int24 lowerRangePercent,
        int24 upperRangePercent,
        address destinationContract,
        bytes calldata runtimeCall
    ) external onlyOperator whenNotPaused {
        if (amounts.length == 0) revert AmountZero();
        if (!(lowerRangePercent < upperRangePercent)) revert InvalidRange();
        if (_getDestinationForChain(chainId).length == 0) revert DestinationNotConfigured();
        if (!isAllowedDestination[destinationContract]) revert DestinationNotAllowed();
        if (runtimeCall.length == 0) revert RuntimeCallRequired();

        uint256 totalAmount;
        for (uint256 i = 0; i < amounts.length; ) { totalAmount += amounts[i]; unchecked { i++; } }

        if (userBalances[msg.sender][baseAsset] < totalAmount) revert InsufficientBalance();

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
            poolId: poolId,
            baseAsset: baseAsset,
            chainId: chainId,
            lowerRangePercent: lowerRangePercent,
            upperRangePercent: upperRangePercent,
            timestamp: uint64(block.timestamp),
            active: true,
            amounts: amounts
        });

        userPositions[msg.sender].push(positionId);

        userBalances[msg.sender][baseAsset] -= totalAmount;

        emit InvestmentInitiated(positionId, msg.sender, chainId, poolId, amounts);

        // Build XCM with Transact carrying the provided runtime call
        bytes memory xcmMessage = _createReserveTransferMessage(chainId, totalAmount, destinationContract, runtimeCall);

        _sendXCMMessage(chainId, xcmMessage);
    }


    /**
    * @dev Create properly SCALE-encoded XCM message for investment operation
    */
    function _createReserveTransferMessage(
        uint32 chainId,
        uint256 amount,
        address destinationAccount,
        bytes memory runtimeCall
    ) internal view returns (bytes memory) {
        XCMEncoder.MultiLocation memory assetLocation = _createNativeAssetLocation();
        ChainConfig memory cfg = chainConfigs[chainId];
        if (cfg.parachainId == 0) revert ChainConfigMissing();
        XCMEncoder.MultiLocation memory remoteAccountLocation = XCMEncoder.createParachainAccountKey20Location(
            cfg.parachainId,
            destinationAccount,
            cfg.accountKey20Network
        );

        XCMEncoder.Weight memory executionWeight = XCMEncoder.Weight({
            refTime: 1000000000,
            proofSize: 65536
        });

        return XCMEncoder.createReserveTransferXcm(
            assetLocation,
            amount,
            remoteAccountLocation,
            runtimeCall,
            executionWeight
        );
    }

    /**
    * @dev Create MultiLocation for native asset (DOT on Asset Hub)
    */
    function _createNativeAssetLocation() internal pure returns (XCMEncoder.MultiLocation memory) {
        // Native DOT has empty junctions (Here location)
        XCMEncoder.Junction[] memory junctions = new XCMEncoder.Junction[](0);
        
        return XCMEncoder.MultiLocation({
            parents: 0, // Here
            junctions: junctions
        });
    }

    /**
    * @dev Create MultiLocation for specific ERC20 asset on Asset Hub
    */
    function _createAssetLocation(uint32 assetId) internal pure returns (XCMEncoder.MultiLocation memory) {
        XCMEncoder.Junction[] memory junctions = new XCMEncoder.Junction[](2);
        junctions[0] = XCMEncoder.createPalletInstanceJunction(50); // Assets pallet
        junctions[1] = XCMEncoder.Junction({
            junctionType: 0x05, // GeneralIndex
            data: abi.encodePacked(assetId)
        });
        
        return XCMEncoder.MultiLocation({
            parents: 0, // Here (Asset Hub)
            junctions: junctions
        });
    }

    /**
    * @dev Internal function to send XCM message via precompile
    */
    function _sendXCMMessage(uint32 chainId, bytes memory message) internal {
        bytes32 messageHash = keccak256(message);
        
        // Resolve destination for chain or fallback to default (0)
        bytes memory destination = _getDestinationForChain(chainId);

        // Send via XCM precompile
        if (XCM_PRECOMPILE == address(0)) revert XcmPrecompileNotSet();
        bool success = false;
        bytes memory err;
        try IXcm(XCM_PRECOMPILE).send(destination, message) {
            success = true;
        } catch (bytes memory reason) {
            err = reason;
        }
        emit XCMMessageSent(messageHash, destination, message);
        emit XcmSendAttempt(messageHash, destination, success, err);
    }

    function _getDestinationForChain(uint32 chainId) internal view returns (bytes memory) {
        bytes memory dest = chainDestinations[chainId];
        if (dest.length == 0) {
            dest = chainDestinations[0];
        }
        return dest;
    }

    /**
    * @dev Admin: set the destination MultiLocation using proper SCALE encoding
    */
    function setDestinationMultiLocation(bytes calldata destination) external onlyAdmin {
        // Backward-compatible default destination (chainId = 0)
        chainDestinations[0] = destination;
        emit XCMConfigurationUpdated(destination);
        emit XCMChainDestinationUpdated(0, destination);
    }
    /**
    * @dev Admin: set destination MultiLocation for a specific chainId
    */
    function setDestinationForChain(uint32 chainId, bytes calldata destination) external onlyAdmin {
        chainDestinations[chainId] = destination;
        emit XCMChainDestinationUpdated(chainId, destination);
    }

    /**
    * @dev Admin: set chain configuration used for deposit MultiLocation building
    */
    function setChainConfig(uint32 chainId, uint32 parachainId, uint8 network) external onlyAdmin {
        chainConfigs[chainId] = ChainConfig({ parachainId: parachainId, accountKey20Network: network });
    }

    /**
    * @dev Get destination MultiLocation for a chainId (falls back to default if empty)
    */
    function getDestinationForChain(uint32 chainId) external view returns (bytes memory) {
        bytes memory dest = chainDestinations[chainId];
        if (dest.length == 0) {
            dest = chainDestinations[0];
        }
        return dest;
    }

    /**
    * @dev Admin: manage allowed destination contracts
    */
    function setAllowedDestination(address destination, bool allowed) external onlyAdmin {
        isAllowedDestination[destination] = allowed;
    }

    /**
    * @dev Handle incoming XCM messages (called by XCM precompile)
    * @notice This function can be called by the XCM system to deliver assets or data
    */
    function handleIncomingXCM(
        address /*token*/,
        uint256 amount,
        bytes calldata data
    ) external {
        // Only allow calls from XCM precompile or authorized operators
        if (!(
            (XCM_PRECOMPILE != address(0) && msg.sender == XCM_PRECOMPILE) || msg.sender == operator || msg.sender == admin
        )) revert UnauthorizedXcmCall();
        if (amount == 0) revert AmountZero();

        if (data.length > 0) {
            // Decode the XCM data to determine the action
            (string memory action, bytes memory params) = abi.decode(data, (string, bytes));
            
            if (keccak256(bytes(action)) == keccak256(bytes("LIQUIDATION_PROCEEDS"))) {
                // Handle liquidation proceeds
                (bytes32 positionId, address user, uint256[] memory finalAmounts) = 
                    abi.decode(params, (bytes32, address, uint256[]));
                
                Position storage position = positions[positionId];
                require(position.user == user, "user mismatch");
                if (position.active) {
                    position.active = false;
                    uint256 sum;
                    for (uint256 i = 0; i < finalAmounts.length; i++) { if (finalAmounts[i] > 0) sum += finalAmounts[i]; }
                    if (sum != amount) revert AmountMismatch();
                    userBalances[user][position.baseAsset] += amount;
                    emit PositionLiquidated(positionId, user, finalAmounts);
                }
            }
        } else {
            
        }
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