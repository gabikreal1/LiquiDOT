// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

interface Vm {
    // Time
    function warp(uint256) external;

    // Ether balance helpers
    function deal(address who, uint256 newBalance) external;

    // Pranks
    function prank(address) external;
    function startPrank(address) external;
    function startPrank(address, address) external;
    function stopPrank() external;

    // Reverts
    function expectRevert(bytes calldata) external;
    function expectRevert() external;

    // Mocked calls
    function mockCall(address, bytes calldata, bytes calldata) external;
    function clearMockedCalls() external;
}

error AssertionFailed(string message);

abstract contract TestBase {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function assertEq(uint256 actual, uint256 expected, string memory message) internal pure {
        if (actual != expected) revert AssertionFailed(message);
    }

    function assertEq(int256 actual, int256 expected, string memory message) internal pure {
        if (actual != expected) revert AssertionFailed(message);
    }

    function assertEq(address actual, address expected, string memory message) internal pure {
        if (actual != expected) revert AssertionFailed(message);
    }

    function assertTrue(bool condition, string memory message) internal pure {
        if (!condition) revert AssertionFailed(message);
    }

    function assertFalse(bool condition, string memory message) internal pure {
        if (condition) revert AssertionFailed(message);
    }
}
