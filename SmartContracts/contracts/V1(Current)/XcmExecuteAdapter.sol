// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/// @dev Weight struct for XCM message estimation
struct Weight {
    uint64 refTime;
    uint64 proofSize;
}

/// @dev Official Polkadot Asset Hub XCM precompile interface (Message First per docs.polkadot.com)
interface IXcm {
    function execute(bytes calldata message, Weight calldata weight) external;
    function weighMessage(bytes calldata message) external view returns (Weight memory);
}

/**
 * @title XcmExecuteAdapter
 * @dev Adapts the `send` interface to `execute` for local XCM instructions.
 * @notice Required because AssetHubVault calls `send` which transmits messages to other chains,
 *         but for asset transfers we must first `execute` a `WithdrawAsset` instruction locally.
 * @notice Only the authorized caller (AssetHubVault) may invoke `send`.
 */
contract XcmExecuteAdapter {
    address public constant XCM_PRECOMPILE = 0x00000000000000000000000000000000000a0000;

    address public immutable authorizedCaller;

    error UnauthorizedCaller();

    event XcmExecutionForwarded(bytes message, Weight weight);

    constructor(address _authorizedCaller) {
        require(_authorizedCaller != address(0), "zero address");
        authorizedCaller = _authorizedCaller;
    }

    /**
     * @dev Matches the IXcm.send signature but forwards to IXcm.execute.
     * @param destination Ignored (destination is embedded in the XCM message instructions).
     * @param message The full XCM message (e.g. WithdrawAsset -> InitiateReserveWithdraw).
     */
    function send(bytes calldata destination, bytes calldata message) external {
        if (msg.sender != authorizedCaller) revert UnauthorizedCaller();

        // Get actual weight from precompile (more accurate than hardcoded)
        Weight memory weight = IXcm(XCM_PRECOMPILE).weighMessage(message);

        // Add 10% buffer to weight for safety
        weight.refTime = weight.refTime * 110 / 100;
        weight.proofSize = weight.proofSize * 110 / 100;

        // Execute with Message First (per Asset Hub docs)
        IXcm(XCM_PRECOMPILE).execute(message, weight);

        emit XcmExecutionForwarded(message, weight);
    }
}
