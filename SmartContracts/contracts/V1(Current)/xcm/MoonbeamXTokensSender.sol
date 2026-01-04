// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "./IXcmSender.sol";

/// @dev Minimal Moonbeam XTokens precompile interface.
interface IXTokens {
    function transfer(address token, uint256 amount, bytes calldata dest, uint64 destWeight) external;
}

/// @notice Adapter that turns LiquiDOT's generic sendXcm(destination,message) into an XTokens transfer.
/// @dev This is intentionally narrow: it's useful for "return assets" flows where message is not needed.
///      For general XCM programs, Moonbeam typically uses different precompiles (XCM Transactor).
contract MoonbeamXTokensSender is IXcmSender {
    error ZeroAddress();

    IXTokens public immutable xtokens;
    address public immutable token;
    uint64 public immutable destWeight;

    constructor(address xTokensPrecompile, address tokenToSend, uint64 defaultDestWeight) {
        if (xTokensPrecompile == address(0) || tokenToSend == address(0)) revert ZeroAddress();
        xtokens = IXTokens(xTokensPrecompile);
        token = tokenToSend;
        destWeight = defaultDestWeight;
    }

    /// @dev Interprets `message` as the uint256 amount to transfer.
    ///      This keeps the adapter interface stable while allowing us to move logic out of core contracts.
    function sendXcm(bytes calldata destination, bytes calldata message) external override {
        require(message.length == 32, "amount must be 32 bytes");
        uint256 amount;
        assembly {
            amount := calldataload(message.offset)
        }
        xtokens.transfer(token, amount, destination, destWeight);
    }
}
