// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "./TestBase.sol";
import "../../contracts/V1(Current)/AssetHubVault.sol";

contract AssetHubVaultTest is TestBase {
    AssetHubVault private vault;
    address private constant OPERATOR = address(0xBEEF);
    address private constant USER = address(0xCAFE);
    uint32 private constant MOONBEAM = 1000;
    address private constant POOL = address(0x1234);
    address private constant BASE_ASSET = address(0x9999);

    function setUp() public {
        vault = new AssetHubVault();
        vault.setOperator(OPERATOR);
        vault.setTestMode(true);
        vault.setXcmPrecompile(address(0xdead));
        vault.addChain(MOONBEAM, hex"0102", "Moonbeam", address(0));
    }

    function testDepositUpdatesBalance() public {
        vm.deal(USER, 1 ether);
        vm.prank(USER);
        vault.deposit{value: 1 ether}();
        assertEq(vault.userBalances(USER), 1 ether, "deposit balance");
    }

    function testWithdrawReducesBalance() public {
        vm.deal(USER, 2 ether);
        vm.prank(USER);
        vault.deposit{value: 1 ether}();

        vm.prank(USER);
        vault.withdraw(0.4 ether);

        assertEq(vault.userBalances(USER), 0.6 ether, "withdraw balance");
    }

    function testWithdrawInsufficientBalanceReverts() public {
        vm.deal(USER, 1 ether);
        vm.prank(USER);
        vault.deposit{value: 0.2 ether}();

        vm.prank(USER);
        vm.expectRevert();
        vault.withdraw(0.3 ether);
    }

    function testDispatchInvestmentCreatesPendingPosition() public {
        uint256 amount = 1 ether;
        vm.deal(USER, amount);
        vm.prank(USER);
        vault.deposit{value: amount}();

        vm.warp(1000);
        bytes memory destination = hex"0102";
        bytes memory message = hex"030405";

        vm.prank(OPERATOR);
        vault.dispatchInvestment(
            USER,
            MOONBEAM,
            POOL,
            BASE_ASSET,
            amount,
            -50,
            50,
            destination,
            message
        );

        bytes32 positionId = keccak256(abi.encodePacked(USER, MOONBEAM, POOL, BASE_ASSET, block.timestamp));
        (
            address storedUser,
            address storedPool,
            ,
            ,
            int24 lowerRange,
            ,
            uint64 storedTimestamp,
            AssetHubVault.PositionStatus status,
            ,
            
        ) = vault.positions(positionId);

        assertEq(storedUser, USER, "position user");
        assertEq(storedPool, POOL, "position pool");
        assertEq(int256(lowerRange), int256(-50), "lower range");
        assertEq(uint256(storedTimestamp), block.timestamp, "position timestamp");
        assertEq(uint256(status), uint256(AssetHubVault.PositionStatus.PendingExecution), "status pending");
        assertEq(vault.userBalances(USER), 0, "balance deducted");
    }

    function testDispatchWhenPausedReverts() public {
        vault.pause();

        vm.deal(USER, 1 ether);
        vm.prank(USER);
        vault.deposit{value: 1 ether}();

        vm.prank(OPERATOR);
        vm.expectRevert();
        vault.dispatchInvestment(USER, MOONBEAM, POOL, BASE_ASSET, 1 ether, -50, 50, hex"01", hex"02");
    }

    function testConfirmExecutionActivatesPosition() public {
        uint256 amount = 1 ether;
        vm.deal(USER, amount);
        vm.prank(USER);
        vault.deposit{value: amount}();

        vm.warp(42);
        vm.prank(OPERATOR);
        vault.dispatchInvestment(USER, MOONBEAM, POOL, BASE_ASSET, amount, -50, 50, hex"01", hex"02");
        bytes32 positionId = keccak256(abi.encodePacked(USER, MOONBEAM, POOL, BASE_ASSET, block.timestamp));

        vm.prank(OPERATOR);
        vault.confirmExecution(positionId, bytes32(uint256(777)), 123);

        (
            ,
            ,
            ,
            ,
            ,
            ,
            uint64 storedTimestamp,
            AssetHubVault.PositionStatus status,
            ,
            bytes32 remoteId
        ) = vault.positions(positionId);

        assertEq(uint256(status), uint256(AssetHubVault.PositionStatus.Active), "status active");
        assertEq(uint256(remoteId), uint256(777), "remote id");
        assertEq(uint256(storedTimestamp), block.timestamp, "timestamp unchanged");
    }

    function testSettleLiquidationCreditsUser() public {
        uint256 amount = 2 ether;
        vm.deal(USER, amount);
        vm.prank(USER);
        vault.deposit{value: amount}();

        vm.warp(77);
        vm.prank(OPERATOR);
        vault.dispatchInvestment(USER, MOONBEAM, POOL, BASE_ASSET, amount, -50, 50, hex"01", hex"02");
        bytes32 positionId = keccak256(abi.encodePacked(USER, MOONBEAM, POOL, BASE_ASSET, block.timestamp));

        vm.prank(OPERATOR);
        vault.confirmExecution(positionId, bytes32(uint256(1)), 999);

        vm.deal(address(vault), 5 ether);

        vm.prank(OPERATOR);
        vault.settleLiquidation(positionId, 1.5 ether);

        (
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            AssetHubVault.PositionStatus status,
            ,
            
        ) = vault.positions(positionId);
        assertEq(uint256(status), uint256(AssetHubVault.PositionStatus.Liquidated), "status liquidated");
        assertEq(vault.userBalances(USER), 1.5 ether, "user credited");
    }

    // ============ Authorization & Access Control Tests ============
    
    function testDispatchInvestmentOnlyOperator() public {
        vm.deal(USER, 1 ether);
        vm.prank(USER);
        vault.deposit{value: 1 ether}();

        vm.prank(USER); // Not the operator
        vm.expectRevert();
        vault.dispatchInvestment(USER, MOONBEAM, POOL, BASE_ASSET, 1 ether, -50, 50, hex"01", hex"02");
    }

    function testConfirmExecutionOnlyOperator() public {
        uint256 amount = 1 ether;
        vm.deal(USER, amount);
        vm.prank(USER);
        vault.deposit{value: amount}();

        vm.prank(OPERATOR);
        vault.dispatchInvestment(USER, MOONBEAM, POOL, BASE_ASSET, amount, -50, 50, hex"01", hex"02");
        bytes32 positionId = keccak256(abi.encodePacked(USER, MOONBEAM, POOL, BASE_ASSET, block.timestamp));

        vm.prank(USER); // Not the operator
        vm.expectRevert();
        vault.confirmExecution(positionId, bytes32(0), 0);
    }

    function testSettleLiquidationOnlyOperator() public {
        uint256 amount = 1 ether;
        vm.deal(USER, amount);
        vm.prank(USER);
        vault.deposit{value: amount}();

        vm.prank(OPERATOR);
        vault.dispatchInvestment(USER, MOONBEAM, POOL, BASE_ASSET, amount, -50, 50, hex"01", hex"02");
        bytes32 positionId = keccak256(abi.encodePacked(USER, MOONBEAM, POOL, BASE_ASSET, block.timestamp));

        vm.prank(OPERATOR);
        vault.confirmExecution(positionId, bytes32(0), 0);

        vm.prank(USER); // Not the operator
        vm.expectRevert();
        vault.settleLiquidation(positionId, 0.5 ether);
    }

    // ============ Input Validation Tests ============

    function testDispatchInvestmentZeroAddress() public {
        vm.prank(OPERATOR);
        vm.expectRevert();
        vault.dispatchInvestment(address(0), MOONBEAM, POOL, BASE_ASSET, 1 ether, -50, 50, hex"01", hex"02");
    }

    function testDispatchInvestmentZeroAmount() public {
        vm.prank(OPERATOR);
        vm.expectRevert();
        vault.dispatchInvestment(USER, MOONBEAM, POOL, BASE_ASSET, 0, -50, 50, hex"01", hex"02");
    }

    function testDispatchInvestmentInvalidRange() public {
        vm.deal(USER, 1 ether);
        vm.prank(USER);
        vault.deposit{value: 1 ether}();

        vm.prank(OPERATOR);
        vm.expectRevert();
        vault.dispatchInvestment(USER, MOONBEAM, POOL, BASE_ASSET, 1 ether, 50, -50, hex"01", hex"02"); // upper < lower
    }

    function testDispatchInvestmentUnsupportedChain() public {
        vm.deal(USER, 1 ether);
        vm.prank(USER);
        vault.deposit{value: 1 ether}();

        vm.prank(OPERATOR);
        vm.expectRevert();
        vault.dispatchInvestment(USER, 9999, POOL, BASE_ASSET, 1 ether, -50, 50, hex"01", hex"02");
    }

    // ============ Multiple Deposits & Withdrawals ============

    function testMultipleDeposits() public {
        vm.deal(USER, 5 ether);

        vm.prank(USER);
        vault.deposit{value: 1 ether}();
        assertEq(vault.userBalances(USER), 1 ether, "first deposit");

        vm.prank(USER);
        vault.deposit{value: 2 ether}();
        assertEq(vault.userBalances(USER), 3 ether, "second deposit");

        vm.prank(USER);
        vault.deposit{value: 1.5 ether}();
        assertEq(vault.userBalances(USER), 4.5 ether, "third deposit");
    }

    function testMultipleUsers() public {
        address user2 = address(0xDEAD);
        address user3 = address(0xBEEE);

        vm.deal(USER, 1 ether);
        vm.deal(user2, 2 ether);
        vm.deal(user3, 3 ether);

        vm.prank(USER);
        vault.deposit{value: 1 ether}();

        vm.prank(user2);
        vault.deposit{value: 2 ether}();

        vm.prank(user3);
        vault.deposit{value: 3 ether}();

        assertEq(vault.userBalances(USER), 1 ether, "user1 balance");
        assertEq(vault.userBalances(user2), 2 ether, "user2 balance");
        assertEq(vault.userBalances(user3), 3 ether, "user3 balance");
    }

    // ============ Position Lifecycle Tests ============

    function testDispatchMultiplePositions() public {
        uint256 amount = 1 ether;
        vm.deal(USER, 3 ether);
        vm.prank(USER);
        vault.deposit{value: 3 ether}();

        // Create first position
        vm.warp(100);
        vm.prank(OPERATOR);
        vault.dispatchInvestment(USER, MOONBEAM, POOL, BASE_ASSET, amount, -50, 50, hex"01", hex"02");
        bytes32 positionId1 = keccak256(abi.encodePacked(USER, MOONBEAM, POOL, BASE_ASSET, block.timestamp));

        // Create second position with different pool
        address pool2 = address(0x5678);
        vm.warp(200);
        vm.prank(OPERATOR);
        vault.dispatchInvestment(USER, MOONBEAM, pool2, BASE_ASSET, amount, -60, 60, hex"01", hex"02");
        bytes32 positionId2 = keccak256(abi.encodePacked(USER, MOONBEAM, pool2, BASE_ASSET, block.timestamp));

        // Verify both positions exist
        (address user1,,,,,,,,,) = vault.positions(positionId1);
        (address user2,,,,,,,,,) = vault.positions(positionId2);
        assertEq(user1, USER, "position 1 user");
        assertEq(user2, USER, "position 2 user");
    }

    // ============ Edge Cases & Boundary Tests ============

    function testWithdrawExactBalance() public {
        vm.deal(USER, 1 ether);
        vm.prank(USER);
        vault.deposit{value: 1 ether}();

        vm.prank(USER);
        vault.withdraw(1 ether);

        assertEq(vault.userBalances(USER), 0, "balance is zero");
    }

    function testDepositSmallAmount() public {
        vm.deal(USER, 1 wei);
        vm.prank(USER);
        vault.deposit{value: 1 wei}();
        assertEq(vault.userBalances(USER), 1 wei, "small deposit");
    }

    function testDispatchInvestmentLargeAmount() public {
        uint256 largeAmount = 1000 ether;
        vm.deal(USER, largeAmount);
        vm.prank(USER);
        vault.deposit{value: largeAmount}();

        vm.prank(OPERATOR);
        vault.dispatchInvestment(USER, MOONBEAM, POOL, BASE_ASSET, largeAmount, -50, 50, hex"01", hex"02");

        assertEq(vault.userBalances(USER), 0, "full amount dispatched");
    }

    function testDispatchWithNegativeRanges() public {
        vm.deal(USER, 1 ether);
        vm.prank(USER);
        vault.deposit{value: 1 ether}();

        vm.prank(OPERATOR);
        vault.dispatchInvestment(USER, MOONBEAM, POOL, BASE_ASSET, 1 ether, -1000, -500, hex"01", hex"02");

        bytes32 positionId = keccak256(abi.encodePacked(USER, MOONBEAM, POOL, BASE_ASSET, block.timestamp));
        (,,,, int24 lower, int24 upper,,,,) = vault.positions(positionId);
        assertEq(int256(lower), int256(-1000), "negative lower range");
        assertEq(int256(upper), int256(-500), "negative upper range");
    }

    function testDispatchWithPositiveRanges() public {
        vm.deal(USER, 1 ether);
        vm.prank(USER);
        vault.deposit{value: 1 ether}();

        vm.prank(OPERATOR);
        vault.dispatchInvestment(USER, MOONBEAM, POOL, BASE_ASSET, 1 ether, 100, 500, hex"01", hex"02");

        bytes32 positionId = keccak256(abi.encodePacked(USER, MOONBEAM, POOL, BASE_ASSET, block.timestamp));
        (,,,, int24 lower, int24 upper,,,,) = vault.positions(positionId);
        assertEq(int256(lower), int256(100), "positive lower range");
        assertEq(int256(upper), int256(500), "positive upper range");
    }

    // ============ State Management Tests ============

    function testPauseUnpauseCycle() public {
        vm.deal(USER, 1 ether);
        vm.prank(USER);
        vault.deposit{value: 1 ether}();

        vault.pause();
        
        vm.prank(OPERATOR);
        vm.expectRevert();
        vault.dispatchInvestment(USER, MOONBEAM, POOL, BASE_ASSET, 1 ether, -50, 50, hex"01", hex"02");

        vault.unpause();

        vm.prank(OPERATOR);
        vault.dispatchInvestment(USER, MOONBEAM, POOL, BASE_ASSET, 1 ether, -50, 50, hex"01", hex"02");
        // Should succeed after unpause
    }

    function testChainManagement() public {
        uint32 newChain = 2000;
        assertFalse(vault.isChainSupported(newChain), "new chain not supported initially");

        vault.addChain(newChain, hex"0304", "TestChain", address(0x1111));
        assertTrue(vault.isChainSupported(newChain), "new chain now supported");

        vault.removeChain(newChain);
        assertFalse(vault.isChainSupported(newChain), "chain removed");
    }
}
