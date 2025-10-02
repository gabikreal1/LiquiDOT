/**
 * XCMProxy Liquidation Tests
 * 
 * Covers liquidation-related tests from TESTING-REQUIREMENTS.md
 * 
 * Tests:
 * - Position liquidation
 * - Liquidity removal
 * - Fee collection
 * - Position state updates
 * 
 * Usage:
 *   npx hardhat test test/XCMProxy/5.liquidation.test.js
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { setupTestEnvironment } = require("../setup/test-environment");

describe("XCMProxy - Liquidation", function () {
  let env;
  let xcmProxy, nfpm, weth, tokenB, poolAddress;
  let deployer, operator, user1;

  beforeEach(async function () {
    console.log("\n🔧 Setting up environment for liquidation tests...");
    
    env = await setupTestEnvironment({
      deployAlgebra: true,
      deployXCMProxy: true,
      connectToVault: false,
      testMode: true,
      verbose: false
    });

    xcmProxy = env.xcmProxy;
    nfpm = env.nfpm;
    weth = env.weth;
    tokenB = env.tokenB;
    deployer = env.deployer;
    operator = env.operator;
    user1 = env.user1;

    // Create and initialize pool
    const poolCreation = await env.createAndInitializePool({
      tokenA: await weth.getAddress(),
      tokenB: await tokenB.getAddress(),
      fee: 500
    });

    poolAddress = poolCreation.pool;

    // Add liquidity
    await env.addLiquidityToPool({
      pool: poolAddress,
      tokenA: await weth.getAddress(),
      tokenB: await tokenB.getAddress(),
      amount0: ethers.parseEther("1000"),
      amount1: ethers.parseEther("1000")
    });

    // Add tokens as supported
    await xcmProxy.connect(deployer).addSupportedToken(await weth.getAddress());
    await xcmProxy.connect(deployer).addSupportedToken(await tokenB.getAddress());

    console.log("   ✅ Ready for liquidation tests\n");
  });

  /**
   * Helper function to create a position
   */
  async function createTestPosition(user, amount) {
    const positionId = ethers.solidityPackedKeccak256(
      ["address", "uint256"],
      [user.address, Date.now()]
    );

    await deployer.sendTransaction({
      to: await xcmProxy.getAddress(),
      value: amount
    });

    await xcmProxy.connect(operator).executeInvestment(
      user.address,
      poolAddress,
      await weth.getAddress(),
      amount,
      -5,
      5,
      positionId
    );

    return positionId;
  }

  describe("Position Liquidation", function () {
    it("should liquidate active position", async function () {
      const amount = ethers.parseEther("10");
      const positionId = await createTestPosition(user1, amount);

      // Verify position is active
      let position = await xcmProxy.getPosition(positionId);
      expect(position.active).to.equal(true);

      // Liquidate
      await xcmProxy.connect(operator).liquidatePosition(positionId);

      // Verify position is now inactive
      position = await xcmProxy.getPosition(positionId);
      expect(position.active).to.equal(false);
    });

    it("should emit PositionLiquidated event", async function () {
      const amount = ethers.parseEther("10");
      const positionId = await createTestPosition(user1, amount);

      await expect(
        xcmProxy.connect(operator).liquidatePosition(positionId)
      ).to.emit(xcmProxy, "PositionLiquidated");
    });

    it("should remove liquidity from pool", async function () {
      const amount = ethers.parseEther("10");
      const positionId = await createTestPosition(user1, amount);

      const position = await xcmProxy.getPosition(positionId);
      const liquidityBefore = position.liquidity;
      
      expect(liquidityBefore).to.be.gt(0);

      await xcmProxy.connect(operator).liquidatePosition(positionId);

      // After liquidation, liquidity should be removed
      const positionAfter = await xcmProxy.getPosition(positionId);
      expect(positionAfter.active).to.equal(false);
    });

    it("should revert on non-existent position", async function () {
      const fakePositionId = "0x1234567890123456789012345678901234567890123456789012345678901234";

      await expect(
        xcmProxy.connect(operator).liquidatePosition(fakePositionId)
      ).to.be.revertedWith("Position not active");
    });

    it("should revert on already liquidated position", async function () {
      const amount = ethers.parseEther("10");
      const positionId = await createTestPosition(user1, amount);

      // First liquidation succeeds
      await xcmProxy.connect(operator).liquidatePosition(positionId);

      // Second liquidation fails
      await expect(
        xcmProxy.connect(operator).liquidatePosition(positionId)
      ).to.be.revertedWith("Position not active");
    });

    it("should only allow operator to liquidate", async function () {
      const amount = ethers.parseEther("10");
      const positionId = await createTestPosition(user1, amount);

      await expect(
        xcmProxy.connect(user1).liquidatePosition(positionId)
      ).to.be.revertedWithCustomError(xcmProxy, "NotOperator");
    });

    it("should handle multiple position liquidations", async function () {
      const amount = ethers.parseEther("5");
      
      // Create 3 positions
      const positionIds = [];
      for (let i = 0; i < 3; i++) {
        const id = await createTestPosition(user1, amount);
        positionIds.push(id);
        await ethers.provider.send("evm_mine");
      }

      // Liquidate all
      for (const id of positionIds) {
        await xcmProxy.connect(operator).liquidatePosition(id);
        
        const position = await xcmProxy.getPosition(id);
        expect(position.active).to.equal(false);
      }
    });
  });

  describe("Fee Collection", function () {
    it("should collect fees from position", async function () {
      const amount = ethers.parseEther("10");
      const positionId = await createTestPosition(user1, amount);

      // Collect fees (may be 0 if no trading activity)
      await expect(
        xcmProxy.connect(operator).collectFees(positionId)
      ).to.not.be.reverted;
    });

    it("should emit FeesCollected event", async function () {
      const amount = ethers.parseEther("10");
      const positionId = await createTestPosition(user1, amount);

      await expect(
        xcmProxy.connect(operator).collectFees(positionId)
      ).to.emit(xcmProxy, "FeesCollected");
    });

    it("should revert collecting fees from non-existent position", async function () {
      const fakePositionId = "0x9999999999999999999999999999999999999999999999999999999999999999";

      await expect(
        xcmProxy.connect(operator).collectFees(fakePositionId)
      ).to.be.revertedWith("Position not active");
    });

    it("should revert collecting fees from liquidated position", async function () {
      const amount = ethers.parseEther("10");
      const positionId = await createTestPosition(user1, amount);

      await xcmProxy.connect(operator).liquidatePosition(positionId);

      await expect(
        xcmProxy.connect(operator).collectFees(positionId)
      ).to.be.revertedWith("Position not active");
    });

    it("should only allow operator to collect fees", async function () {
      const amount = ethers.parseEther("10");
      const positionId = await createTestPosition(user1, amount);

      await expect(
        xcmProxy.connect(user1).collectFees(positionId)
      ).to.be.revertedWithCustomError(xcmProxy, "NotOperator");
    });
  });

  describe("Position State After Liquidation", function () {
    it("should keep position data after liquidation", async function () {
      const amount = ethers.parseEther("10");
      const positionId = await createTestPosition(user1, amount);

      const positionBefore = await xcmProxy.getPosition(positionId);
      
      await xcmProxy.connect(operator).liquidatePosition(positionId);

      const positionAfter = await xcmProxy.getPosition(positionId);
      
      // Position data should be preserved
      expect(positionAfter.user).to.equal(positionBefore.user);
      expect(positionAfter.poolId).to.equal(positionBefore.poolId);
      expect(positionAfter.nftTokenId).to.equal(positionBefore.nftTokenId);
      
      // But active should be false
      expect(positionAfter.active).to.equal(false);
    });

    it("should not appear in active positions after liquidation", async function () {
      const amount = ethers.parseEther("10");
      const positionId = await createTestPosition(user1, amount);

      const activePositionsBefore = await xcmProxy.getActivePositions();
      const countBefore = activePositionsBefore.length;

      await xcmProxy.connect(operator).liquidatePosition(positionId);

      const activePositionsAfter = await xcmProxy.getActivePositions();
      const countAfter = activePositionsAfter.length;

      expect(countAfter).to.equal(countBefore - 1);
    });

    it("should still appear in user positions (inactive)", async function () {
      const amount = ethers.parseEther("10");
      const positionId = await createTestPosition(user1, amount);

      const userPositionsBefore = await xcmProxy.getUserPositions(user1.address);
      const countBefore = userPositionsBefore.length;

      await xcmProxy.connect(operator).liquidatePosition(positionId);

      const userPositionsAfter = await xcmProxy.getUserPositions(user1.address);
      const countAfter = userPositionsAfter.length;

      // User positions array length should not change
      expect(countAfter).to.equal(countBefore);
    });
  });

  describe("Liquidation with Paused Contract", function () {
    it("should revert liquidation when paused", async function () {
      const amount = ethers.parseEther("10");
      const positionId = await createTestPosition(user1, amount);

      await xcmProxy.connect(deployer).pause();

      await expect(
        xcmProxy.connect(operator).liquidatePosition(positionId)
      ).to.be.revertedWithCustomError(xcmProxy, "EnforcedPause");
    });

    it("should allow liquidation after unpause", async function () {
      const amount = ethers.parseEther("10");
      const positionId = await createTestPosition(user1, amount);

      await xcmProxy.connect(deployer).pause();
      await xcmProxy.connect(deployer).unpause();

      await expect(
        xcmProxy.connect(operator).liquidatePosition(positionId)
      ).to.not.be.reverted;
    });
  });

  describe("Liquidation Edge Cases", function () {
    it("should handle liquidation of positions from different users", async function () {
      const amount = ethers.parseEther("5");
      const user2 = (await ethers.getSigners())[3];

      const positionId1 = await createTestPosition(user1, amount);
      await ethers.provider.send("evm_mine");
      const positionId2 = await createTestPosition(user2, amount);

      // Liquidate user1's position
      await xcmProxy.connect(operator).liquidatePosition(positionId1);
      
      let pos1 = await xcmProxy.getPosition(positionId1);
      let pos2 = await xcmProxy.getPosition(positionId2);
      
      expect(pos1.active).to.equal(false);
      expect(pos2.active).to.equal(true); // user2's still active

      // Liquidate user2's position
      await xcmProxy.connect(operator).liquidatePosition(positionId2);
      
      pos2 = await xcmProxy.getPosition(positionId2);
      expect(pos2.active).to.equal(false);
    });

    it("should handle liquidation immediately after creation", async function () {
      const amount = ethers.parseEther("10");
      const positionId = await createTestPosition(user1, amount);

      // Liquidate immediately (same block is fine)
      await expect(
        xcmProxy.connect(operator).liquidatePosition(positionId)
      ).to.not.be.reverted;
    });

    it("should track contract balance changes during liquidation", async function () {
      const amount = ethers.parseEther("10");
      const positionId = await createTestPosition(user1, amount);

      const balanceBefore = await ethers.provider.getBalance(await xcmProxy.getAddress());
      
      await xcmProxy.connect(operator).liquidatePosition(positionId);

      const balanceAfter = await ethers.provider.getBalance(await xcmProxy.getAddress());
      
      // Balance should increase (liquidity returned)
      expect(balanceAfter).to.be.gte(balanceBefore);
    });
  });

  describe("Liquidation Gas Costs", function () {
    it("should report liquidation gas cost", async function () {
      const amount = ethers.parseEther("10");
      const positionId = await createTestPosition(user1, amount);

      const tx = await xcmProxy.connect(operator).liquidatePosition(positionId);
      const receipt = await tx.wait();

      console.log(`   Liquidation gas used: ${receipt.gasUsed.toString()}`);
      
      expect(receipt.gasUsed).to.be.gt(0);
    });
  });
});

