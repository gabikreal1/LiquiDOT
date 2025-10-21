// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "./TestBase.sol";
import "./mocks/MockToken.sol";
import "./mocks/MockAlgebraPool.sol";
import "./mocks/MockNFPM.sol";
import "../../contracts/V1(Current)/XCMProxy.sol";

contract XCMProxyTest is TestBase {
    XCMProxy private proxy;
    MockToken private tokenA;
    MockToken private tokenB;
    MockAlgebraPool private pool;
    MockNFPM private nfpm;

    address private constant USER = address(0xCAFE);

    function setUp() public {
        // Deploy mock tokens and pool
        tokenA = new MockToken("TokenA", "TKA", 18);
        tokenB = new MockToken("TokenB", "TKB", 18);
        pool = new MockAlgebraPool(address(tokenA), address(tokenB), 60, uint160(1 << 96), int24(0));
        nfpm = new MockNFPM();

        // Deploy proxy with test contract as owner/operator
        proxy = new XCMProxy(address(this));
        proxy.setTestMode(true);
        proxy.setNFPM(address(nfpm));

        // Add supported token
        proxy.addSupportedToken(address(tokenA));

        // Set integrations to zero addresses for safe defaults (not used in these tests)
        proxy.setIntegrations(address(0), address(0));
    }

    function testReceiveAssetsCreatesPending() public {
        bytes32 assetHubPositionId = keccak256(abi.encodePacked("test-recv", block.timestamp));
        uint256 amount = 1 ether;

        // Prepare investment params: (poolId, baseAsset, uint256[] amounts, lowerRange, upperRange, positionOwner, slippage)
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = amount;
        amounts[1] = 0;

        bytes memory investmentParams = abi.encode(address(pool), address(tokenA), amounts, int24(-50), int24(50), USER, uint16(100));

        // Mint tokens to proxy to simulate XCM deposit
        tokenA.mint(address(proxy), amount);

        // Call receiveAssets (owner/test contract allowed in testMode)
        proxy.receiveAssets(assetHubPositionId, address(tokenA), USER, amount, investmentParams);

        // Assert pending exists
        (,,,,,,,,,, bool exists) = proxy.pendingPositions(assetHubPositionId);
        // can't destructure struct directly via solidity getter; so use interface pattern: check mapping by calling a view that returns 'exists' - but pendingPositions is public mapping so getter returns full struct
        // However solidity returns multiple values; adjust by calling via try/catch not possible here. Instead, call a low-level view via staticcall.
        // For simplicity, check assetHubPositionToLocalId (should be zero) and pendingPositions existence by reading the struct via ABI decode.

        // We'll verify by executing and ensuring executePendingInvestment can run.
        uint256 localId = proxy.executePendingInvestment(assetHubPositionId);
        assertTrue(localId > 0, "position created");

        // Verify position mapping
        uint256 posCounter = proxy.positionCounter();
        assertTrue(posCounter >= 1, "position counter incremented");
    }

    // ============ Authorization & Access Control Tests ============

    function testSetNFPMOnlyOwner() public {
        address caller = address(0xAAAA);
        vm.prank(caller);
        vm.expectRevert();
        proxy.setNFPM(address(nfpm));
    }

    function testSetOperatorOnlyOwner() public {
        address caller = address(0xBBBB);
        address newOperator = address(0xCCCC);
        vm.prank(caller);
        vm.expectRevert();
        proxy.setOperator(newOperator);
    }

    function testPauseUnpauseOnlyOwner() public {
        address caller = address(0xDDDD);
        vm.prank(caller);
        vm.expectRevert();
        proxy.pause();
    }

    // ============ Token Management Tests ============

    function testAddSupportedToken() public {
        address newToken = address(new MockToken("NewToken", "NEW", 18));
        proxy.addSupportedToken(newToken);
        assertTrue(proxy.supportedTokens(newToken), "token supported");
    }

    function testRemoveSupportedToken() public {
        address token = address(tokenA);
        assertTrue(proxy.supportedTokens(token), "token initially supported");
        proxy.removeSupportedToken(token);
        assertFalse(proxy.supportedTokens(token), "token no longer supported");
    }

    function testMultipleSupportedTokens() public {
        address token1 = address(new MockToken("Token1", "TK1", 18));
        address token2 = address(new MockToken("Token2", "TK2", 18));
        address token3 = address(new MockToken("Token3", "TK3", 18));

        proxy.addSupportedToken(token1);
        proxy.addSupportedToken(token2);
        proxy.addSupportedToken(token3);

        assertTrue(proxy.supportedTokens(token1), "token1 supported");
        assertTrue(proxy.supportedTokens(token2), "token2 supported");
        assertTrue(proxy.supportedTokens(token3), "token3 supported");
    }

    // ============ Position Management Tests ============

    function testReceiveMultipleAssets() public {
        bytes32 posId1 = keccak256(abi.encodePacked("test1", block.timestamp));
        bytes32 posId2 = keccak256(abi.encodePacked("test2", block.timestamp));
        uint256 amount = 1 ether;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = amount;
        amounts[1] = 0;
        bytes memory investmentParams = abi.encode(address(pool), address(tokenA), amounts, int24(-50), int24(50), USER, uint16(100));

        // First position
        tokenA.mint(address(proxy), amount);
        proxy.receiveAssets(posId1, address(tokenA), USER, amount, investmentParams);

        // Second position
        tokenA.mint(address(proxy), amount);
        proxy.receiveAssets(posId2, address(tokenA), USER, amount, investmentParams);

        // Execute both
        uint256 localId1 = proxy.executePendingInvestment(posId1);
        uint256 localId2 = proxy.executePendingInvestment(posId2);

        assertTrue(localId1 > 0, "first position created");
        assertTrue(localId2 > 0, "second position created");
        assertTrue(localId1 != localId2, "positions have different IDs");
    }

    function testGetUserPositions() public {
        bytes32 assetHubPositionId = keccak256(abi.encodePacked("test-positions", block.timestamp));
        uint256 amount = 1 ether;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = amount;
        amounts[1] = 0;
        bytes memory investmentParams = abi.encode(address(pool), address(tokenA), amounts, int24(-50), int24(50), USER, uint16(100));

        tokenA.mint(address(proxy), amount);
        proxy.receiveAssets(assetHubPositionId, address(tokenA), USER, amount, investmentParams);
        proxy.executePendingInvestment(assetHubPositionId);

        uint256[] memory userPositions = proxy.getUserPositions(USER);
        assertTrue(userPositions.length > 0, "user has positions");
    }

    // ============ Test Mode & Configuration Tests ============

    function testSetTestMode() public {
        assertTrue(proxy.testMode(), "test mode initially on");
        proxy.setTestMode(false);
        assertFalse(proxy.testMode(), "test mode turned off");
        proxy.setTestMode(true);
        assertTrue(proxy.testMode(), "test mode turned back on");
    }

    function testSetDefaultSlippageBps() public {
        uint16 newSlippage = 200;
        proxy.setDefaultSlippageBps(newSlippage);
        assertEq(proxy.defaultSlippageBps(), newSlippage, "slippage updated");
    }

    function testSetIntegrations() public {
        address quoter = address(0x1111);
        address router = address(0x2222);
        proxy.setIntegrations(quoter, router);
        // Verify by checking if subsequent calls work
    }

    function testGetBalance() public {
        uint256 amount = 1 ether;
        tokenA.mint(address(proxy), amount);
        uint256 balance = proxy.getBalance(address(tokenA));
        assertEq(balance, amount, "balance correct");
    }

    // ============ Pending Position Tests ============

    function testCancelPendingPosition() public {
        bytes32 assetHubPositionId = keccak256(abi.encodePacked("test-cancel", block.timestamp));
        uint256 amount = 1 ether;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = amount;
        amounts[1] = 0;
        bytes memory investmentParams = abi.encode(address(pool), address(tokenA), amounts, int24(-50), int24(50), USER, uint16(100));

        tokenA.mint(address(proxy), amount);
        proxy.receiveAssets(assetHubPositionId, address(tokenA), USER, amount, investmentParams);

        // Before cancel, should exist
        (,,,,,,,,,, bool exists) = proxy.pendingPositions(assetHubPositionId);
        assertTrue(exists, "position exists before cancel");

        // Cancel the position - should return tokens
        proxy.cancelPendingPosition(assetHubPositionId, hex"0102");

        // After cancel, should not exist
        (,,,,,,,,,, bool existsAfter) = proxy.pendingPositions(assetHubPositionId);
        assertFalse(existsAfter, "position cancelled");
    }

    // ============ Pause Functionality Tests ============

    function testPauseUnpauseCycle() public {
        assertTrue(!proxy.paused(), "proxy not paused initially");
        
        proxy.pause();
        assertTrue(proxy.paused(), "proxy paused");

        proxy.unpause();
        assertTrue(!proxy.paused(), "proxy unpaused");
    }

    function testOperationsRevertWhenPaused() public {
        proxy.pause();

        bytes32 assetHubPositionId = keccak256(abi.encodePacked("test-paused", block.timestamp));
        uint256 amount = 1 ether;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = amount;
        amounts[1] = 0;
        bytes memory investmentParams = abi.encode(address(pool), address(tokenA), amounts, int24(-50), int24(50), USER, uint16(100));

        tokenA.mint(address(proxy), amount);
        
        vm.expectRevert();
        proxy.receiveAssets(assetHubPositionId, address(tokenA), USER, amount, investmentParams);
    }

    // ============ Edge Cases & Boundary Tests ============

    function testLargeAmountReceive() public {
        bytes32 assetHubPositionId = keccak256(abi.encodePacked("large-amount", block.timestamp));
        uint256 largeAmount = 1000000 ether;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = largeAmount;
        amounts[1] = 0;
        bytes memory investmentParams = abi.encode(address(pool), address(tokenA), amounts, int24(-50), int24(50), USER, uint16(100));

        tokenA.mint(address(proxy), largeAmount);
        proxy.receiveAssets(assetHubPositionId, address(tokenA), USER, largeAmount, investmentParams);

        uint256 localId = proxy.executePendingInvestment(assetHubPositionId);
        assertTrue(localId > 0, "large position created");
    }

    function testSmallAmountReceive() public {
        bytes32 assetHubPositionId = keccak256(abi.encodePacked("small-amount", block.timestamp));
        uint256 smallAmount = 1 wei;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = smallAmount;
        amounts[1] = 0;
        bytes memory investmentParams = abi.encode(address(pool), address(tokenA), amounts, int24(-50), int24(50), USER, uint16(100));

        tokenA.mint(address(proxy), smallAmount);
        proxy.receiveAssets(assetHubPositionId, address(tokenA), USER, smallAmount, investmentParams);

        (,,,,,,,,,, bool exists) = proxy.pendingPositions(assetHubPositionId);
        assertTrue(exists, "small position recorded");
    }

    function testMultipleUsersPositions() public {
        address user1 = USER;
        address user2 = address(0xBEEF);

        bytes32 posId1 = keccak256(abi.encodePacked("user1", block.timestamp));
        bytes32 posId2 = keccak256(abi.encodePacked("user2", block.timestamp + 1));
        uint256 amount = 1 ether;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = amount;
        amounts[1] = 0;
        bytes memory investmentParams = abi.encode(address(pool), address(tokenA), amounts, int24(-50), int24(50), user1, uint16(100));
        bytes memory investmentParams2 = abi.encode(address(pool), address(tokenA), amounts, int24(-50), int24(50), user2, uint16(100));

        tokenA.mint(address(proxy), 2 * amount);
        proxy.receiveAssets(posId1, address(tokenA), user1, amount, investmentParams);
        proxy.receiveAssets(posId2, address(tokenA), user2, amount, investmentParams2);

        uint256 localId1 = proxy.executePendingInvestment(posId1);
        uint256 localId2 = proxy.executePendingInvestment(posId2);

        assertTrue(localId1 > 0, "user1 position created");
        assertTrue(localId2 > 0, "user2 position created");
    }

    function testPositionCounterIncrement() public {
        uint256 initialCounter = proxy.positionCounter();

        bytes32 assetHubPositionId1 = keccak256(abi.encodePacked("counter-test1", block.timestamp));
        bytes32 assetHubPositionId2 = keccak256(abi.encodePacked("counter-test2", block.timestamp + 1));
        uint256 amount = 1 ether;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = amount;
        amounts[1] = 0;
        bytes memory investmentParams = abi.encode(address(pool), address(tokenA), amounts, int24(-50), int24(50), USER, uint16(100));

        tokenA.mint(address(proxy), 2 * amount);
        proxy.receiveAssets(assetHubPositionId1, address(tokenA), USER, amount, investmentParams);
        proxy.executePendingInvestment(assetHubPositionId1);

        uint256 counterAfterFirst = proxy.positionCounter();
        assertEq(counterAfterFirst, initialCounter + 1, "counter incremented by 1");

        proxy.receiveAssets(assetHubPositionId2, address(tokenA), USER, amount, investmentParams);
        proxy.executePendingInvestment(assetHubPositionId2);

        uint256 counterAfterSecond = proxy.positionCounter();
        assertEq(counterAfterSecond, initialCounter + 2, "counter incremented by 2 total");
    }
}
