// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.0;

/**
 * @title XCMConstants
 * @dev Library for XCM-related constants
 */
library XCMConstants {
    // Addresses
    address internal constant XCM_TRANSACTOR = 0x0000000000000000000000000000000000000806;
    address internal constant ASSET_TRANSFER = 0x0000000000000000000000000000000000000815;
    
    // Chain info
    uint32 internal constant MOONBEAM_PARACHAIN_ID = 1287;
    uint16 internal constant FEE_LOCATION = 1;
    
    // Weights
    uint64 internal constant TRANSACT_WEIGHT = 1000000000;
    uint64 internal constant OVERALL_WEIGHT = 8000000000;
    uint64 internal constant ASSET_TRANSFER_WEIGHT = 5000000000;
} 