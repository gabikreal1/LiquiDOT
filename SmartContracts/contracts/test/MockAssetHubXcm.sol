// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

contract MockAssetHubXcm {
    event Sent(bytes destination, bytes message);

    function send(bytes calldata destination, bytes calldata message) external {
        emit Sent(destination, message);
    }
}
