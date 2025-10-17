// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "../TestBase.sol";
import "../../contracts/V1(Current)/XCMProxy.sol";

contract EmergencyTest is TestBase {
    XCMProxy private proxy;

    address private constant ADMIN = address(0xABCD);
    address private constant USER = address(0xCAFE);

    function setUp() public {
        proxy = new XCMProxy(ADMIN);
        proxy.setTestMode(true);
    }

    function testPauseUnpause() public {
        vm.prank(ADMIN);
        proxy.pause();
        // ensure paused via calling pause-only function
        vm.prank(ADMIN);
        proxy.setTestMode(true);
        vm.prank(ADMIN);
        proxy.unpause();
    }

    function testOperatorUpdateByOwner() public {
        vm.prank(ADMIN);
        proxy.setOperator(address(0xBEEF));
        assertEq(proxy.operator(), address(0xBEEF), "operator updated");
    }

    function testAddRemoveSupportedToken() public {
        vm.prank(ADMIN);
        proxy.addSupportedToken(address(0x1111));
        vm.prank(ADMIN);
        proxy.removeSupportedToken(address(0x1111));
    }
}
