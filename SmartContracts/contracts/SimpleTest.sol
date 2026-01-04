// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SimpleTest {
    uint256 public val;
    function setVal(uint256 _val) external {
        val = _val;
    }
}