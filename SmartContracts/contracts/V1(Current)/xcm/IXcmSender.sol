// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/// @title IXcmSender
/// @notice Minimal common interface used by LiquiDOT contracts to send XCM.
/// @dev This is an abstraction layer over different chain-specific XCM mechanisms:
///
/// MOONBEAM NETWORKS (Moonbeam, Moonriver, Moonbase Alpha):
/// - Uses XTokens precompile at 0x0000000000000000000000000000000000000804
/// - Higher-level abstraction: transfer(token, amount, dest, destWeight)
/// - Automatically constructs XCM programs for token transfers
/// - See: MoonbeamXTokensSender.sol
///
/// ASSET HUB (Polkadot, Kusama, Paseo):
/// - Uses official XCM precompile at 0x00000000000000000000000000000000000a0000
/// - Lower-level interface: send(destination, message)
/// - Requires SCALE-encoded XCM programs
/// - Docs: https://docs.polkadot.com/develop/smart-contracts/precompiles/xcm-precompile/
/// - See: AssetHubXcmSender.sol
///
interface IXcmSender {
    /// @dev Sends an XCM message using chain-specific mechanism.
    /// @param destination Chain-specific encoded destination (SCALE-encoded MultiLocation).
    /// @param message Chain-specific encoded XCM program or amount (depends on adapter).
    function sendXcm(bytes calldata destination, bytes calldata message) external;
}
