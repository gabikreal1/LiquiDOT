// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "./IXcmSender.sol";

/// @dev Weight struct for XCM message estimation
/// @param refTime Reference time in picoseconds for computational work
/// @param proofSize Proof size in bytes for PoV (Proof of Validity)
struct Weight {
    uint64 refTime;
    uint64 proofSize;
}

/// @dev Official Polkadot XCM precompile interface
/// @notice Located at 0x00000000000000000000000000000000000a0000
/// @dev See: https://docs.polkadot.com/develop/smart-contracts/precompiles/xcm-precompile/
interface IXcm {
    /// @dev Execute an XCM message locally on this chain
    /// @param message SCALE-encoded XCM program
    /// @param weight Maximum weight to consume
    function execute(bytes calldata message, Weight calldata weight) external;

    /// @dev Send an XCM message to a destination chain
    /// @param destination SCALE-encoded MultiLocation of target chain
    /// @param message SCALE-encoded XCM program
    function send(bytes calldata destination, bytes calldata message) external;

    /// @dev Estimate the weight required to execute an XCM message
    /// @param message SCALE-encoded XCM program
    /// @return weight The estimated weight for execution
    function weighMessage(bytes calldata message) external view returns (Weight memory weight);
}

/// @notice Adapter that forwards XCM sends to the official Polkadot XCM precompile
/// @dev Address: 0x00000000000000000000000000000000000a0000
/// @dev Messages must be SCALE-encoded XCM programs
/// @notice Only the authorized caller (AssetHubVault) may invoke sendXcm.
contract AssetHubXcmSender is IXcmSender {
    error ZeroAddress();
    error UnauthorizedCaller();

    /// @dev Default XCM precompile address on Asset Hub
    address public constant XCM_PRECOMPILE = 0x00000000000000000000000000000000000a0000;

    IXcm public immutable xcm;
    address public immutable authorizedCaller;

    /// @param xcmAddress Optional custom XCM precompile address, or address(0) to use default
    /// @param _authorizedCaller The only address allowed to call sendXcm (e.g. AssetHubVault)
    constructor(address xcmAddress, address _authorizedCaller) {
        if (_authorizedCaller == address(0)) revert ZeroAddress();
        xcm = IXcm(xcmAddress == address(0) ? XCM_PRECOMPILE : xcmAddress);
        authorizedCaller = _authorizedCaller;
    }

    function sendXcm(bytes calldata destination, bytes calldata message) external override {
        if (msg.sender != authorizedCaller) revert UnauthorizedCaller();
        xcm.send(destination, message);
    }
}
