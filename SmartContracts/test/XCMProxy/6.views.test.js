/**
 * XCMProxy View Functions Tests
 * 
 * Tests view/getter functions for position data and monitoring
 * 
 * Tests:
 * - getPosition() - Retrieve position details
 * - getUserPositions() - Get all positions for a user
 * - getActivePositions() - Get all active positions
 * - Position data verification
 * 
 * Usage:
 *   npx hardhat test test/XCMProxy/6.views.test.js
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { setupTestEnvironment } = require("../setup/test-environment");

describe("XCMProxy - View Functions", function () {
  let env;
  let xcmProxy, weth, tokenB, poolAddress;
  let deployer, operator, user1, user2;

  before(async function () {
    env = await setupTestEnvironment({
      deployAlgebra: true,
      deployXCMProxy: true,
      connectToVault: false,
      testMode: true,
      verbose: false
    });

    xcmProxy = env.xcmProxy;
    weth = env.weth;
    tokenB = env.tokenB;
    deployer = env.deployer;
    operator = env.operator;
    user1 = env.user1;
    user2 = env.user2;

    const poolCreation = await env.createAndInitializePool({
      tokenA: await weth.getAddress(),
      tokenB: await tokenB.getAddress(),
      fee: 500
    });

    poolAddress = poolCreation.pool;

    await env.addLiquidityToPool({
      pool: poolAddress,
      tokenA: await weth.getAddress(),
      tokenB: await tokenB.getAddress(),
      amount0: ethers.parseEther("1000"),
      amount1: ethers.parseEther("1000")
    });

    await xcmProxy.connect(deployer).addSupportedToken(await weth.getAddress());
    await xcmProxy.connect(deployer).addSupportedToken(await tokenB.getAddress());
  });

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

    await ethers.provider.send("evm_mine");
    return positionId;
  }

  describe("getPosition()", function () {
    it("should return position data", async function () {
      const amount = ethers.parseEther("10");
      const positionId = await createTestPosition(user1, amount);

      const position = await xcmProxy.getPosition(positionId);

      expect(position.user).to.equal(user1.address);
      expect(position.poolId).to.equal(poolAddress);
      expect(position.active).to.equal(true);
      expect(position.nftTokenId).to.be.gt(0);
    });

    it("should return correct token addresses", async function () {
      const amount = ethers.parseEther("10");
      const positionId = await createTestPosition(user1, amount);

      const position = await xcmProxy.getPosition(positionId);

      expect(position.token0).to.not.equal(ethers.ZeroAddress);
      expect(position.token1).to.not.equal(ethers.ZeroAddress);
    });

    it("should return timestamp", async function () {
      const amount = ethers.parseEther("10");
      const blockBefore = await ethers.provider.getBlock('latest');
      
      const positionId = await createTestPosition(user1, amount);

      const position = await xcmProxy.getPosition(positionId);
      expect(position.timestamp).to.be.gte(blockBefore.timestamp);
    });

    it("should return inactive status for liquidated positions", async function () {
      const amount = ethers.parseEther("10");
      const positionId = await createTestPosition(user1, amount);

      await xcmProxy.connect(operator).liquidatePosition(positionId);

      const position = await xcmProxy.getPosition(positionId);
      expect(position.active).to.equal(false);
    });

    it("should return zero values for non-existent position", async function () {
      const fakePositionId = "0x9999999999999999999999999999999999999999999999999999999999999999";

      const position = await xcmProxy.getPosition(fakePositionId);
      
      expect(position.user).to.equal(ethers.ZeroAddress);
      expect(position.active).to.equal(false);
      expect(position.nftTokenId).to.equal(0);
    });
  });

  describe("getUserPositions()", function () {
    it("should return empty array for user with no positions", async function () {
      const newUser = (await ethers.getSigners())[5];
      const positions = await xcmProxy.getUserPositions(newUser.address);
      
      expect(positions.length).to.equal(0);
    });

    it("should return all positions for user", async function () {
      const amount = ethers.parseEther("5");
      
      // Create 3 positions for user2
      const positionIds = [];
      for (let i = 0; i < 3; i++) {
        const id = await createTestPosition(user2, amount);
        positionIds.push(id);
      }

      const userPositions = await xcmProxy.getUserPositions(user2.address);
      
      expect(userPositions.length).to.be.gte(3);
      
      // Verify last 3 positions match
      const lastThree = userPositions.slice(-3);
      for (let i = 0; i < 3; i++) {
        expect(lastThree[i]).to.equal(positionIds[i]);
      }
    });

    it("should include both active and inactive positions", async function () {
      const testUser = (await ethers.getSigners())[4];
      const amount = ethers.parseEther("5");
      
      const pos1 = await createTestPosition(testUser, amount);
      const pos2 = await createTestPosition(testUser, amount);

      // Liquidate first position
      await xcmProxy.connect(operator).liquidatePosition(pos1);

      const userPositions = await xcmProxy.getUserPositions(testUser.address);
      
      expect(userPositions.length).to.equal(2);
      expect(userPositions).to.include(pos1);
      expect(userPositions).to.include(pos2);
    });

    it("should not include positions from other users", async function () {
      const amount = ethers.parseEther("5");
      
      const user1Pos = await createTestPosition(user1, amount);
      
      const user2Positions = await xcmProxy.getUserPositions(user2.address);
      
      expect(user2Positions).to.not.include(user1Pos);
    });
  });

  describe("getActivePositions()", function () {
    it("should return only active positions", async function () {
      const amount = ethers.parseEther("5");
      
      // Get initial count
      const initialActive = await xcmProxy.getActivePositions();
      const initialCount = initialActive.length;

      // Create 3 new positions
      const positionIds = [];
      for (let i = 0; i < 3; i++) {
        const id = await createTestPosition(user1, amount);
        positionIds.push(id);
      }

      // Liquidate 1 position
      await xcmProxy.connect(operator).liquidatePosition(positionIds[0]);

      const activePositions = await xcmProxy.getActivePositions();
      
      // Should have initialCount + 2 active positions
      expect(activePositions.length).to.equal(initialCount + 2);
      
      // Should not include liquidated position
      expect(activePositions).to.not.include(positionIds[0]);
      
      // Should include active positions
      expect(activePositions).to.include(positionIds[1]);
      expect(activePositions).to.include(positionIds[2]);
    });

    it("should return empty array when no active positions", async function () {
      // Deploy a fresh XCMProxy
      const XCMProxy = await ethers.getContractFactory("contracts/V1(Current)/XCMProxy.sol:XCMProxy");
      const freshProxy = await XCMProxy.deploy(
        await env.quoter.getAddress(),
        await env.router.getAddress()
      );
      await freshProxy.waitForDeployment();

      const activePositions = await freshProxy.getActivePositions();
      expect(activePositions.length).to.equal(0);
    });

    it("should update when positions are liquidated", async function () {
      const amount = ethers.parseEther("5");
      
      const activeBefore = await xcmProxy.getActivePositions();
      const countBefore = activeBefore.length;

      const positionId = await createTestPosition(user1, amount);

      const activeAfterCreate = await xcmProxy.getActivePositions();
      expect(activeAfterCreate.length).to.equal(countBefore + 1);

      await xcmProxy.connect(operator).liquidatePosition(positionId);

      const activeAfterLiquidate = await xcmProxy.getActivePositions();
      expect(activeAfterLiquidate.length).to.equal(countBefore);
    });
  });

  describe("Position Counter", function () {
    it("should increment position counter", async function () {
      const counterBefore = await xcmProxy.positionCounter();
      
      const amount = ethers.parseEther("5");
      await createTestPosition(user1, amount);

      const counterAfter = await xcmProxy.positionCounter();
      expect(counterAfter).to.equal(counterBefore + 1n);
    });

    it("should track total positions created", async function () {
      const initialCounter = await xcmProxy.positionCounter();
      
      const amount = ethers.parseEther("5");
      
      // Create multiple positions
      for (let i = 0; i < 5; i++) {
        await createTestPosition(user1, amount);
      }

      const finalCounter = await xcmProxy.positionCounter();
      expect(finalCounter).to.equal(initialCounter + 5n);
    });
  });

  describe("Supported Tokens Check", function () {
    it("should return true for supported tokens", async function () {
      const wethAddress = await weth.getAddress();
      expect(await xcmProxy.supportedTokens(wethAddress)).to.equal(true);
    });

    it("should return false for unsupported tokens", async function () {
      const randomAddress = "0x9999999999999999999999999999999999999999";
      expect(await xcmProxy.supportedTokens(randomAddress)).to.equal(false);
    });
  });

  describe("Contract Configuration Views", function () {
    it("should return correct operator", async function () {
      expect(await xcmProxy.operator()).to.equal(operator.address);
    });

    it("should return correct owner", async function () {
      expect(await xcmProxy.owner()).to.equal(deployer.address);
    });

    it("should return correct quoter address", async function () {
      const quoterAddress = await xcmProxy.quoterContract();
      expect(quoterAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("should return correct router address", async function () {
      const routerAddress = await xcmProxy.swapRouterContract();
      expect(routerAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("should return test mode status", async function () {
      const testMode = await xcmProxy.testMode();
      expect(testMode).to.equal(true); // Should be true in test environment
    });

    it("should return paused status", async function () {
      const paused = await xcmProxy.paused();
      expect(paused).to.equal(false); // Should not be paused initially
    });

    it("should return default slippage", async function () {
      const slippage = await xcmProxy.defaultSlippageBps();
      expect(slippage).to.be.gte(0);
      expect(slippage).to.be.lte(10000);
    });

    it("should return XCM config", async function () {
      const paraId = await xcmProxy.assetHubParaId();
      const destWeight = await xcmProxy.defaultDestWeight();
      
      expect(paraId).to.be.gt(0);
      expect(destWeight).to.be.gt(0);
    });
  });

  describe("Edge Cases", function () {
    it("should handle querying with zero address", async function () {
      const positions = await xcmProxy.getUserPositions(ethers.ZeroAddress);
      expect(positions.length).to.equal(0);
    });

    it("should handle multiple rapid queries", async function () {
      const amount = ethers.parseEther("5");
      const positionId = await createTestPosition(user1, amount);

      // Query same position multiple times rapidly
      for (let i = 0; i < 10; i++) {
        const position = await xcmProxy.getPosition(positionId);
        expect(position.active).to.equal(true);
      }
    });

    it("should return consistent data across multiple calls", async function () {
      const amount = ethers.parseEther("5");
      const positionId = await createTestPosition(user1, amount);

      const pos1 = await xcmProxy.getPosition(positionId);
      const pos2 = await xcmProxy.getPosition(positionId);

      expect(pos1.user).to.equal(pos2.user);
      expect(pos1.poolId).to.equal(pos2.poolId);
      expect(pos1.nftTokenId).to.equal(pos2.nftTokenId);
      expect(pos1.active).to.equal(pos2.active);
    });
  });
});

