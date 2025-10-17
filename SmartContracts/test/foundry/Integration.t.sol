// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "../TestBase.sol";
import "../foundry/mocks/MockToken.sol";
import "../foundry/mocks/MockAlgebraPool.sol";
import "../foundry/mocks/MockNFPM.sol";
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
}
