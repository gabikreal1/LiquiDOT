// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

contract MockXTokens {
    event Transfer(address token, uint256 amount, bytes dest, uint64 destWeight);

    function transfer(address token, uint256 amount, bytes calldata dest, uint64 destWeight) external {
        emit Transfer(token, amount, dest, destWeight);
    }
}
