// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "./TestBase.sol";
import "../../contracts/V1(Current)/XCMProxy.sol";

contract EmergencyTest is TestBase {
    XCMProxy private proxy;

    address private constant ADMIN = address(0xABCD);
    address private constant USER = address(0xCAFE);

    function setUp() public {
        proxy = new XCMProxy(address(this)); // Set the test contract as owner
        proxy.setTestMode(true);
    }

    function testPauseUnpause() public {
        proxy.pause();
        // ensure paused via calling pause-only function
        proxy.setTestMode(true);
        proxy.unpause();
    }

    function testOperatorUpdateByOwner() public {
        proxy.setOperator(address(0xBEEF));
        assertEq(proxy.operator(), address(0xBEEF), "operator updated");
    }

    function testAddRemoveSupportedToken() public {
        proxy.addSupportedToken(address(0x1111));
        proxy.removeSupportedToken(address(0x1111));
    }
}
