// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "./helpers/TestSetup.sol";

/**
 * @title AssetHubVaultTest
 * @notice Foundry tests for AssetHubVault contract
 * @dev Covers deployment, deposits, withdrawals, investment dispatch, and access control
 */
contract AssetHubVaultTest is TestSetup {
    AssetHubVault public vault;

    function setUp() public {
        setupAccounts();
        vault = deployAndConfigureVault();
    }

    // ============ Deployment Tests ============

    function testDeployment() public {
        assertEq(vault.admin(), deployer, "Admin should be deployer");
        assertEq(vault.operator(), operator, "Operator should be set");
        assertEq(vault.emergency(), emergency, "Emergency should be set");
        assertTrue(vault.testMode(), "Test mode should be enabled");
    }

    function testInitialState() public {
        assertFalse(vault.paused(), "Contract should not be paused initially");
        assertEq(address(vault).balance, 0, "Initial balance should be zero");
    }

    // ============ Deposit Tests ============

    function testDeposit() public {
        uint256 depositAmount = 10 ether;
        
        vm.startPrank(user1);
        vault.deposit{value: depositAmount}();
        vm.stopPrank();

        assertEq(vault.getUserBalance(user1), depositAmount, "User balance should equal deposit");
        assertEq(address(vault).balance, depositAmount, "Vault balance should equal deposit");
    }

    function testDepositEmitsEvent() public {
        uint256 depositAmount = 5 ether;
        
        vm.startPrank(user1);
        vm.expectEmit(true, false, false, true);
        emit AssetHubVault.Deposit(user1, depositAmount);
        vault.deposit{value: depositAmount}();
        vm.stopPrank();
    }

    function testDepositZeroReverts() public {
        vm.startPrank(user1);
        vm.expectRevert(AssetHubVault.AmountZero.selector);
        vault.deposit{value: 0}();
        vm.stopPrank();
    }

    function testMultipleDeposits() public {
        uint256 firstDeposit = 10 ether;
        uint256 secondDeposit = 5 ether;
        
        vm.startPrank(user1);
        vault.deposit{value: firstDeposit}();
        vault.deposit{value: secondDeposit}();
        vm.stopPrank();

        assertEq(vault.getUserBalance(user1), firstDeposit + secondDeposit, "Balance should be sum of deposits");
    }

    function testDepositFromMultipleUsers() public {
        uint256 amount1 = 10 ether;
        uint256 amount2 = 20 ether;
        
        vm.prank(user1);
        vault.deposit{value: amount1}();
        
        vm.prank(user2);
        vault.deposit{value: amount2}();

        assertEq(vault.getUserBalance(user1), amount1, "User1 balance incorrect");
        assertEq(vault.getUserBalance(user2), amount2, "User2 balance incorrect");
        assertEq(address(vault).balance, amount1 + amount2, "Vault balance incorrect");
    }

    // ============ Withdrawal Tests ============

    function testWithdraw() public {
        uint256 depositAmount = 10 ether;
        uint256 withdrawAmount = 6 ether;
        
        vm.startPrank(user1);
        vault.deposit{value: depositAmount}();
        
        uint256 balanceBefore = user1.balance;
        vault.withdraw(withdrawAmount);
        vm.stopPrank();

        assertEq(vault.getUserBalance(user1), depositAmount - withdrawAmount, "User balance incorrect after withdraw");
        assertEq(user1.balance, balanceBefore + withdrawAmount, "ETH not received");
    }

    function testWithdrawEmitsEvent() public {
        uint256 depositAmount = 10 ether;
        uint256 withdrawAmount = 5 ether;
        
        vm.startPrank(user1);
        vault.deposit{value: depositAmount}();
        
        vm.expectEmit(true, false, false, true);
        emit AssetHubVault.Withdraw(user1, withdrawAmount);
        vault.withdraw(withdrawAmount);
        vm.stopPrank();
    }

    function testWithdrawInsufficientBalance() public {
        uint256 depositAmount = 5 ether;
        uint256 withdrawAmount = 10 ether;
        
        vm.startPrank(user1);
        vault.deposit{value: depositAmount}();
        
        vm.expectRevert(AssetHubVault.InsufficientBalance.selector);
        vault.withdraw(withdrawAmount);
        vm.stopPrank();
    }

    function testWithdrawZeroReverts() public {
        vm.startPrank(user1);
        vault.deposit{value: 10 ether}();
        
        vm.expectRevert(AssetHubVault.AmountZero.selector);
        vault.withdraw(0);
        vm.stopPrank();
    }

    function testWithdrawFullBalance() public {
        uint256 depositAmount = 10 ether;
        
        vm.startPrank(user1);
        vault.deposit{value: depositAmount}();
        vault.withdraw(depositAmount);
        vm.stopPrank();

        assertEq(vault.getUserBalance(user1), 0, "Balance should be zero after full withdrawal");
    }

    // ============ Investment Dispatch Tests ============

    function testDispatchInvestment() public {
        // User deposits first
        uint256 depositAmount = 10 ether;
        vm.prank(user1);
        vault.deposit{value: depositAmount}();

        // Operator dispatches investment
        uint256 investAmount = 5 ether;
        bytes memory destination = generateDestination();
        bytes memory xcmMessage = generateXCMMessage();
        
        vm.startPrank(operator);
        vault.dispatchInvestment(
            user1,
            CHAIN_ID,
            POOL_ID,
            BASE_ASSET,
            investAmount,
            -1000, // lowerRange
            1000,  // upperRange
            destination,
            xcmMessage
        );
        vm.stopPrank();

        assertEq(vault.getUserBalance(user1), depositAmount - investAmount, "Balance not reduced after investment");
    }

    function testDispatchInvestmentReducesBalance() public {
        uint256 depositAmount = 20 ether;
        uint256 investAmount = 15 ether;
        
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
        vm.stopPrank();

        assertEq(vault.getUserBalance(user1), depositAmount - investAmount, "Balance reduction incorrect");
    }

    function testDispatchInvestmentNonOperatorReverts() public {
        vm.prank(user1);
        vault.deposit{value: 10 ether}();

        vm.startPrank(user2); // Not operator
        vm.expectRevert(AssetHubVault.NotOperator.selector);
        vault.dispatchInvestment(
            user1,
            CHAIN_ID,
            POOL_ID,
            BASE_ASSET,
            5 ether,
            -1000,
            1000,
            generateDestination(),
            generateXCMMessage()
        );
        vm.stopPrank();
    }

    function testDispatchInvestmentInsufficientBalance() public {
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

    function testDispatchInvestmentZeroAmountReverts() public {
        vm.prank(user1);
        vault.deposit{value: 10 ether}();

        vm.startPrank(operator);
        vm.expectRevert(AssetHubVault.AmountZero.selector);
        vault.dispatchInvestment(
            user1,
            CHAIN_ID,
            POOL_ID,
            BASE_ASSET,
            0,
            -1000,
            1000,
            generateDestination(),
            generateXCMMessage()
        );
        vm.stopPrank();
    }

    // ============ Liquidation Settlement Tests ============

    function testSettleLiquidation() public {
        // First create a position
        vm.prank(user1);
        vault.deposit{value: 10 ether}();

        vm.startPrank(operator);
        vault.dispatchInvestment(
            user1,
            CHAIN_ID,
            POOL_ID,
            BASE_ASSET,
            5 ether,
            -1000,
            1000,
            generateDestination(),
            generateXCMMessage()
        );

        // Get the position ID (would need to get from event or state)
        bytes32[] memory positions = vault.getUserPositions(user1);
        bytes32 positionId = positions[0];

        // Settle liquidation
        uint256 proceeds = 6 ether; // More than invested (profit)
        vm.deal(address(vault), address(vault).balance + proceeds); // Simulate receiving proceeds
        
        vault.settleLiquidation(positionId, user1, proceeds);
        vm.stopPrank();

        assertEq(vault.getUserBalance(user1), 5 ether + proceeds, "Balance should include proceeds");
    }

    function testSettleLiquidationIncreasesBalance() public {
        vm.prank(user1);
        vault.deposit{value: 10 ether}();

        vm.startPrank(operator);
        vault.dispatchInvestment(
            user1,
            CHAIN_ID,
            POOL_ID,
            BASE_ASSET,
            5 ether,
            -1000,
            1000,
            generateDestination(),
            generateXCMMessage()
        );

        bytes32[] memory positions = vault.getUserPositions(user1);
        bytes32 positionId = positions[0];

        uint256 balanceBefore = vault.getUserBalance(user1);
        uint256 proceeds = 7 ether;
        vm.deal(address(vault), address(vault).balance + proceeds);
        
        vault.settleLiquidation(positionId, user1, proceeds);
        vm.stopPrank();

        assertEq(vault.getUserBalance(user1), balanceBefore + proceeds, "Balance increase incorrect");
    }

    function testSettleLiquidationInactiveReverts() public {
        bytes32 fakePositionId = keccak256("fake");

        vm.startPrank(operator);
        vm.expectRevert(AssetHubVault.PositionNotActive.selector);
        vault.settleLiquidation(fakePositionId, user1, 5 ether);
        vm.stopPrank();
    }

    // ============ Pause/Unpause Tests ============

    function testPause() public {
        vm.prank(deployer); // Admin
        vault.pause();

        assertTrue(vault.paused(), "Contract should be paused");
    }

    function testPauseBlocksDeposit() public {
        vm.prank(deployer);
        vault.pause();

        vm.startPrank(user1);
        vm.expectRevert(AssetHubVault.ContractPaused.selector);
        vault.deposit{value: 5 ether}();
        vm.stopPrank();
    }

    function testUnpause() public {
        vm.startPrank(deployer);
        vault.pause();
        vault.unpause();
        vm.stopPrank();

        assertFalse(vault.paused(), "Contract should be unpaused");
    }

    function testPauseNonAdminReverts() public {
        vm.startPrank(user1);
        vm.expectRevert(AssetHubVault.NotAdmin.selector);
        vault.pause();
        vm.stopPrank();
    }

    // ============ Access Control Tests ============

    function testOnlyOperatorCanDispatch() public {
        vm.prank(user1);
        vault.deposit{value: 10 ether}();

        vm.startPrank(user1);
        vm.expectRevert(AssetHubVault.NotOperator.selector);
        vault.dispatchInvestment(
            user1,
            CHAIN_ID,
            POOL_ID,
            BASE_ASSET,
            5 ether,
            -1000,
            1000,
            generateDestination(),
            generateXCMMessage()
        );
        vm.stopPrank();
    }

    function testOnlyAdminCanSetOperator() public {
        address newOperator = makeAddr("newOperator");

        vm.startPrank(user1);
        vm.expectRevert(AssetHubVault.NotAdmin.selector);
        vault.setOperator(newOperator);
        vm.stopPrank();
    }

    function testAdminCanTransferRole() public {
        address newAdmin = makeAddr("newAdmin");

        vm.prank(deployer);
        vault.transferAdmin(newAdmin);

        assertEq(vault.admin(), newAdmin, "Admin should be transferred");
    }

    function testTransferAdminNonAdminReverts() public {
        address newAdmin = makeAddr("newAdmin");

        vm.startPrank(user1);
        vm.expectRevert(AssetHubVault.NotAdmin.selector);
        vault.transferAdmin(newAdmin);
        vm.stopPrank();
    }

    // ============ View Function Tests ============

    function testGetUserBalance() public {
        vm.prank(user1);
        vault.deposit{value: 10 ether}();

        assertEq(vault.getUserBalance(user1), 10 ether, "Balance query incorrect");
    }

    function testGetUserPositions() public {
        vm.prank(user1);
        vault.deposit{value: 10 ether}();

        vm.startPrank(operator);
        vault.dispatchInvestment(
            user1,
            CHAIN_ID,
            POOL_ID,
            BASE_ASSET,
            5 ether,
            -1000,
            1000,
            generateDestination(),
            generateXCMMessage()
        );
        vm.stopPrank();

        bytes32[] memory positions = vault.getUserPositions(user1);
        assertEq(positions.length, 1, "Should have 1 position");
    }
}

