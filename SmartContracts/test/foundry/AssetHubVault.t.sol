// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "../TestBase.sol";
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
        vm.expectRevert(AssetHubVault.InsufficientBalance.selector);
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

        bytes32 positionId = keccak256(abi.encodePacked(USER, MOONBEAM, POOL, BASE_ASSET, uint64(block.timestamp)));
        (
            address storedUser,
            address storedPool,
            address,
            uint32,
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
        vm.expectRevert(AssetHubVault.Paused.selector);
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
        bytes32 positionId = keccak256(abi.encodePacked(USER, MOONBEAM, POOL, BASE_ASSET, uint64(block.timestamp)));

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
        bytes32 positionId = keccak256(abi.encodePacked(USER, MOONBEAM, POOL, BASE_ASSET, uint64(block.timestamp)));

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
}
