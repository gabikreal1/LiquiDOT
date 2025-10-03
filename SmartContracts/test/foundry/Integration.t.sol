// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "./helpers/TestSetup.sol";

/**
 * @title IntegrationTest
 * @notice Foundry integration tests for AssetHubVault and XCMProxy
 * @dev Tests complete flows across both contracts
 */
contract IntegrationTest is TestSetup {
    AssetHubVault public vault;
    XCMProxy public proxy;

    function setUp() public {
        setupAccounts();
        vault = deployAndConfigureVault();
        proxy = deployAndConfigureProxy();
    }

    // ============ Full Investment Flow Tests ============

    function testFullInvestmentFlow() public {
        uint256 depositAmount = 20 ether;
        uint256 investAmount = 10 ether;

        // Step 1: User deposits to AssetHubVault
        vm.prank(user1);
        vault.deposit{value: depositAmount}();

        assertEq(vault.getUserBalance(user1), depositAmount, "Deposit failed");

        // Step 2: Operator dispatches investment from AssetHubVault
        bytes memory destination = generateDestination();
        bytes memory xcmMessage = generateXCMMessage();
        
        vm.startPrank(operator);
        vault.dispatchInvestment(
            user1,
            CHAIN_ID,
            POOL_ID,
            BASE_ASSET,
            investAmount,
            -1000,
            1000,
            destination,
            xcmMessage
        );

        // Verify balance reduced
        assertEq(vault.getUserBalance(user1), depositAmount - investAmount, "Balance not reduced");

        // Step 3: Simulate XCM arrival - fund proxy and execute investment
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

        // Step 4: Verify position created on XCMProxy
        (
            address storedUser,
            ,
            ,
            uint256 storedAmount,
            ,
            ,
            ,
            bool active
        ) = proxy.positions(positionId);

        assertEq(storedUser, user1, "User mismatch");
        assertEq(storedAmount, investAmount, "Amount mismatch");
        assertTrue(active, "Position should be active");

        // Step 5: Verify positions tracked on both contracts
        bytes32[] memory vaultPositions = vault.getUserPositions(user1);
        bytes32[] memory proxyPositions = proxy.getUserPositions(user1);
        
        assertEq(vaultPositions.length, 1, "Vault should track 1 position");
        assertEq(proxyPositions.length, 1, "Proxy should track 1 position");
        assertEq(vaultPositions[0], proxyPositions[0], "Position IDs should match");
    }

    // ============ Full Liquidation Flow Tests ============

    function testFullLiquidationFlow() public {
        uint256 depositAmount = 20 ether;
        uint256 investAmount = 10 ether;
        uint256 proceeds = 12 ether; // Profit

        // Setup: Create an investment
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

        // Step 1: Liquidate position on XCMProxy
        proxy.liquidatePosition(positionId);

        // Verify position inactive on proxy
        (,,,,,,, bool proxyActive) = proxy.positions(positionId);
        assertFalse(proxyActive, "Position should be inactive on proxy");

        // Step 2: Simulate XCM return of proceeds to vault
        vm.deal(address(vault), address(vault).balance + proceeds);

        // Step 3: Settle liquidation on AssetHubVault
        vault.settleLiquidation(positionId, user1, proceeds);
        vm.stopPrank();

        // Step 4: Verify final balances
        uint256 expectedBalance = depositAmount - investAmount + proceeds;
        assertEq(vault.getUserBalance(user1), expectedBalance, "Final balance incorrect");

        // Step 5: Verify position inactive on vault
        (,,,,,,, bool vaultActive) = vault.positions(positionId);
        assertFalse(vaultActive, "Position should be inactive on vault");
    }

    // ============ Multiple Position Tests ============

    function testMultiplePositions() public {
        uint256 depositAmount = 50 ether;
        
        vm.prank(user1);
        vault.deposit{value: depositAmount}();

        // Create 3 positions
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

        bytes32[] memory vaultPositions = vault.getUserPositions(user1);
        assertEq(vaultPositions.length, 3, "Should have 3 positions");

        // Execute all investments on proxy
        vm.deal(address(proxy), 30 ether);
        for (uint256 i = 0; i < 3; i++) {
            proxy.executeInvestment(
                vaultPositions[i],
                user1,
                POOL_ID,
                BASE_ASSET,
                10 ether,
                -1000,
                1000
            );
        }
        vm.stopPrank();

        bytes32[] memory proxyPositions = proxy.getUserPositions(user1);
        assertEq(proxyPositions.length, 3, "Proxy should have 3 positions");

        // Verify all position IDs match
        for (uint256 i = 0; i < 3; i++) {
            assertEq(vaultPositions[i], proxyPositions[i], "Position ID mismatch");
        }
    }

    // ============ State Consistency Tests ============

    function testStateConsistency() public {
        uint256 depositAmount = 30 ether;
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

        // Verify state consistency across contracts
        (
            address vaultUser,
            address vaultPoolId,
            ,
            uint256 vaultAmount,
            ,
            ,
            ,
            bool vaultActive
        ) = vault.positions(positionId);

        (
            address proxyUser,
            address proxyPoolId,
            ,
            uint256 proxyAmount,
            ,
            ,
            ,
            bool proxyActive
        ) = proxy.positions(positionId);

        assertEq(vaultUser, proxyUser, "User mismatch");
        assertEq(vaultPoolId, proxyPoolId, "Pool ID mismatch");
        assertEq(vaultAmount, proxyAmount, "Amount mismatch");
        assertEq(vaultActive, proxyActive, "Active status mismatch");
    }

    // ============ Error Handling Tests ============

    function testErrorHandlingInsufficientBalance() public {
        vm.prank(user1);
        vault.deposit{value: 5 ether}();

        vm.startPrank(operator);
        vm.expectRevert(AssetHubVault.InsufficientBalance.selector);
        vault.dispatchInvestment(
            user1,
            CHAIN_ID,
            POOL_ID,
            BASE_ASSET,
            10 ether, // More than deposited
            -1000,
            1000,
            generateDestination(),
            generateXCMMessage()
        );
        vm.stopPrank();
    }

    function testErrorHandlingInvalidTickRange() public {
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

        bytes32 positionId = vault.getUserPositions(user1)[0];
        vm.deal(address(proxy), 10 ether);

        vm.expectRevert(XCMProxy.InvalidTickRange.selector);
        proxy.executeInvestment(
            positionId,
            user1,
            POOL_ID,
            BASE_ASSET,
            10 ether,
            1000,  // lower > upper (invalid)
            -1000
        );
        vm.stopPrank();
    }

    // ============ Multi-User Tests ============

    function testMultiUserInvestments() public {
        // User1 deposits and invests
        vm.prank(user1);
        vault.deposit{value: 20 ether}();

        // User2 deposits and invests
        vm.prank(user2);
        vault.deposit{value: 30 ether}();

        vm.startPrank(operator);
        // Dispatch for user1
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

        // Dispatch for user2
        vault.dispatchInvestment(
            user2,
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

        // Verify balances
        assertEq(vault.getUserBalance(user1), 10 ether, "User1 balance incorrect");
        assertEq(vault.getUserBalance(user2), 15 ether, "User2 balance incorrect");

        // Verify positions
        assertEq(vault.getUserPositions(user1).length, 1, "User1 positions incorrect");
        assertEq(vault.getUserPositions(user2).length, 1, "User2 positions incorrect");
    }

    // ============ Partial Liquidation Test ============

    function testPartialPositionLiquidation() public {
        uint256 depositAmount = 50 ether;
        
        vm.prank(user1);
        vault.deposit{value: depositAmount}();

        // Create 2 positions
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

        vault.dispatchInvestment(
            user1,
            CHAIN_ID,
            POOL_ID,
            BASE_ASSET,
            15 ether,
            -500,
            500,
            generateDestination(),
            generateXCMMessage()
        );

        bytes32[] memory positions = vault.getUserPositions(user1);
        bytes32 positionId1 = positions[0];
        bytes32 positionId2 = positions[1];

        vm.deal(address(proxy), 25 ether);

        proxy.executeInvestment(positionId1, user1, POOL_ID, BASE_ASSET, 10 ether, -1000, 1000);
        proxy.executeInvestment(positionId2, user1, POOL_ID, BASE_ASSET, 15 ether, -500, 500);

        // Liquidate only first position
        proxy.liquidatePosition(positionId1);
        
        vm.deal(address(vault), address(vault).balance + 11 ether);
        vault.settleLiquidation(positionId1, user1, 11 ether);
        vm.stopPrank();

        // Verify first position inactive, second still active
        (,,,,,,, bool active1) = vault.positions(positionId1);
        (,,,,,,, bool active2) = vault.positions(positionId2);

        assertFalse(active1, "Position 1 should be inactive");
        assertTrue(active2, "Position 2 should still be active");

        // Verify balance updated correctly
        uint256 expectedBalance = depositAmount - 10 ether - 15 ether + 11 ether;
        assertEq(vault.getUserBalance(user1), expectedBalance, "Balance incorrect");
    }
}

