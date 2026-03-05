// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "./TestBase.sol";
import "./mocks/MockToken.sol";
import "./mocks/MockAlgebraPool.sol";
import "./mocks/MockNFPM.sol";
import "../../contracts/V1(Current)/AssetHubVault.sol";
import "../../contracts/V1(Current)/XCMProxy.sol";

/// @title Audit Fixes Tests
/// @notice Tests covering security findings from the LiquiDOT smart contract audit
contract AuditFixesTest is TestBase {
    AssetHubVault private vault;
    XCMProxy private proxy;
    MockToken private tokenA;
    MockToken private tokenB;
    MockAlgebraPool private pool;
    MockNFPM private nfpm;

    address private constant OPERATOR = address(0xBEEF);
    address private constant USER = address(0xCAFE);
    address private constant ATTACKER = address(0xDEAD);
    uint32 private constant MOONBEAM = 1000;
    address private constant POOL_ADDR = address(0x1234);
    address private constant BASE_ASSET = address(0x9999);

    function setUp() public {
        // --- AssetHubVault setup ---
        vault = new AssetHubVault();
        vault.setOperator(OPERATOR);
        vault.setTestMode(true);
        vault.setXcmPrecompile(address(0xdead));
        vault.addChain(MOONBEAM, hex"0102", "Moonbeam", address(0));

        // --- XCMProxy setup ---
        // Use TWO different tokens to avoid dual-sided split issues with same-token pools
        tokenA = new MockToken("TokenA", "TKA", 18);
        tokenB = new MockToken("TokenB", "TKB", 18);
        // Pool with two different tokens; tick=0, spacing=60
        pool = new MockAlgebraPool(address(tokenA), address(tokenB), 60, uint160(1 << 96), int24(0));
        nfpm = new MockNFPM();

        proxy = new XCMProxy(address(this));
        proxy.setTestMode(true);
        proxy.setNFPM(address(nfpm));
        proxy.addSupportedToken(address(tokenA));
    }

    // ==================== Helper Functions ====================

    /// @dev Create a vault position and advance it to Active status
    function _createActiveVaultPosition(uint256 amount) internal returns (bytes32 positionId) {
        vm.deal(USER, amount);
        vm.prank(USER);
        vault.deposit{value: amount}();

        vm.prank(OPERATOR);
        vault.dispatchInvestment(USER, MOONBEAM, POOL_ADDR, BASE_ASSET, amount, -50, 50, hex"01", hex"02");
        uint256 nonce = vault.positionNonce();
        positionId = keccak256(abi.encodePacked(USER, MOONBEAM, POOL_ADDR, BASE_ASSET, nonce));

        vm.prank(OPERATOR);
        vault.confirmExecution(positionId, bytes32(uint256(1)), 100);
    }

    /// @dev Create an XCMProxy position in Active status
    /// Uses out-of-range position (range above current tick) so only token0 is needed,
    /// avoiding dual-sided split and quoter requirements.
    function _createActiveProxyPosition() internal returns (uint256 localId) {
        bytes32 assetHubPosId = keccak256(abi.encodePacked("audit-test", block.timestamp));
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1 ether;
        amounts[1] = 0;
        // Use positive range percentages (+10% to +50%) so the tick range is ABOVE
        // the current tick (0). This makes the position out-of-range, requiring only
        // token0 (tokenA) — no dual-sided split, no quoter needed.
        bytes memory investmentParams = abi.encode(
            address(pool), address(tokenA), amounts,
            int24(100000), int24(500000), USER, uint16(100)
        );

        tokenA.mint(address(proxy), 1 ether);
        proxy.receiveAssets(assetHubPosId, address(tokenA), USER, 1 ether, investmentParams);
        localId = proxy.executePendingInvestment(assetHubPosId);
    }

    // ==================== H-4: settledAmount Tests ====================

    /// @notice Verify settledAmount is recorded after settlement
    function test_settleLiquidation_recordsSettledAmount() public {
        bytes32 positionId = _createActiveVaultPosition(2 ether);
        vm.deal(address(vault), 5 ether);

        vm.prank(OPERATOR);
        vault.settleLiquidation(positionId, 1.5 ether);

        // Check settledAmount field (11th field in Position struct)
        (,,,,,,,,,,uint256 settledAmount) = vault.positions(positionId);
        assertEq(settledAmount, 1.5 ether, "settled amount recorded");
    }

    /// @notice Settlement exceeding cap must revert
    function test_settleLiquidation_exceedsCap() public {
        bytes32 positionId = _createActiveVaultPosition(1 ether);

        // Default cap is 10x (10000 bps). Cap = 1 ether * 10000 / 1000 = 10 ether
        // Try to settle with 11 ether — exceeds cap
        vm.prank(OPERATOR);
        vm.expectRevert();
        vault.settleLiquidation(positionId, 11 ether);
    }

    /// @notice Double settlement must revert (position already Liquidated)
    function test_settleLiquidation_alreadyLiquidated() public {
        bytes32 positionId = _createActiveVaultPosition(2 ether);
        vm.deal(address(vault), 10 ether);

        vm.prank(OPERATOR);
        vault.settleLiquidation(positionId, 1 ether);

        // Second settlement must revert (position is now Liquidated, not Active)
        vm.prank(OPERATOR);
        vm.expectRevert();
        vault.settleLiquidation(positionId, 1 ether);
    }

    // ==================== M-2: maxSettlementMultiplier Cap Tests ====================

    /// @notice Setting multiplier above 20000 must revert
    function test_maxSettlementMultiplier_upperBound() public {
        vm.expectRevert();
        vault.setMaxSettlementMultiplier(20_001);
    }

    /// @notice Setting multiplier below 1000 must revert
    function test_maxSettlementMultiplier_lowerBound() public {
        vm.expectRevert();
        vault.setMaxSettlementMultiplier(999);
    }

    /// @notice Setting multiplier at valid boundary values succeeds
    function test_maxSettlementMultiplier_validRange() public {
        vault.setMaxSettlementMultiplier(1_000);
        assertEq(uint256(vault.maxSettlementMultiplierBps()), uint256(1_000), "1x set");

        vault.setMaxSettlementMultiplier(20_000);
        assertEq(uint256(vault.maxSettlementMultiplierBps()), uint256(20_000), "20x set");
    }

    // ==================== M-1: receive() Event Tests ====================

    /// @notice Sending ETH to vault should succeed (emits NativeReceived)
    function test_receiveEmitsEvent() public {
        vm.deal(address(this), 1 ether);
        (bool success, ) = address(vault).call{value: 1 ether}("");
        assertTrue(success, "ETH transfer to vault succeeded");
    }

    // ==================== H-1: Beneficiary Validation Tests ====================

    /// @notice liquidateSwapAndReturn with wrong beneficiary must revert
    function test_beneficiaryMismatch_liquidateSwapAndReturn_reverts() public {
        uint256 localId = _createActiveProxyPosition();

        // Try to liquidate with ATTACKER as beneficiary instead of USER
        // The InvalidUser check happens BEFORE any liquidation logic
        vm.expectRevert();
        proxy.liquidateSwapAndReturn(
            localId,
            address(tokenA), // baseAsset
            ATTACKER,        // wrong beneficiary (not position.owner)
            0,               // minAmountOut0
            0,               // minAmountOut1
            0,               // limitSqrtPrice
            bytes32(0)       // assetHubPositionId
        );
    }

    /// @notice swapAndReturn with wrong beneficiary must revert
    function test_beneficiaryMismatch_swapAndReturn_reverts() public {
        uint256 localId = _createActiveProxyPosition();

        // Mock collect to return non-zero amounts for liquidation
        vm.mockCall(
            address(nfpm),
            abi.encodeWithSignature("collect((uint256,address,uint128,uint128))"),
            abi.encode(uint256(1 ether), uint256(0))
        );

        // Liquidate first (sets status to Liquidated)
        proxy.executeFullLiquidation(localId);

        vm.clearMockedCalls();

        // Now try swapAndReturn with wrong beneficiary
        vm.expectRevert();
        proxy.swapAndReturn(
            localId,
            address(tokenA),
            ATTACKER,        // wrong beneficiary
            0, 0, 0
        );
    }

    // ==================== H-3: Zero Liquidated Amounts Tests ====================

    /// @notice After swapAndReturn, liquidatedAmount0/1 must be zeroed
    function test_swapAndReturn_zerosAmounts() public {
        uint256 localId = _createActiveProxyPosition();

        // Mock collect to return non-zero amounts
        vm.mockCall(
            address(nfpm),
            abi.encodeWithSignature("collect((uint256,address,uint128,uint128))"),
            abi.encode(uint256(1 ether), uint256(0))
        );

        // Liquidate (sets Liquidated status with liquidatedAmount0 = 1 ether)
        proxy.executeFullLiquidation(localId);

        // Verify liquidated amounts are set
        (,,,,,,,,,,,,,, uint256 liqAmt0Before, uint256 liqAmt1Before) = proxy.positions(localId);
        assertEq(liqAmt0Before, 1 ether, "liquidatedAmount0 set after liquidation");
        assertEq(liqAmt1Before, 0, "liquidatedAmount1 zero after liquidation");

        vm.clearMockedCalls();

        // Call swapAndReturn with correct beneficiary (USER is position owner)
        // token0 = tokenA = baseAsset, so totalBase += amount0 (no swap needed)
        proxy.swapAndReturn(
            localId,
            address(tokenA),
            USER,  // correct beneficiary
            0, 0, 0
        );

        // Verify liquidated amounts are zeroed
        (,,,,,,,,,,,,,, uint256 liqAmt0After, uint256 liqAmt1After) = proxy.positions(localId);
        assertEq(liqAmt0After, 0, "liquidatedAmount0 zeroed after swapAndReturn");
        assertEq(liqAmt1After, 0, "liquidatedAmount1 zeroed after swapAndReturn");
    }

    // ==================== M-5: Emergency Token Recovery Tests ====================

    /// @notice Owner can recover stuck tokens
    function test_emergencyRecoverToken() public {
        uint256 amount = 5 ether;
        tokenA.mint(address(proxy), amount);

        uint256 proxyBalanceBefore = tokenA.balanceOf(address(proxy));
        assertEq(proxyBalanceBefore, amount, "proxy has tokens");

        address recipient = address(0x7777);
        proxy.emergencyRecoverToken(address(tokenA), recipient, amount);

        uint256 proxyBalanceAfter = tokenA.balanceOf(address(proxy));
        uint256 recipientBalance = tokenA.balanceOf(recipient);
        assertEq(proxyBalanceAfter, 0, "proxy tokens recovered");
        assertEq(recipientBalance, amount, "recipient received tokens");
    }

    /// @notice Emergency recovery to address(0) must revert
    function test_emergencyRecoverToken_zeroAddressReverts() public {
        tokenA.mint(address(proxy), 1 ether);

        vm.expectRevert();
        proxy.emergencyRecoverToken(address(tokenA), address(0), 1 ether);
    }

    /// @notice Non-owner cannot recover tokens
    function test_emergencyRecoverToken_onlyOwner() public {
        tokenA.mint(address(proxy), 1 ether);

        vm.prank(USER);
        vm.expectRevert();
        proxy.emergencyRecoverToken(address(tokenA), USER, 1 ether);
    }

    // ==================== M-4: Custom Error Tests (AssetHubVault) ====================

    /// @notice Frozen XCM precompile uses custom error
    function test_frozenXcmPrecompile_customError() public {
        vault.freezeXcmPrecompile();

        vm.expectRevert();
        vault.setXcmPrecompile(address(0x1111));
    }

    /// @notice Adding duplicate chain uses custom error
    function test_duplicateChain_customError() public {
        vm.expectRevert();
        vault.addChain(MOONBEAM, hex"0102", "Moonbeam", address(0));
    }

    /// @notice Removing non-existent chain uses custom error
    function test_removeUnknownChain_customError() public {
        vm.expectRevert();
        vault.removeChain(9999);
    }
}
