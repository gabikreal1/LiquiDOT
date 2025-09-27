// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title XCMEncoder
 * @dev Library for SCALE encoding XCM messages and MultiLocations
 * @notice Implements proper SCALE encoding for Asset Hub XCM integration
 */
library XCMEncoder {
    
    // XCM Version
    uint8 constant XCM_VERSION = 3;
    
    // Junction types for MultiLocation
    uint8 constant JUNCTION_PARACHAIN = 0x00;
    uint8 constant JUNCTION_ACCOUNT_KEY20 = 0x03;
    uint8 constant JUNCTION_ACCOUNT_ID32 = 0x01;
    uint8 constant JUNCTION_PALLET_INSTANCE = 0x04;
    
    // XCM Instruction opcodes
    uint8 constant WITHDRAW_ASSET = 0x01;
    uint8 constant RESERVE_ASSET_DEPOSITED = 0x02;
    uint8 constant RECEIVE_TELEPORTED_ASSET = 0x03;
    uint8 constant QUERY_RESPONSE = 0x04;
    uint8 constant TRANSFER_ASSET = 0x05;
    uint8 constant TRANSFER_RESERVE_ASSET = 0x06;
    uint8 constant TRANSACT = 0x07;
    uint8 constant HRP_NEW_CHANNEL_OPEN_REQUEST = 0x08;
    uint8 constant HRP_CHANNEL_ACCEPTED = 0x09;
    uint8 constant HRP_CHANNEL_CLOSING = 0x0A;
    uint8 constant CLEAR_ORIGIN = 0x0B;
    uint8 constant DESCEND_ORIGIN = 0x0C;
    uint8 constant REPORT_ERROR = 0x0D;
    uint8 constant DEPOSIT_ASSET = 0x0E;
    uint8 constant DEPOSIT_RESERVE_ASSET = 0x0F;
    uint8 constant EXCHANGE_ASSET = 0x10;
    uint8 constant INITIATE_RESERVE_WITHDRAW = 0x11;
    uint8 constant INITIATE_TELEPORT = 0x12;
    uint8 constant REPORT_HOLDING = 0x13;
    uint8 constant BUY_EXECUTION = 0x14;
    uint8 constant REFUND_SURPLUS = 0x15;
    uint8 constant SET_ERROR_HANDLER = 0x16;
    uint8 constant SET_APPENDIX = 0x17;
    uint8 constant CLEAR_ERROR = 0x18;
    uint8 constant CLAIM_ASSET = 0x19;
    uint8 constant TRAP = 0x1A;
    uint8 constant SUBSCRIBE_VERSION = 0x1B;
    uint8 constant UNSUBSCRIBE_VERSION = 0x1C;
    uint8 constant BURN_ASSET = 0x1D;
    uint8 constant EXPECT_ASSET = 0x1E;
    uint8 constant EXPECT_ORIGIN = 0x1F;
    uint8 constant EXPECT_ERROR = 0x20;
    uint8 constant EXPECT_TRANSACT_STATUS = 0x21;
    uint8 constant QUERY_PALLET = 0x22;
    uint8 constant EXPECT_PALLET = 0x23;
    uint8 constant REPORT_TRANSACT_STATUS = 0x24;
    uint8 constant CLEAR_TRANSACT_STATUS = 0x25;
    uint8 constant UNIVERSAL_ORIGIN = 0x26;
    uint8 constant EXPORT_MESSAGE = 0x27;
    uint8 constant LOCK_ASSET = 0x28;
    uint8 constant UNLOCK_ASSET = 0x29;
    uint8 constant NOTE_UNLOCKABLE = 0x2A;
    uint8 constant REQUEST_UNLOCK = 0x2B;
    uint8 constant SET_FEES_MODE = 0x2C;
    uint8 constant SET_TOPIC = 0x2D;
    uint8 constant CLEAR_TOPIC = 0x2E;
    uint8 constant ALIAS_ORIGIN = 0x2F;
    uint8 constant UNPAID_EXECUTION = 0x30;

    struct Junction {
        uint8 junctionType;
        bytes data;
    }

    struct MultiLocation {
        uint8 parents;
        Junction[] junctions;
    }

    struct MultiAsset {
        MultiLocation id;
        uint256 amount;
    }

    struct Weight {
        uint64 refTime;
        uint64 proofSize;
    }

    /**
     * @dev Encode a compact integer using SCALE encoding
     */
    function encodeCompact(uint256 value) internal pure returns (bytes memory) {
        if (value < 2**6) {
            // Single byte mode: 0b00
            return abi.encodePacked(uint8(value << 2));
        } else if (value < 2**14) {
            // Two byte mode: 0b01
            uint16 encoded = uint16((value << 2) | 0x01);
            return abi.encodePacked(encoded);
        } else if (value < 2**30) {
            // Four byte mode: 0b10
            uint32 encoded = uint32((value << 2) | 0x02);
            return abi.encodePacked(encoded);
        } else {
            // Big integer mode: 0b11
            bytes memory valueBytes = abi.encodePacked(value);
            uint8 length = uint8(valueBytes.length);
            return abi.encodePacked(uint8((length - 4) << 2 | 0x03), valueBytes);
        }
    }

    /**
     * @dev Create a parachain junction
     */
    function createParachainJunction(uint32 parachainId) internal pure returns (Junction memory) {
        return Junction({
            junctionType: JUNCTION_PARACHAIN,
            data: abi.encodePacked(parachainId)
        });
    }

    /**
     * @dev Create an AccountKey20 junction (Ethereum-style address)
     */
    function createAccountKey20Junction(address account, uint8 network) internal pure returns (Junction memory) {
        return Junction({
            junctionType: JUNCTION_ACCOUNT_KEY20,
            data: abi.encodePacked(account, network)
        });
    }

    /**
     * @dev Create an AccountId32 junction (Substrate-style address)
     */
    function createAccountId32Junction(bytes32 account, uint8 network) internal pure returns (Junction memory) {
        return Junction({
            junctionType: JUNCTION_ACCOUNT_ID32,
            data: abi.encodePacked(account, network)
        });
    }

    /**
     * @dev Create a PalletInstance junction
     */
    function createPalletInstanceJunction(uint8 palletIndex) internal pure returns (Junction memory) {
        return Junction({
            junctionType: JUNCTION_PALLET_INSTANCE,
            data: abi.encodePacked(palletIndex)
        });
    }

    /**
     * @dev Encode a junction to SCALE format
     */
    function encodeJunction(Junction memory junction) internal pure returns (bytes memory) {
        return abi.encodePacked(junction.junctionType, junction.data);
    }

    /**
     * @dev Encode a MultiLocation to SCALE format
     */
    function encodeMultiLocation(MultiLocation memory location) internal pure returns (bytes memory) {
        bytes memory encoded = abi.encodePacked(location.parents);
        
        // Encode junctions array length
        encoded = abi.encodePacked(encoded, encodeCompact(location.junctions.length));
        
        // Encode each junction
        for (uint i = 0; i < location.junctions.length; i++) {
            encoded = abi.encodePacked(encoded, encodeJunction(location.junctions[i]));
        }
        
        return encoded;
    }

    /**
     * @dev Create MultiLocation for an arbitrary parachain under the relay
     */
    function createParachainLocation(uint32 parachainId) internal pure returns (MultiLocation memory) {
        Junction[] memory junctions = new Junction[](1);
        junctions[0] = createParachainJunction(parachainId);
        return MultiLocation({ parents: 1, junctions: junctions });
    }

    /**
     * @dev Create MultiLocation for an AccountKey20 on an arbitrary parachain under the relay
     * @param network NetworkId for AccountKey20 (usually 0)
     */
    function createParachainAccountKey20Location(uint32 parachainId, address account, uint8 network)
        internal pure returns (MultiLocation memory)
    {
        Junction[] memory junctions = new Junction[](2);
        junctions[0] = createParachainJunction(parachainId);
        junctions[1] = createAccountKey20Junction(account, network);
        return MultiLocation({ parents: 1, junctions: junctions });
    }

    /**
     * @dev Encode a MultiAsset (fungible token)
     */
    function encodeMultiAsset(MultiLocation memory assetLocation, uint256 amount) 
        internal pure returns (bytes memory) {
        
        bytes memory encoded = abi.encodePacked(
            uint8(0x00), // Fungible asset type
            encodeMultiLocation(assetLocation),
            encodeCompact(amount)
        );
        
        return encoded;
    }

    /**
     * @dev Create VersionedXcm wrapper
     */
    function createVersionedXcm(bytes memory xcmProgram) internal pure returns (bytes memory) {
        return abi.encodePacked(
            uint8(XCM_VERSION), // Version 3
            xcmProgram
        );
    }

    

    /**
     * @dev Create a reserve transfer XCM program. If `call` is empty, this
     *      produces a plain asset transfer sequence (WithdrawAsset → ClearOrigin
     *      → BuyExecution → DepositAsset). If `call` is provided, a Transact
     *      instruction is appended after deposit so execution happens after
     *      assets are credited.
     */
    function createReserveTransferXcm(
        MultiLocation memory asset,
        uint256 amount,
        MultiLocation memory destination,
        bytes memory call,
        Weight memory weight
    ) internal pure returns (bytes memory) {
        // Build in small chunks to avoid stack-too-deep
        uint256 instructionCount = call.length > 0 ? 5 : 4;
        bytes memory program = abi.encodePacked(encodeCompact(instructionCount)); // Number of instructions

        // 1. WithdrawAsset
        program = abi.encodePacked(
            program,
            WITHDRAW_ASSET,
            encodeCompact(1), // Number of assets
            encodeMultiAsset(asset, amount)
        );

        // 2. ClearOrigin
        program = abi.encodePacked(program, CLEAR_ORIGIN);

        // 3. BuyExecution
        program = abi.encodePacked(
            program,
            BUY_EXECUTION,
            encodeMultiAsset(asset, amount / 20), // Use 5% for fees
            encodeCompact(weight.refTime),
            encodeCompact(weight.proofSize)
        );

        // 4. DepositAsset (send assets to destination account first)
        program = abi.encodePacked(
            program,
            DEPOSIT_ASSET,
            uint8(0x01), // Wild asset filter (All)
            uint8(0x01), // Max assets = 1
            encodeMultiLocation(destination)
        );

        // 5. Transact (if call provided) — execute after assets are credited
        if (call.length > 0) {
            program = abi.encodePacked(
                program,
                TRANSACT,
                uint8(0x00), // OriginKind::Native
                encodeCompact(weight.refTime),
                encodeCompact(weight.proofSize),
                encodeCompact(call.length),
                call
            );
        }

        return createVersionedXcm(program);
    }

    /**
     * @dev Encode Weight struct
     */
    function encodeWeight(Weight memory weight) internal pure returns (bytes memory) {
        return abi.encodePacked(
            encodeCompact(weight.refTime),
            encodeCompact(weight.proofSize)
        );
    }
}
