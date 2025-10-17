// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "../TestBase.sol";
import "../foundry/mocks/MockToken.sol";
import "../foundry/mocks/MockAlgebraPool.sol";
import "../foundry/mocks/MockNFPM.sol";
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
        (,,, , , , , bool exists) = proxy.pendingPositions(assetHubPositionId);
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
}
