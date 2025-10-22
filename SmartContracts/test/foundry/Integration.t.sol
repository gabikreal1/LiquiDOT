// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "./TestBase.sol";
import "./mocks/MockToken.sol";
import "./mocks/MockAlgebraPool.sol";
import "./mocks/MockNFPM.sol";
import "../../contracts/V1(Current)/AssetHubVault.sol";
import "../../contracts/V1(Current)/XCMProxy.sol";

contract IntegrationTest is TestBase {
    AssetHubVault private vault;
    XCMProxy private proxy;
    MockToken private tokenA;
    MockAlgebraPool private pool;
    MockNFPM private nfpm;

    address private constant USER = address(0xCAFE);
    uint32 private constant MOONBEAM = 1000;

    function setUp() public {
        // Deploy components
        vault = new AssetHubVault();
        proxy = new XCMProxy(address(this));
        tokenA = new MockToken("TokenA", "TKA", 18);
        pool = new MockAlgebraPool(address(tokenA), address(tokenA), 60, uint160(1 << 96), int24(0));
        nfpm = new MockNFPM();

        // Config
        vault.setTestMode(true);
        proxy.setTestMode(true);
        proxy.setNFPM(address(nfpm));
        proxy.addSupportedToken(address(tokenA));

        // Register chain
        vault.setXcmPrecompile(address(0xdead));
        vault.addChain(MOONBEAM, hex"0102", "Moonbeam", address(0));
    }

    function testFullMockInvestmentFlow() public {
        // User funds vault
        vm.deal(USER, 1 ether);
        vm.prank(USER);
        vault.deposit{value: 1 ether}();

        // Operator dispatches (operator is vault deployer)
        vm.prank(vault.operator());
        bytes memory destination = hex"0102";
        bytes memory message = hex"030405"; // not used in testMode
        vault.dispatchInvestment(USER, MOONBEAM, address(pool), address(tokenA), 1 ether, -50, 50, destination, message);

        // Simulate on-chain receive by calling proxy.receiveAssets
        bytes32 posId = keccak256(abi.encodePacked(USER, MOONBEAM, address(pool), address(tokenA), uint64(block.timestamp)));
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1 ether;
        amounts[1] = 0;
        bytes memory investmentParams = abi.encode(address(pool), address(tokenA), amounts, int24(-50), int24(50), USER, uint16(100));

        // proxy funded with tokenA
        tokenA.mint(address(proxy), 1 ether);
        proxy.receiveAssets(posId, address(tokenA), USER, 1 ether, investmentParams);

        // Execute pending and create position
        uint256 localId = proxy.executePendingInvestment(posId);
        assertTrue(localId > 0, "position created");

        // Now simulate liquidation
        uint256[] memory userPositions = proxy.getUserPositions(USER);
        assertTrue(userPositions.length >= 1, "user has positions");
    }

    // ============ Multi-Step Investment Flow Tests ============

    function testFullFlowMultipleUsers() public {
        address user2 = address(0xDEAD);
        
        // User 1 invests
        vm.deal(USER, 1 ether);
        vm.prank(USER);
        vault.deposit{value: 1 ether}();

        // User 2 invests
        vm.deal(user2, 2 ether);
        vm.prank(user2);
        vault.deposit{value: 2 ether}();

        // Both dispatch
        vm.prank(vault.operator());
        vault.dispatchInvestment(USER, MOONBEAM, address(pool), address(tokenA), 1 ether, -50, 50, hex"0102", hex"030405");

        vm.prank(vault.operator());
        vault.dispatchInvestment(user2, MOONBEAM, address(pool), address(tokenA), 2 ether, -50, 50, hex"0102", hex"030405");

        // Both positions created on proxy side
        bytes32 posId1 = keccak256(abi.encodePacked(USER, MOONBEAM, address(pool), address(tokenA), block.timestamp));
        bytes32 posId2 = keccak256(abi.encodePacked(user2, MOONBEAM, address(pool), address(tokenA), block.timestamp));

        uint256[] memory amounts1 = new uint256[](2);
        amounts1[0] = 1 ether;
        amounts1[1] = 0;

        uint256[] memory amounts2 = new uint256[](2);
        amounts2[0] = 2 ether;
        amounts2[1] = 0;

        bytes memory investmentParams1 = abi.encode(address(pool), address(tokenA), amounts1, int24(-50), int24(50), USER, uint16(100));
        bytes memory investmentParams2 = abi.encode(address(pool), address(tokenA), amounts2, int24(-50), int24(50), user2, uint16(100));

        tokenA.mint(address(proxy), 3 ether);
        proxy.receiveAssets(posId1, address(tokenA), USER, 1 ether, investmentParams1);
        proxy.receiveAssets(posId2, address(tokenA), user2, 2 ether, investmentParams2);

        uint256 localId1 = proxy.executePendingInvestment(posId1);
        uint256 localId2 = proxy.executePendingInvestment(posId2);

        assertTrue(localId1 > 0, "user1 position created");
        assertTrue(localId2 > 0, "user2 position created");

        // Verify positions
        uint256[] memory userPositions1 = proxy.getUserPositions(USER);
        uint256[] memory userPositions2 = proxy.getUserPositions(user2);
        assertEq(userPositions1.length, 1, "user1 has 1 position");
        assertEq(userPositions2.length, 1, "user2 has 1 position");
    }

    function testVaultToProxyFlow() public {
        // Vault deposit -> dispatch -> proxy receive -> execute
        vm.deal(USER, 1 ether);
        vm.prank(USER);
        vault.deposit{value: 1 ether}();
        assertEq(vault.userBalances(USER), 1 ether, "balance deposited to vault");

        // Dispatch from vault
        vm.prank(vault.operator());
        vault.dispatchInvestment(USER, MOONBEAM, address(pool), address(tokenA), 1 ether, -100, 100, hex"0102", hex"030405");
        assertEq(vault.userBalances(USER), 0, "balance deducted from vault");

        // Receive on proxy
        bytes32 posId = keccak256(abi.encodePacked(USER, MOONBEAM, address(pool), address(tokenA), block.timestamp));
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1 ether;
        amounts[1] = 0;
        bytes memory investmentParams = abi.encode(address(pool), address(tokenA), amounts, int24(-100), int24(100), USER, uint16(100));

        tokenA.mint(address(proxy), 1 ether);
        proxy.receiveAssets(posId, address(tokenA), USER, 1 ether, investmentParams);

        (,,,,,,,,,,bool exists) = proxy.pendingPositions(posId);
        assertTrue(exists, "position received on proxy");

        // Execute
        uint256 localId = proxy.executePendingInvestment(posId);
        assertTrue(localId > 0, "position executed");
    }

    // ============ Parameter Variation Tests ============

    function testDifferentRanges() public {
        vm.deal(USER, 3 ether);
        vm.prank(USER);
        vault.deposit{value: 3 ether}();

        // Create positions with different ranges
        int24[] memory lowers = new int24[](3);
        int24[] memory uppers = new int24[](3);
        lowers[0] = -50;  uppers[0] = 50;
        lowers[1] = -100; uppers[1] = 100;
        lowers[2] = -10;  uppers[2] = 10;

        for (uint i = 0; i < 3; i++) {
            vm.prank(vault.operator());
            vault.dispatchInvestment(USER, MOONBEAM, address(pool), address(tokenA), 1 ether, lowers[i], uppers[i], hex"0102", hex"030405");

            bytes32 posId = keccak256(abi.encodePacked(USER, MOONBEAM, address(pool), address(tokenA), block.timestamp));
            uint256[] memory amounts = new uint256[](2);
            amounts[0] = 1 ether;
            amounts[1] = 0;
            bytes memory investmentParams = abi.encode(address(pool), address(tokenA), amounts, lowers[i], uppers[i], USER, uint16(100));

            tokenA.mint(address(proxy), 1 ether);
            proxy.receiveAssets(posId, address(tokenA), USER, 1 ether, investmentParams);
            proxy.executePendingInvestment(posId);
        }

        uint256[] memory userPositions = proxy.getUserPositions(USER);
        assertEq(userPositions.length, 3, "3 positions created with different ranges");
    }

    function testDifferentChains() public {
        // Add another chain
        uint32 hydration = 2000;
        vault.addChain(hydration, hex"0304", "Hydration", address(0));

        vm.deal(USER, 2 ether);
        vm.prank(USER);
        vault.deposit{value: 2 ether}();

        // Dispatch to Moonbeam
        vm.prank(vault.operator());
        vault.dispatchInvestment(USER, MOONBEAM, address(pool), address(tokenA), 1 ether, -50, 50, hex"0102", hex"030405");

        // Dispatch to Hydration
        vm.prank(vault.operator());
        vault.dispatchInvestment(USER, hydration, address(pool), address(tokenA), 1 ether, -50, 50, hex"0304", hex"030405");

        assertEq(vault.userBalances(USER), 0, "both amounts dispatched");
    }

    // ============ Edge Cases & State Tests ============

    function testEmptyVaultDispatchReverts() public {
        vm.prank(vault.operator());
        vm.expectRevert();
        vault.dispatchInvestment(USER, MOONBEAM, address(pool), address(tokenA), 1 ether, -50, 50, hex"0102", hex"030405");
    }

    function testLargeAmountFlow() public {
        uint256 largeAmount = 1000 ether;
        vm.deal(USER, largeAmount);
        vm.prank(USER);
        vault.deposit{value: largeAmount}();

        vm.prank(vault.operator());
        vault.dispatchInvestment(USER, MOONBEAM, address(pool), address(tokenA), largeAmount, -50, 50, hex"0102", hex"030405");

        bytes32 posId = keccak256(abi.encodePacked(USER, MOONBEAM, address(pool), address(tokenA), block.timestamp));
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = largeAmount;
        amounts[1] = 0;
        bytes memory investmentParams = abi.encode(address(pool), address(tokenA), amounts, int24(-50), int24(50), USER, uint16(100));

        tokenA.mint(address(proxy), largeAmount);
        proxy.receiveAssets(posId, address(tokenA), USER, largeAmount, investmentParams);

        uint256 localId = proxy.executePendingInvestment(posId);
        assertTrue(localId > 0, "large position executed");
    }

    function testSmallAmountFlow() public {
        uint256 smallAmount = 1 wei;
        vm.deal(USER, smallAmount);
        vm.prank(USER);
        vault.deposit{value: smallAmount}();

        vm.prank(vault.operator());
        vault.dispatchInvestment(USER, MOONBEAM, address(pool), address(tokenA), smallAmount, -50, 50, hex"0102", hex"030405");

        bytes32 posId = keccak256(abi.encodePacked(USER, MOONBEAM, address(pool), address(tokenA), block.timestamp));
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = smallAmount;
        amounts[1] = 0;
        bytes memory investmentParams = abi.encode(address(pool), address(tokenA), amounts, int24(-50), int24(50), USER, uint16(100));

        tokenA.mint(address(proxy), smallAmount);
        proxy.receiveAssets(posId, address(tokenA), USER, smallAmount, investmentParams);

        (,,,,,,,,,,bool exists) = proxy.pendingPositions(posId);
        assertTrue(exists, "small amount position recorded");
    }

    function testPausedVaultFlow() public {
        vault.pause();

        vm.deal(USER, 1 ether);
        vm.prank(USER);
        vault.deposit{value: 1 ether}();

        vm.prank(vault.operator());
        vm.expectRevert();
        vault.dispatchInvestment(USER, MOONBEAM, address(pool), address(tokenA), 1 ether, -50, 50, hex"0102", hex"030405");
    }

    function testPausedProxyFlow() public {
        // Setup: deposit and dispatch through vault
        vm.deal(USER, 1 ether);
        vm.prank(USER);
        vault.deposit{value: 1 ether}();

        vm.prank(vault.operator());
        vault.dispatchInvestment(USER, MOONBEAM, address(pool), address(tokenA), 1 ether, -50, 50, hex"0102", hex"030405");

        // Pause proxy
        proxy.pause();

        // Try to receive - should fail
        bytes32 posId = keccak256(abi.encodePacked(USER, MOONBEAM, address(pool), address(tokenA), block.timestamp));
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1 ether;
        amounts[1] = 0;
        bytes memory investmentParams = abi.encode(address(pool), address(tokenA), amounts, int24(-50), int24(50), USER, uint16(100));

        tokenA.mint(address(proxy), 1 ether);
        vm.expectRevert();
        proxy.receiveAssets(posId, address(tokenA), USER, 1 ether, investmentParams);
    }

    // ============ State Consistency Tests ============

    function testConsistentPositionState() public {
        vm.deal(USER, 1 ether);
        vm.prank(USER);
        vault.deposit{value: 1 ether}();

        vm.prank(vault.operator());
        vault.dispatchInvestment(USER, MOONBEAM, address(pool), address(tokenA), 1 ether, -50, 50, hex"0102", hex"030405");

        bytes32 posId = keccak256(abi.encodePacked(USER, MOONBEAM, address(pool), address(tokenA), block.timestamp));
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1 ether;
        amounts[1] = 0;
        bytes memory investmentParams = abi.encode(address(pool), address(tokenA), amounts, int24(-50), int24(50), USER, uint16(100));

        tokenA.mint(address(proxy), 1 ether);
        proxy.receiveAssets(posId, address(tokenA), USER, 1 ether, investmentParams);

        uint256 localId = proxy.executePendingInvestment(posId);

        // Verify vault shows balance deducted
        assertEq(vault.userBalances(USER), 0, "vault balance deducted");

        // Verify proxy shows user has position
        uint256[] memory userPositions = proxy.getUserPositions(USER);
        assertEq(userPositions.length, 1, "user has position on proxy");
    }
}
