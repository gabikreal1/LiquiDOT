// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "./helpers/TestSetup.sol";

/**
 * @title XCMProxyTest
 * @notice Foundry tests for XCMProxy contract
 * @dev Covers deployment, investment execution, liquidation, and access control
 */
contract XCMProxyTest is TestSetup {
    XCMProxy public proxy;

    function setUp() public {
        setupAccounts();
        proxy = deployAndConfigureProxy();
    }

    // ============ Deployment Tests ============

    function testDeployment() public {
        assertEq(proxy.owner(), deployer, "Owner should be deployer");
        assertEq(proxy.operator(), operator, "Operator should be set");
        assertTrue(proxy.testMode(), "Test mode should be enabled");
    }

    function testInitialState() public {
        assertFalse(proxy.paused(), "Contract should not be paused initially");
    }

    // ============ Execute Investment Tests ============

    function testExecuteInvestment() public {
        uint256 investAmount = 10 ether;
        bytes32 positionId = keccak256(abi.encodePacked(user1, block.timestamp));
        
        // Fund the proxy (simulates XCM asset transfer)
        vm.deal(address(proxy), investAmount);

        vm.startPrank(operator);
        proxy.executeInvestment(
            positionId,
            user1,
            POOL_ID,
            BASE_ASSET,
            investAmount,
            -1000, // lowerRange
            1000   // upperRange
        );
        vm.stopPrank();

        // Verify position was created
        (
            address storedUser,
            address storedPoolId,
            ,
            uint256 storedAmount,
            ,
            ,
            ,
            bool active
        ) = proxy.positions(positionId);

        assertEq(storedUser, user1, "User mismatch");
        assertEq(storedPoolId, POOL_ID, "Pool ID mismatch");
        assertEq(storedAmount, investAmount, "Amount mismatch");
        assertTrue(active, "Position should be active");
    }

    function testExecuteInvestmentCreatesPosition() public {
        uint256 investAmount = 5 ether;
        bytes32 positionId = keccak256(abi.encodePacked(user1, uint256(1)));
        
        vm.deal(address(proxy), investAmount);

        vm.startPrank(operator);
        proxy.executeInvestment(
            positionId,
            user1,
            POOL_ID,
            BASE_ASSET,
            investAmount,
            -500,
            500
        );
        vm.stopPrank();

        bytes32[] memory userPositions = proxy.getUserPositions(user1);
        assertEq(userPositions.length, 1, "Should have 1 position");
        assertEq(userPositions[0], positionId, "Position ID mismatch");
    }

    function testExecuteInvestmentEmitsEvent() public {
        uint256 investAmount = 10 ether;
        bytes32 positionId = keccak256(abi.encodePacked(user1, uint256(1)));
        
        vm.deal(address(proxy), investAmount);

        vm.startPrank(operator);
        vm.expectEmit(true, true, true, true);
        emit XCMProxy.InvestmentExecuted(positionId, user1, POOL_ID, investAmount);
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
    }

    function testExecuteInvestmentZeroAmountReverts() public {
        bytes32 positionId = keccak256(abi.encodePacked(user1, uint256(1)));

        vm.startPrank(operator);
        vm.expectRevert(XCMProxy.AmountZero.selector);
        proxy.executeInvestment(
            positionId,
            user1,
            POOL_ID,
            BASE_ASSET,
            0,
            -1000,
            1000
        );
        vm.stopPrank();
    }

    function testExecuteInvestmentInvalidRangeReverts() public {
        uint256 investAmount = 10 ether;
        bytes32 positionId = keccak256(abi.encodePacked(user1, uint256(1)));
        
        vm.deal(address(proxy), investAmount);

        vm.startPrank(operator);
        vm.expectRevert(XCMProxy.InvalidTickRange.selector);
        proxy.executeInvestment(
            positionId,
            user1,
            POOL_ID,
            BASE_ASSET,
            investAmount,
            1000,  // lower > upper (invalid)
            -1000
        );
        vm.stopPrank();
    }

    function testExecuteInvestmentNonOperatorReverts() public {
        uint256 investAmount = 10 ether;
        bytes32 positionId = keccak256(abi.encodePacked(user1, uint256(1)));
        
        vm.deal(address(proxy), investAmount);

        vm.startPrank(user1); // Not operator
        vm.expectRevert(XCMProxy.NotOperator.selector);
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
    }

    // ============ Liquidate Position Tests ============

    function testLiquidatePosition() public {
        // Create a position first
        uint256 investAmount = 10 ether;
        bytes32 positionId = keccak256(abi.encodePacked(user1, uint256(1)));
        
        vm.deal(address(proxy), investAmount);

        vm.startPrank(operator);
        proxy.executeInvestment(
            positionId,
            user1,
            POOL_ID,
            BASE_ASSET,
            investAmount,
            -1000,
            1000
        );

        // Liquidate the position
        proxy.liquidatePosition(positionId);
        vm.stopPrank();

        // Verify position is inactive
        (,,,,,,, bool active) = proxy.positions(positionId);
        assertFalse(active, "Position should be inactive after liquidation");
    }

    function testLiquidatePositionMarksInactive() public {
        uint256 investAmount = 5 ether;
        bytes32 positionId = keccak256(abi.encodePacked(user1, uint256(1)));
        
        vm.deal(address(proxy), investAmount);

        vm.startPrank(operator);
        proxy.executeInvestment(
            positionId,
            user1,
            POOL_ID,
            BASE_ASSET,
            investAmount,
            -500,
            500
        );

        proxy.liquidatePosition(positionId);
        vm.stopPrank();

        (,,,,,,, bool active) = proxy.positions(positionId);
        assertFalse(active, "Position should be marked inactive");
    }

    function testLiquidateInactivePositionReverts() public {
        uint256 investAmount = 10 ether;
        bytes32 positionId = keccak256(abi.encodePacked(user1, uint256(1)));
        
        vm.deal(address(proxy), investAmount);

        vm.startPrank(operator);
        proxy.executeInvestment(
            positionId,
            user1,
            POOL_ID,
            BASE_ASSET,
            investAmount,
            -1000,
            1000
        );

        // Liquidate once
        proxy.liquidatePosition(positionId);

        // Try to liquidate again
        vm.expectRevert(XCMProxy.PositionNotActive.selector);
        proxy.liquidatePosition(positionId);
        vm.stopPrank();
    }

    function testLiquidateNonexistentPositionReverts() public {
        bytes32 fakePositionId = keccak256("fake");

        vm.startPrank(operator);
        vm.expectRevert(XCMProxy.PositionNotActive.selector);
        proxy.liquidatePosition(fakePositionId);
        vm.stopPrank();
    }

    // ============ Collect Fees Tests ============

    function testCollectFees() public {
        // Create a position first
        uint256 investAmount = 10 ether;
        bytes32 positionId = keccak256(abi.encodePacked(user1, uint256(1)));
        
        vm.deal(address(proxy), investAmount);

        vm.startPrank(operator);
        proxy.executeInvestment(
            positionId,
            user1,
            POOL_ID,
            BASE_ASSET,
            investAmount,
            -1000,
            1000
        );

        // In test mode, collectFees should work (mock)
        proxy.collectFees(positionId);
        vm.stopPrank();
    }

    function testCollectFeesInactiveReverts() public {
        uint256 investAmount = 10 ether;
        bytes32 positionId = keccak256(abi.encodePacked(user1, uint256(1)));
        
        vm.deal(address(proxy), investAmount);

        vm.startPrank(operator);
        proxy.executeInvestment(
            positionId,
            user1,
            POOL_ID,
            BASE_ASSET,
            investAmount,
            -1000,
            1000
        );

        // Liquidate position
        proxy.liquidatePosition(positionId);

        // Try to collect fees on inactive position
        vm.expectRevert(XCMProxy.PositionNotActive.selector);
        proxy.collectFees(positionId);
        vm.stopPrank();
    }

    // ============ View Function Tests ============

    function testGetPosition() public {
        uint256 investAmount = 10 ether;
        bytes32 positionId = keccak256(abi.encodePacked(user1, uint256(1)));
        
        vm.deal(address(proxy), investAmount);

        vm.startPrank(operator);
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

        (
            address returnedUser,
            address returnedPoolId,
            ,
            uint256 returnedAmount,
            ,
            ,
            ,
            bool returnedActive
        ) = proxy.positions(positionId);

        assertEq(returnedUser, user1, "User mismatch");
        assertEq(returnedPoolId, POOL_ID, "Pool ID mismatch");
        assertEq(returnedAmount, investAmount, "Amount mismatch");
        assertTrue(returnedActive, "Position should be active");
    }

    function testGetUserPositions() public {
        bytes32 positionId1 = keccak256(abi.encodePacked(user1, uint256(1)));
        bytes32 positionId2 = keccak256(abi.encodePacked(user1, uint256(2)));
        
        vm.deal(address(proxy), 20 ether);

        vm.startPrank(operator);
        proxy.executeInvestment(positionId1, user1, POOL_ID, BASE_ASSET, 10 ether, -1000, 1000);
        proxy.executeInvestment(positionId2, user1, POOL_ID, BASE_ASSET, 10 ether, -500, 500);
        vm.stopPrank();

        bytes32[] memory positions = proxy.getUserPositions(user1);
        assertEq(positions.length, 2, "Should have 2 positions");
    }

    function testGetActivePositions() public {
        bytes32 positionId1 = keccak256(abi.encodePacked(user1, uint256(1)));
        bytes32 positionId2 = keccak256(abi.encodePacked(user1, uint256(2)));
        
        vm.deal(address(proxy), 20 ether);

        vm.startPrank(operator);
        proxy.executeInvestment(positionId1, user1, POOL_ID, BASE_ASSET, 10 ether, -1000, 1000);
        proxy.executeInvestment(positionId2, user1, POOL_ID, BASE_ASSET, 10 ether, -500, 500);
        
        // Liquidate one position
        proxy.liquidatePosition(positionId1);
        vm.stopPrank();

        bytes32[] memory activePositions = proxy.getActivePositions();
        assertEq(activePositions.length, 1, "Should have 1 active position");
        assertEq(activePositions[0], positionId2, "Active position should be positionId2");
    }

    // ============ Access Control Tests ============

    function testOnlyOperatorCanExecuteInvestment() public {
        bytes32 positionId = keccak256(abi.encodePacked(user1, uint256(1)));
        vm.deal(address(proxy), 10 ether);

        vm.startPrank(user1);
        vm.expectRevert(XCMProxy.NotOperator.selector);
        proxy.executeInvestment(positionId, user1, POOL_ID, BASE_ASSET, 10 ether, -1000, 1000);
        vm.stopPrank();
    }

    function testOnlyOperatorCanLiquidate() public {
        bytes32 positionId = keccak256(abi.encodePacked(user1, uint256(1)));
        vm.deal(address(proxy), 10 ether);

        vm.prank(operator);
        proxy.executeInvestment(positionId, user1, POOL_ID, BASE_ASSET, 10 ether, -1000, 1000);

        vm.startPrank(user1);
        vm.expectRevert(XCMProxy.NotOperator.selector);
        proxy.liquidatePosition(positionId);
        vm.stopPrank();
    }

    function testOnlyOwnerCanSetOperator() public {
        address newOperator = makeAddr("newOperator");

        vm.startPrank(user1);
        vm.expectRevert(XCMProxy.NotOwner.selector);
        proxy.setOperator(newOperator);
        vm.stopPrank();
    }

    function testOwnerCanTransferOwnership() public {
        address newOwner = makeAddr("newOwner");

        vm.prank(deployer);
        proxy.transferOwnership(newOwner);

        assertEq(proxy.owner(), newOwner, "Ownership should be transferred");
    }

    // ============ Pause Tests ============

    function testPause() public {
        vm.prank(deployer);
        proxy.pause();

        assertTrue(proxy.paused(), "Contract should be paused");
    }

    function testPauseBlocksExecuteInvestment() public {
        bytes32 positionId = keccak256(abi.encodePacked(user1, uint256(1)));
        vm.deal(address(proxy), 10 ether);

        vm.prank(deployer);
        proxy.pause();

        vm.startPrank(operator);
        vm.expectRevert(XCMProxy.ContractPaused.selector);
        proxy.executeInvestment(positionId, user1, POOL_ID, BASE_ASSET, 10 ether, -1000, 1000);
        vm.stopPrank();
    }

    function testUnpause() public {
        vm.startPrank(deployer);
        proxy.pause();
        proxy.unpause();
        vm.stopPrank();

        assertFalse(proxy.paused(), "Contract should be unpaused");
    }

    function testPauseNonOwnerReverts() public {
        vm.startPrank(user1);
        vm.expectRevert(XCMProxy.NotOwner.selector);
        proxy.pause();
        vm.stopPrank();
    }
}

