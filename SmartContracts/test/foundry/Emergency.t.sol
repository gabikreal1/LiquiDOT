// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "./helpers/TestSetup.sol";

/**
 * @title EmergencyTest
 * @notice Foundry tests for emergency procedures
 * @dev Tests emergency liquidation, pause/unpause, and recovery scenarios
 */
contract EmergencyTest is TestSetup {
    AssetHubVault public vault;
    XCMProxy public proxy;

    function setUp() public {
        setupAccounts();
        vault = deployAndConfigureVault();
        proxy = deployAndConfigureProxy();
    }

    // ============ Emergency Liquidation Tests ============

    function testEmergencyLiquidation() public {
        // Setup: Create a position
        uint256 depositAmount = 20 ether;
        uint256 investAmount = 10 ether;

        vm.prank(user1);
        vault.deposit{value: depositAmount}();

        vm.startPrank(operator);
        vault.dispatchInvestment(
            user1,
            CHAIN_ID,
            POOL_ID,
            BASE_ASSET,
            investAmount,
            -1000,
            1000,
            generateDestination(),
            generateXCMMessage()
        );

        bytes32 positionId = vault.getUserPositions(user1)[0];
        vm.deal(address(proxy), investAmount);

        proxy.executeInvestment(
            positionId,
            user1,
            POOL_ID,
            BASE_ASSET,
            investAmount,
            -1000,
            1000
        );
        vm.stopPrank();

        // Emergency role triggers emergency liquidation
        vm.startPrank(emergency);
        uint256 recoveredAmount = 11 ether; // Simulated recovery
        
        vault.emergencyLiquidatePosition(positionId, user1, recoveredAmount);
        vm.stopPrank();

        // Verify position marked inactive
        (,,,,,,, bool active) = vault.positions(positionId);
        assertFalse(active, "Position should be inactive after emergency liquidation");

        // Verify balance updated
        uint256 expectedBalance = depositAmount - investAmount + recoveredAmount;
        assertEq(vault.getUserBalance(user1), expectedBalance, "Balance incorrect after emergency liquidation");
    }

    function testEmergencyLiquidationOnlyEmergencyRole() public {
        vm.prank(user1);
        vault.deposit{value: 20 ether}();

        vm.startPrank(operator);
        vault.dispatchInvestment(
            user1,
            CHAIN_ID,
            POOL_ID,
            BASE_ASSET,
            10 ether,
            -1000,
            1000,
            generateDestination(),
            generateXCMMessage()
        );
        vm.stopPrank();

        bytes32 positionId = vault.getUserPositions(user1)[0];

        // Non-emergency role tries to emergency liquidate
        vm.startPrank(user2);
        vm.expectRevert(AssetHubVault.NotEmergency.selector);
        vault.emergencyLiquidatePosition(positionId, user1, 10 ether);
        vm.stopPrank();
    }

    // ============ Emergency Pause Tests ============

    function testEmergencyPause() public {
        vm.prank(deployer); // Admin
        vault.pause();

        assertTrue(vault.paused(), "Contract should be paused");

        // Verify deposits blocked
        vm.startPrank(user1);
        vm.expectRevert(AssetHubVault.ContractPaused.selector);
        vault.deposit{value: 10 ether}();
        vm.stopPrank();
    }

    function testEmergencyPauseBlocksAllOperations() public {
        // Setup some deposits first
        vm.prank(user1);
        vault.deposit{value: 20 ether}();

        // Pause contract
        vm.prank(deployer);
        vault.pause();

        // Try deposit - should fail
        vm.startPrank(user2);
        vm.expectRevert(AssetHubVault.ContractPaused.selector);
        vault.deposit{value: 10 ether}();
        vm.stopPrank();

        // Try withdrawal - should fail
        vm.startPrank(user1);
        vm.expectRevert(AssetHubVault.ContractPaused.selector);
        vault.withdraw(5 ether);
        vm.stopPrank();

        // Try investment dispatch - should fail
        vm.startPrank(operator);
        vm.expectRevert(AssetHubVault.ContractPaused.selector);
        vault.dispatchInvestment(
            user1,
            CHAIN_ID,
            POOL_ID,
            BASE_ASSET,
            10 ether,
            -1000,
            1000,
            generateDestination(),
            generateXCMMessage()
        );
        vm.stopPrank();
    }

    // ============ Recovery from Pause Tests ============

    function testRecoveryFromPause() public {
        // Setup deposits
        vm.prank(user1);
        vault.deposit{value: 20 ether}();

        // Pause
        vm.prank(deployer);
        vault.pause();

        assertTrue(vault.paused(), "Should be paused");

        // Unpause
        vm.prank(deployer);
        vault.unpause();

        assertFalse(vault.paused(), "Should be unpaused");

        // Verify operations work again
        vm.prank(user1);
        vault.withdraw(5 ether);

        assertEq(vault.getUserBalance(user1), 15 ether, "Withdrawal after unpause failed");
    }

    function testRecoveryAllowsNewDeposits() public {
        vm.prank(deployer);
        vault.pause();

        vm.prank(deployer);
        vault.unpause();

        // Should allow new deposits
        vm.prank(user1);
        vault.deposit{value: 10 ether}();

        assertEq(vault.getUserBalance(user1), 10 ether, "Deposit after recovery failed");
    }

    // ============ Emergency Role Transfer Tests ============

    function testEmergencyRoleTransfer() public {
        address newEmergency = makeAddr("newEmergency");

        vm.prank(deployer); // Admin
        vault.setEmergency(newEmergency);

        assertEq(vault.emergency(), newEmergency, "Emergency role not transferred");

        // Verify old emergency can't act
        vm.prank(user1);
        vault.deposit{value: 20 ether}();

        vm.startPrank(operator);
        vault.dispatchInvestment(
            user1,
            CHAIN_ID,
            POOL_ID,
            BASE_ASSET,
            10 ether,
            -1000,
            1000,
            generateDestination(),
            generateXCMMessage()
        );
        vm.stopPrank();

        bytes32 positionId = vault.getUserPositions(user1)[0];

        vm.startPrank(emergency); // Old emergency
        vm.expectRevert(AssetHubVault.NotEmergency.selector);
        vault.emergencyLiquidatePosition(positionId, user1, 10 ether);
        vm.stopPrank();

        // Verify new emergency can act
        vm.prank(newEmergency);
        vm.deal(address(vault), address(vault).balance + 10 ether);
        vault.emergencyLiquidatePosition(positionId, user1, 10 ether);

        (,,,,,,, bool active) = vault.positions(positionId);
        assertFalse(active, "New emergency should be able to liquidate");
    }

    function testOnlyAdminCanTransferEmergencyRole() public {
        address newEmergency = makeAddr("newEmergency");

        vm.startPrank(user1);
        vm.expectRevert(AssetHubVault.NotAdmin.selector);
        vault.setEmergency(newEmergency);
        vm.stopPrank();
    }

    // ============ Emergency with Active Positions Tests ============

    function testEmergencyWithActivePositions() public {
        // Create multiple positions
        vm.prank(user1);
        vault.deposit{value: 50 ether}();

        vm.startPrank(operator);
        for (uint256 i = 0; i < 3; i++) {
            vault.dispatchInvestment(
                user1,
                CHAIN_ID,
                POOL_ID,
                BASE_ASSET,
                10 ether,
                -1000,
                1000,
                generateDestination(),
                generateXCMMessage()
            );
        }
        vm.stopPrank();

        bytes32[] memory positions = vault.getUserPositions(user1);
        assertEq(positions.length, 3, "Should have 3 positions");

        // Emergency pause
        vm.prank(deployer);
        vault.pause();

        // Emergency liquidate one position
        vm.prank(emergency);
        vm.deal(address(vault), address(vault).balance + 11 ether);
        vault.emergencyLiquidatePosition(positions[0], user1, 11 ether);

        // Verify position liquidated
        (,,,,,,, bool active0) = vault.positions(positions[0]);
        (,,,,,,, bool active1) = vault.positions(positions[1]);
        (,,,,,,, bool active2) = vault.positions(positions[2]);

        assertFalse(active0, "Position 0 should be inactive");
        assertTrue(active1, "Position 1 should still be active");
        assertTrue(active2, "Position 2 should still be active");
    }

    // ============ Emergency Scenario Integration Tests ============

    function testEmergencyScenarioFullRecovery() public {
        // Setup: User has deposited and has active positions
        vm.prank(user1);
        vault.deposit{value: 30 ether}();

        vm.startPrank(operator);
        vault.dispatchInvestment(
            user1,
            CHAIN_ID,
            POOL_ID,
            BASE_ASSET,
            20 ether,
            -1000,
            1000,
            generateDestination(),
            generateXCMMessage()
        );
        vm.stopPrank();

        bytes32 positionId = vault.getUserPositions(user1)[0];

        // Emergency: Contract paused
        vm.prank(deployer);
        vault.pause();

        // Emergency: Position liquidated
        vm.prank(emergency);
        vm.deal(address(vault), address(vault).balance + 22 ether); // Recovered with profit
        vault.emergencyLiquidatePosition(positionId, user1, 22 ether);

        // Recovery: Contract unpaused
        vm.prank(deployer);
        vault.unpause();

        // User can now withdraw
        uint256 expectedBalance = 30 - 20 + 22; // Initial - invested + recovered
        assertEq(vault.getUserBalance(user1), expectedBalance, "Balance after emergency incorrect");

        vm.prank(user1);
        vault.withdraw(expectedBalance);

        assertEq(vault.getUserBalance(user1), 0, "Should be able to withdraw all after emergency");
        assertEq(user1.balance, INITIAL_BALANCE + 2 ether, "User should have profit");
    }

    function testEmergencyDoesNotAffectOtherUsers() public {
        // Multiple users deposit
        vm.prank(user1);
        vault.deposit{value: 20 ether}();

        vm.prank(user2);
        vault.deposit{value: 30 ether}();

        // User1 has position
        vm.startPrank(operator);
        vault.dispatchInvestment(
            user1,
            CHAIN_ID,
            POOL_ID,
            BASE_ASSET,
            15 ether,
            -1000,
            1000,
            generateDestination(),
            generateXCMMessage()
        );
        vm.stopPrank();

        bytes32 positionId = vault.getUserPositions(user1)[0];

        // Emergency liquidate user1's position
        vm.prank(emergency);
        vm.deal(address(vault), address(vault).balance + 16 ether);
        vault.emergencyLiquidatePosition(positionId, user1, 16 ether);

        // Verify user2 unaffected
        assertEq(vault.getUserBalance(user2), 30 ether, "User2 balance should be unchanged");

        // User2 can still withdraw
        vm.prank(user2);
        vault.withdraw(10 ether);

        assertEq(vault.getUserBalance(user2), 20 ether, "User2 should still have access to funds");
    }

    // ============ XCMProxy Emergency Tests ============

    function testProxyEmergencyPause() public {
        vm.prank(deployer);
        proxy.pause();

        assertTrue(proxy.paused(), "Proxy should be paused");

        // Try to execute investment while paused
        bytes32 positionId = keccak256(abi.encodePacked(user1, uint256(1)));
        vm.deal(address(proxy), 10 ether);

        vm.startPrank(operator);
        vm.expectRevert(XCMProxy.ContractPaused.selector);
        proxy.executeInvestment(positionId, user1, POOL_ID, BASE_ASSET, 10 ether, -1000, 1000);
        vm.stopPrank();
    }

    function testProxyRecoveryFromPause() public {
        vm.startPrank(deployer);
        proxy.pause();
        proxy.unpause();
        vm.stopPrank();

        assertFalse(proxy.paused(), "Proxy should be unpaused");

        // Should be able to execute investment
        bytes32 positionId = keccak256(abi.encodePacked(user1, uint256(1)));
        vm.deal(address(proxy), 10 ether);

        vm.prank(operator);
        proxy.executeInvestment(positionId, user1, POOL_ID, BASE_ASSET, 10 ether, -1000, 1000);

        (,,,,,,, bool active) = proxy.positions(positionId);
        assertTrue(active, "Should be able to create position after unpause");
    }
}

