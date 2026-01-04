/**
 * XCMProxy Testnet Liquidation Tests
 * 
 * Tests liquidation flow and asset return to Asset Hub
 * Safe for testnet - uses test mode to skip actual XCM transfers
 * 
 * Usage:
 *   npx hardhat test test/XCMProxy/testnet/4.liquidation.test.js --network moonbase
 * 
 * Requirements:
 *   - MOON_PK in .env must have DEV tokens
 *   - XCMPROXY_CONTRACT must point to deployed contract
 *   - Contract must be in test mode
 *   - Account must be operator
 *   - Must have active positions (run 3.execute-position.test.js first)
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { getMoonbaseTestConfig } = require("./config");

describe("XCMProxy Testnet - Liquidation", function () {
  let proxy;
  let operator;
  const DEFAULT_EXECUTION_SLIPPAGE = Number(process.env.MOONBASE_EXEC_SLIPPAGE_BPS || "5000");
  const moonbase = getMoonbaseTestConfig();
  const PROXY_ADDRESS = moonbase.proxyAddress;
  const TEST_POOL_ID = moonbase.poolAddress;
  const BASE_TOKEN = moonbase.baseToken;
  const QUOTE_TOKEN = moonbase.quoteToken || moonbase.supportedTokens?.find((addr) => addr.toLowerCase() !== (moonbase.baseToken || "").toLowerCase());
  const SUPPORTED_TOKENS = moonbase.supportedTokens || [];
  
  // Mock XCM destination for asset return
  const MOCK_ASSET_HUB_DEST = "0x01010200a10f0100"; // Mock MultiLocation bytes
  
  before(async function () {
    if (!PROXY_ADDRESS || PROXY_ADDRESS === ethers.ZeroAddress) {
      throw new Error("Proxy address missing. Run bootstrap script or set XCMPROXY_ADDRESS / XCMPROXY_CONTRACT.");
    }

    if (!TEST_POOL_ID || TEST_POOL_ID === ethers.ZeroAddress) {
      throw new Error("Pool address missing. Ensure MOONBASE_REAL_POOL is set or rerun bootstrap.");
    }

    if (!BASE_TOKEN) {
      throw new Error("Base token missing. Ensure MOONBASE_BASE_TOKEN is set or rerun bootstrap.");
    }

    [operator] = await ethers.getSigners();

    const XCMProxy = await ethers.getContractFactory(
      "contracts/V1(Current)/XCMProxy.sol:XCMProxy"
    );
    proxy = XCMProxy.attach(PROXY_ADDRESS);

    // Check and enable test mode if needed
    const contractOwner = await proxy.owner();
    const testMode = await proxy.testMode();
    
    if (!testMode) {
      if (contractOwner.toLowerCase() === operator.address.toLowerCase()) {
        console.log("\n⚠️  Test mode disabled - enabling automatically...");
        const tx = await proxy.setTestMode(true);
        await tx.wait();
        console.log("✅ Test mode enabled\n");
      } else {
        throw new Error("Test mode must be enabled");
      }
    }

    console.log(`\n✅ Connected to XCMProxy at: ${PROXY_ADDRESS}`);
    console.log(`✅ Network: ${network.name}`);
    console.log(`✅ Operator: ${operator.address}`);
    console.log(`✅ Pool: ${TEST_POOL_ID}`);
    console.log(`✅ Base Token: ${BASE_TOKEN}`);
    if (QUOTE_TOKEN) {
      console.log(`✅ Quote Token: ${QUOTE_TOKEN}`);
    }
    if (SUPPORTED_TOKENS.length > 0) {
      console.log(`✅ Supported Tokens: ${SUPPORTED_TOKENS.join(", ")}`);
    }
    console.log(`✅ Test Mode: Enabled (XCM calls will be skipped)\n`);
  });

  describe("Full Liquidation - Basic Flow", function () {
    let testPositionId;
    let testAssetHubPositionId;

    before(async function () {
      // These tests depend on executed positions from test 3
  const skipIntegration = !TEST_POOL_ID;
      if (skipIntegration) {
        console.log("\n⏭️  Skipping liquidation tests (requires executed positions)");
        console.log("   See test/XCMProxy/testnet/FAILURE_ANALYSIS.md for setup instructions.\n");
        this.skip();
        return;
      }

      this.timeout(180000);

      // Create a position for liquidation testing
      testAssetHubPositionId = ethers.keccak256(
        ethers.toUtf8Bytes(`test-liq-${Date.now()}`)
      );

      const investmentParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256[]", "int24", "int24", "address", "uint16"],
        [
          TEST_POOL_ID,
          BASE_TOKEN,
          [ethers.parseEther("0.5"), ethers.parseEther("0.5")],
          -50,
          50,
          operator.address,
          DEFAULT_EXECUTION_SLIPPAGE
        ]
      );
      const receiveTx = await proxy.receiveAssets(
        testAssetHubPositionId,
        BASE_TOKEN,
        operator.address,
        ethers.parseEther("1.0"),
        investmentParams
      );
      await receiveTx.wait();

      // Fund the proxy with tokens to simulate XCM transfer
      const baseTokenContract = await ethers.getContractAt("IERC20", BASE_TOKEN);
      const fundBaseTx = await baseTokenContract.transfer(proxy.target, ethers.parseEther("1.0"));
      await fundBaseTx.wait();
      console.log(`   ✓ Proxy funded with BASE_TOKEN`);

      // Fund the proxy with QUOTE_TOKEN to satisfy the 50/50 requirement
      if (QUOTE_TOKEN) {
        const quoteTokenContract = await ethers.getContractAt("IERC20", QUOTE_TOKEN);
        const fundTx = await quoteTokenContract.transfer(proxy.target, ethers.parseEther("0.5"));
        await fundTx.wait();
        console.log(`   ✓ Proxy funded with QUOTE_TOKEN`);
      }

      // Verify pending was created
      const pending = await proxy.pendingPositions(testAssetHubPositionId);
      if (!pending.exists) {
        console.log(`   ⚠️  Pending position not created - skipping liquidation tests`);
        this.skip();
      }

      // Execute it (if NFPM configured)
      const nfpm = await proxy.nfpmContract();
      if (nfpm !== ethers.ZeroAddress) {
        const tx = await proxy.executePendingInvestment(testAssetHubPositionId);
        const receipt = await tx.wait();
        
        const event = receipt.logs.find(log => {
          try {
            const parsed = proxy.interface.parseLog(log);
            return parsed && parsed.name === "PositionCreated";
          } catch {
            return false;
          }
        });
        
        const parsed = proxy.interface.parseLog(event);
        testPositionId = parsed.args[0];
        
        console.log(`   ✓ Test position created: ${testPositionId}`);
      } else {
        console.log(`   ⚠️  NFPM not configured - skipping position execution`);
        this.skip();
      }
    });

    it("should execute full liquidation of position", async function () {
      this.timeout(180000);

      if (!testPositionId) {
        this.skip();
      }

      // Verify position is active (status = 0 means Active)
      const positionBefore = await proxy.positions(testPositionId);
      expect(positionBefore.status).to.equal(0); // PositionStatus.Active

      // Execute full liquidation
      const tx = await proxy.executeFullLiquidation(testPositionId);
      const receipt = await tx.wait();

      // Verify position is now Liquidated (status = 1)
      const positionAfter = await proxy.positions(testPositionId);
      expect(positionAfter.status).to.equal(1); // PositionStatus.Liquidated

      // Verify liquidation event
      const liquidatedEvent = receipt.logs.find(log => {
        try {
          const parsed = proxy.interface.parseLog(log);
          return parsed && parsed.name === "PositionLiquidated";
        } catch {
          return false;
        }
      });

      expect(liquidatedEvent).to.not.be.undefined;

      console.log(`   ✓ Position liquidated successfully`);
      console.log(`   ✓ Position is now inactive`);
    });

    it("should fail to liquidate non-existent position", async function () {
      const fakePositionId = 999999;

      await expect(
        proxy.executeFullLiquidation(fakePositionId)
      ).to.be.revertedWithCustomError(proxy, "PositionNotActive");
    });

    it("should fail to liquidate already inactive position", async function () {
      if (!testPositionId) {
        this.skip();
      }

      // Try to liquidate the already-liquidated position
      await expect(
        proxy.executeFullLiquidation(testPositionId)
      ).to.be.revertedWithCustomError(proxy, "PositionNotActive");
    });
  });

  describe("Liquidate, Swap, and Return Flow", function () {
    let fullFlowPositionId;
    let fullFlowAssetHubId;

    before(async function () {
      this.timeout(180000);

      // Create another position for full flow testing
      fullFlowAssetHubId = ethers.keccak256(
        ethers.toUtf8Bytes(`test-full-flow-${Date.now()}`)
      );

      const investmentParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256[]", "int24", "int24", "address", "uint16"],
        [
          TEST_POOL_ID,
          BASE_TOKEN,
          [ethers.parseEther("0.5"), ethers.parseEther("0.5")],
          -50,
          50,
          operator.address,
          DEFAULT_EXECUTION_SLIPPAGE
        ]
      );

      const receiveTx = await proxy.receiveAssets(
        fullFlowAssetHubId,
        BASE_TOKEN,
        operator.address,
        ethers.parseEther("1.0"),
        investmentParams
      );
      await receiveTx.wait();

      // Fund the proxy with tokens to simulate XCM transfer
      const baseTokenContract2 = await ethers.getContractAt("IERC20", BASE_TOKEN);
      const fundBaseTx2 = await baseTokenContract2.transfer(proxy.target, ethers.parseEther("1.0"));
      await fundBaseTx2.wait();

      // Fund the proxy with QUOTE_TOKEN to satisfy the 50/50 requirement
      if (QUOTE_TOKEN) {
        const quoteTokenContract = await ethers.getContractAt("IERC20", QUOTE_TOKEN);
        const fundTx = await quoteTokenContract.transfer(proxy.target, ethers.parseEther("0.5"));
        await fundTx.wait();
      }

      // Verify pending was created
      const pending = await proxy.pendingPositions(fullFlowAssetHubId);
      if (!pending.exists) {
        this.skip();
      }

      const nfpm = await proxy.nfpmContract();
      if (nfpm !== ethers.ZeroAddress) {
        const tx = await proxy.executePendingInvestment(fullFlowAssetHubId);
        const receipt = await tx.wait();
        
        const event = receipt.logs.find(log => {
          try {
            const parsed = proxy.interface.parseLog(log);
            return parsed && parsed.name === "PositionCreated";
          } catch {
            return false;
          }
        });
        
        const parsed = proxy.interface.parseLog(event);
        fullFlowPositionId = parsed.args[0];
      } else {
        this.skip();
      }
    });

    it("should liquidate, swap proceeds, and return to Asset Hub", async function () {
      this.timeout(180000);

      if (!fullFlowPositionId) {
        this.skip();
      }

      const position = await proxy.positions(fullFlowPositionId);
      
      // Execute full liquidation flow with swap and return
      const tx = await proxy.liquidateSwapAndReturn(
        fullFlowPositionId,
        BASE_TOKEN,
        MOCK_ASSET_HUB_DEST,
        0,
        0,
        0,
        fullFlowAssetHubId
      );

      const receipt = await tx.wait();

      // In test mode, XCM transfer is skipped but events should still emit
      const completedEvent = receipt.logs.find(log => {
        try {
          const parsed = proxy.interface.parseLog(log);
          return parsed && parsed.name === "LiquidationCompleted";
        } catch {
          return false;
        }
      });

      // Verify position is inactive (status != 0)
      const positionAfter = await proxy.positions(fullFlowPositionId);
      expect(positionAfter.status).to.not.equal(0); // Not Active

      console.log(`   ✓ Full liquidation flow completed`);
      console.log(`   ✓ Test mode: XCM transfer skipped`);
      
      if (completedEvent) {
        console.log(`   ✓ LiquidationCompleted event emitted`);
      }
    });
  });

  describe("Cancel Pending Position", function () {
    it("should cancel pending position and return assets", async function () {
      this.timeout(180000);

      // Create a pending position
      const assetHubPositionId = ethers.keccak256(
        ethers.toUtf8Bytes(`test-cancel-${Date.now()}`)
      );

      const investmentParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256[]", "int24", "int24", "address", "uint16"],
        [
          TEST_POOL_ID,
          BASE_TOKEN,
          [],
          -50,
          50,
          operator.address,
          DEFAULT_EXECUTION_SLIPPAGE
        ]
      );

      const receiveTx = await proxy.receiveAssets(
        assetHubPositionId,
  BASE_TOKEN,
        operator.address,
        ethers.parseEther("1.0"),
        investmentParams
      );
      await receiveTx.wait();

      // Verify pending exists
      const pendingBefore = await proxy.pendingPositions(assetHubPositionId);
      expect(pendingBefore.exists).to.be.true;

      // Cancel it
      const tx = await proxy.cancelPendingPosition(
        assetHubPositionId,
        MOCK_ASSET_HUB_DEST
      );

      const receipt = await tx.wait();

      // Verify pending deleted
      const pendingAfter = await proxy.pendingPositions(assetHubPositionId);
      expect(pendingAfter.exists).to.be.false;

      // Verify event
      const cancelledEvent = receipt.logs.find(log => {
        try {
          const parsed = proxy.interface.parseLog(log);
          return parsed && parsed.name === "PendingPositionCancelled";
        } catch {
          return false;
        }
      });

      expect(cancelledEvent).to.not.be.undefined;

      console.log(`   ✓ Pending position cancelled`);
      console.log(`   ✓ Assets returned to Asset Hub (test mode: skipped)`);
    });

    it("should fail to cancel non-existent pending position", async function () {
      const fakePositionId = ethers.keccak256(
        ethers.toUtf8Bytes("non-existent")
      );

      await expect(
        proxy.cancelPendingPosition(fakePositionId, MOCK_ASSET_HUB_DEST)
      ).to.be.revertedWithCustomError(proxy, "PendingPositionNotFound");
    });
  });

  describe("Position Range Check", function () {
    it("should check if position is out of range", async function () {
      // This requires an active position with NFPM
      const counter = await proxy.positionCounter();
      
      if (counter === 0n) {
        console.log(`   ⚠️  No positions to check - create positions first`);
        this.skip();
      }

      // Check the first position
      const position = await proxy.positions(1);
      
      if (!position.active) {
        console.log(`   ⚠️  Position 1 is not active`);
        this.skip();
      }

      // Call isPositionOutOfRange
      const [outOfRange, currentPrice] = await proxy.isPositionOutOfRange(1);

      console.log(`   ✓ Position 1 out of range: ${outOfRange}`);
      console.log(`   ✓ Current tick: ${currentPrice}`);
      console.log(`   ✓ Position range: ${position.bottomTick} to ${position.topTick}`);
    });
  });

  describe("Asset Return (Owner Function)", function () {
    it("should allow owner to manually return assets", async function () {
      this.timeout(180000);

      // This function allows owner to return assets without liquidating
      // Useful for emergency situations
      
      // Skip if not owner
      const owner = await proxy.owner();
      if (owner.toLowerCase() !== operator.address.toLowerCase()) {
        console.log(`   ⚠️  Test account is not owner - skipping`);
        this.skip();
      }

      // First, we need to make sure the proxy has funds to return
      const proxyBalance = await (await ethers.getContractAt("IERC20", BASE_TOKEN)).balanceOf(proxy.target);
      if (proxyBalance < ethers.parseEther("0.1")) {
        // Fund the proxy with BASE_TOKEN
        const baseTokenContract = await ethers.getContractAt("IERC20", BASE_TOKEN);
        const fundTx = await baseTokenContract.transfer(proxy.target, ethers.parseEther("0.2"));
        await fundTx.wait();
        console.log(`   ✓ Proxy funded with BASE_TOKEN`);
      }

      // returnAssets signature: (address token, address user, uint256 amount, bytes destination)
      // In test mode, XCM transfer is skipped
      const tx = await proxy.returnAssets(
        BASE_TOKEN,
        operator.address,
        ethers.parseEther("0.1"),
        MOCK_ASSET_HUB_DEST
      );
      const receipt = await tx.wait();
      
      expect(receipt.status).to.equal(1);

      console.log(`   ✓ Manual asset return executed (test mode)`);
    });
  });
});
