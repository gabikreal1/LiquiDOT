/**
 * XCMProxy Investment Execution Tests
 * 
 * Covers TEST-XP-018 to TEST-XP-023 from TESTING-REQUIREMENTS.md
 * 
 * Tests:
 * - Investment execution
 * - LP position creation
 * - Parameter validation
 * - Slippage application
 * - Position storage
 * 
 * Usage:
 *   npx hardhat test test/XCMProxy/4.investment.test.js
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { setupTestEnvironment } = require("../setup/test-environment");

describe("XCMProxy - Investment Execution", function () {
  let env;
  let xcmProxy, nfpm, weth, tokenB, poolAddress;
  let deployer, operator, user1;

  before(async function () {
    console.log("\n🔧 Setting up test environment for XCMProxy investment tests...\n");
    
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

    // Create and initialize a pool
    const poolCreation = await env.createAndInitializePool({
      tokenA: await weth.getAddress(),
      tokenB: await tokenB.getAddress(),
      fee: 500
    });

    poolAddress = poolCreation.pool;

    // Add substantial liquidity
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

    console.log("   ✅ Environment ready for investment tests\n");
  });

  /**
   * TEST-XP-018: executeInvestment creates LP position
   */
  describe("TEST-XP-018: Create LP position", function () {
    it("should create LP position successfully", async function () {
      const investmentAmount = ethers.parseEther("10");
      
      // Fund XCMProxy
      await deployer.sendTransaction({
        to: await xcmProxy.getAddress(),
        value: investmentAmount
      });

      const positionCounterBefore = await xcmProxy.positionCounter();
      
      // Execute investment
      const tx = await xcmProxy.connect(operator).executeInvestment(
        user1.address,
        poolAddress,
        await weth.getAddress(),
        investmentAmount,
        -5, // -5% lower tick
        5,  // +5% upper tick
        "0x1234567890123456789012345678901234567890123456789012345678901234" // positionId
      );

      const receipt = await tx.wait();
      
      // Verify position counter incremented
      const positionCounterAfter = await xcmProxy.positionCounter();
      expect(positionCounterAfter).to.equal(positionCounterBefore + 1n);

      console.log(`   ✓ Position created, counter: ${positionCounterBefore} → ${positionCounterAfter}`);
    });

    it("should emit PositionCreated event", async function () {
      const investmentAmount = ethers.parseEther("5");
      const positionId = "0xabcdef1234567890123456789012345678901234567890123456789012345678";
      
      await deployer.sendTransaction({
        to: await xcmProxy.getAddress(),
        value: investmentAmount
      });

      await expect(
        xcmProxy.connect(operator).executeInvestment(
          user1.address,
          poolAddress,
          await weth.getAddress(),
          investmentAmount,
          -5,
          5,
          positionId
        )
      )
        .to.emit(xcmProxy, "PositionCreated");
    });

    it("should handle native token (WETH) investment", async function () {
      const investmentAmount = ethers.parseEther("10");
      
      await deployer.sendTransaction({
        to: await xcmProxy.getAddress(),
        value: investmentAmount
      });

      const positionId = "0x2234567890123456789012345678901234567890123456789012345678901234";
      
      await expect(
        xcmProxy.connect(operator).executeInvestment(
          user1.address,
          poolAddress,
          await weth.getAddress(),
          investmentAmount,
          -5,
          5,
          positionId
        )
      ).to.not.be.reverted;
    });

    it("should create position with correct user", async function () {
      const investmentAmount = ethers.parseEther("5");
      const positionId = "0x3334567890123456789012345678901234567890123456789012345678901234";
      
      await deployer.sendTransaction({
        to: await xcmProxy.getAddress(),
        value: investmentAmount
      });

      await xcmProxy.connect(operator).executeInvestment(
        user1.address,
        poolAddress,
        await weth.getAddress(),
        investmentAmount,
        -5,
        5,
        positionId
      );

      const position = await xcmProxy.getPosition(positionId);
      expect(position.user).to.equal(user1.address);
      expect(position.active).to.equal(true);
    });
  });

  /**
   * TEST-XP-019: executeInvestment validates parameters
   */
  describe("TEST-XP-019: Parameter validation", function () {
    it("should revert on invalid range (lower >= upper)", async function () {
      const investmentAmount = ethers.parseEther("5");
      const positionId = "0x4434567890123456789012345678901234567890123456789012345678901234";
      
      await deployer.sendTransaction({
        to: await xcmProxy.getAddress(),
        value: investmentAmount
      });

      await expect(
        xcmProxy.connect(operator).executeInvestment(
          user1.address,
          poolAddress,
          await weth.getAddress(),
          investmentAmount,
          5,  // lower
          5,  // upper (invalid: equal)
          positionId
        )
      ).to.be.revertedWith("range out of bounds");
    });

    it("should revert on zero position owner", async function () {
      const investmentAmount = ethers.parseEther("5");
      const positionId = "0x5534567890123456789012345678901234567890123456789012345678901234";
      
      await deployer.sendTransaction({
        to: await xcmProxy.getAddress(),
        value: investmentAmount
      });

      await expect(
        xcmProxy.connect(operator).executeInvestment(
          ethers.ZeroAddress, // Invalid!
          poolAddress,
          await weth.getAddress(),
          investmentAmount,
          -5,
          5,
          positionId
        )
      ).to.be.revertedWithCustomError(xcmProxy, "ZeroAddress");
    });

    it("should revert on unsupported base asset", async function () {
      const unsupportedToken = "0x9999999999999999999999999999999999999999";
      const investmentAmount = ethers.parseEther("5");
      const positionId = "0x6634567890123456789012345678901234567890123456789012345678901234";
      
      await deployer.sendTransaction({
        to: await xcmProxy.getAddress(),
        value: investmentAmount
      });

      await expect(
        xcmProxy.connect(operator).executeInvestment(
          user1.address,
          poolAddress,
          unsupportedToken, // Not supported!
          investmentAmount,
          -5,
          5,
          positionId
        )
      ).to.be.revertedWith("Token not supported");
    });

    it("should revert on zero amount", async function () {
      const positionId = "0x7734567890123456789012345678901234567890123456789012345678901234";
      
      await expect(
        xcmProxy.connect(operator).executeInvestment(
          user1.address,
          poolAddress,
          await weth.getAddress(),
          0, // Zero amount!
          -5,
          5,
          positionId
        )
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("should revert on out-of-bounds range (too low)", async function () {
      const investmentAmount = ethers.parseEther("5");
      const positionId = "0x8834567890123456789012345678901234567890123456789012345678901234";
      
      await deployer.sendTransaction({
        to: await xcmProxy.getAddress(),
        value: investmentAmount
      });

      await expect(
        xcmProxy.connect(operator).executeInvestment(
          user1.address,
          poolAddress,
          await weth.getAddress(),
          investmentAmount,
          -1001, // Out of bounds!
          5,
          positionId
        )
      ).to.be.revertedWith("range out of bounds");
    });

    it("should revert on out-of-bounds range (too high)", async function () {
      const investmentAmount = ethers.parseEther("5");
      const positionId = "0x9934567890123456789012345678901234567890123456789012345678901234";
      
      await deployer.sendTransaction({
        to: await xcmProxy.getAddress(),
        value: investmentAmount
      });

      await expect(
        xcmProxy.connect(operator).executeInvestment(
          user1.address,
          poolAddress,
          await weth.getAddress(),
          investmentAmount,
          -5,
          1001, // Out of bounds!
          positionId
        )
      ).to.be.revertedWith("range out of bounds");
    });

    it("should revert on insufficient contract balance", async function () {
      const positionId = "0xaa34567890123456789012345678901234567890123456789012345678901234";
      
      // Don't fund the contract
      
      await expect(
        xcmProxy.connect(operator).executeInvestment(
          user1.address,
          poolAddress,
          await weth.getAddress(),
          ethers.parseEther("100"), // Contract doesn't have this much
          -5,
          5,
          positionId
        )
      ).to.be.revertedWith("insufficient base funding");
    });
  });

  /**
   * TEST-XP-021: Position stored with correct data
   */
  describe("TEST-XP-021: Position storage", function () {
    it("should store position with correct pool", async function () {
      const investmentAmount = ethers.parseEther("10");
      const positionId = "0xbb34567890123456789012345678901234567890123456789012345678901234";
      
      await deployer.sendTransaction({
        to: await xcmProxy.getAddress(),
        value: investmentAmount
      });

      await xcmProxy.connect(operator).executeInvestment(
        user1.address,
        poolAddress,
        await weth.getAddress(),
        investmentAmount,
        -5,
        5,
        positionId
      );

      const position = await xcmProxy.getPosition(positionId);
      expect(position.poolId).to.equal(poolAddress);
    });

    it("should store position with correct tokens", async function () {
      const investmentAmount = ethers.parseEther("10");
      const positionId = "0xcc34567890123456789012345678901234567890123456789012345678901234";
      
      await deployer.sendTransaction({
        to: await xcmProxy.getAddress(),
        value: investmentAmount
      });

      await xcmProxy.connect(operator).executeInvestment(
        user1.address,
        poolAddress,
        await weth.getAddress(),
        investmentAmount,
        -5,
        5,
        positionId
      );

      const position = await xcmProxy.getPosition(positionId);
      
      // Should store token0 and token1 from the pool
      expect(position.token0).to.not.equal(ethers.ZeroAddress);
      expect(position.token1).to.not.equal(ethers.ZeroAddress);
    });

    it("should store position as active", async function () {
      const investmentAmount = ethers.parseEther("10");
      const positionId = "0xdd34567890123456789012345678901234567890123456789012345678901234";
      
      await deployer.sendTransaction({
        to: await xcmProxy.getAddress(),
        value: investmentAmount
      });

      await xcmProxy.connect(operator).executeInvestment(
        user1.address,
        poolAddress,
        await weth.getAddress(),
        investmentAmount,
        -5,
        5,
        positionId
      );

      const position = await xcmProxy.getPosition(positionId);
      expect(position.active).to.equal(true);
    });

    it("should store NFT token ID", async function () {
      const investmentAmount = ethers.parseEther("10");
      const positionId = "0xee34567890123456789012345678901234567890123456789012345678901234";
      
      await deployer.sendTransaction({
        to: await xcmProxy.getAddress(),
        value: investmentAmount
      });

      await xcmProxy.connect(operator).executeInvestment(
        user1.address,
        poolAddress,
        await weth.getAddress(),
        investmentAmount,
        -5,
        5,
        positionId
      );

      const position = await xcmProxy.getPosition(positionId);
      expect(position.nftTokenId).to.be.gt(0);
      
      console.log(`   ✓ NFT Token ID: ${position.nftTokenId}`);
    });

    it("should store timestamp", async function () {
      const investmentAmount = ethers.parseEther("10");
      const positionId = "0xff34567890123456789012345678901234567890123456789012345678901234";
      
      await deployer.sendTransaction({
        to: await xcmProxy.getAddress(),
        value: investmentAmount
      });

      const blockBefore = await ethers.provider.getBlock('latest');
      
      await xcmProxy.connect(operator).executeInvestment(
        user1.address,
        poolAddress,
        await weth.getAddress(),
        investmentAmount,
        -5,
        5,
        positionId
      );

      const position = await xcmProxy.getPosition(positionId);
      expect(position.timestamp).to.be.gte(blockBefore.timestamp);
    });
  });

  /**
   * TEST-XP-022: User positions array updated
   */
  describe("TEST-XP-022: User positions tracking", function () {
    it("should add position to user's positions array", async function () {
      const investmentAmount = ethers.parseEther("10");
      const positionId = "0x1134567890123456789012345678901234567890123456789012345678901234";
      
      const positionsBefore = await xcmProxy.getUserPositions(user1.address);
      
      await deployer.sendTransaction({
        to: await xcmProxy.getAddress(),
        value: investmentAmount
      });

      await xcmProxy.connect(operator).executeInvestment(
        user1.address,
        poolAddress,
        await weth.getAddress(),
        investmentAmount,
        -5,
        5,
        positionId
      );

      const positionsAfter = await xcmProxy.getUserPositions(user1.address);
      expect(positionsAfter.length).to.equal(positionsBefore.length + 1);
    });

    it("should track multiple positions for same user", async function () {
      const user = deployer; // Use deployer for this test
      const positionsBefore = await xcmProxy.getUserPositions(user.address);
      
      // Create 3 positions
      for (let i = 0; i < 3; i++) {
        const investmentAmount = ethers.parseEther("5");
        const positionId = ethers.solidityPackedKeccak256(
          ["string", "uint256"],
          ["test-position", Date.now() + i]
        );
        
        await deployer.sendTransaction({
          to: await xcmProxy.getAddress(),
          value: investmentAmount
        });

        await xcmProxy.connect(operator).executeInvestment(
          user.address,
          poolAddress,
          await weth.getAddress(),
          investmentAmount,
          -5,
          5,
          positionId
        );

        await ethers.provider.send("evm_mine");
      }

      const positionsAfter = await xcmProxy.getUserPositions(user.address);
      expect(positionsAfter.length).to.equal(positionsBefore.length + 3);
    });
  });

  /**
   * TEST-XP-023: Slippage applied correctly
   */
  describe("TEST-XP-023: Slippage application", function () {
    it("should apply default slippage to amounts", async function () {
      // Default slippage is 50 bps (0.5%)
      const defaultSlippage = await xcmProxy.defaultSlippageBps();
      expect(defaultSlippage).to.equal(50);

      const investmentAmount = ethers.parseEther("100");
      const positionId = "0x2234567890123456789012345678901234567890123456789012345678901235";
      
      await deployer.sendTransaction({
        to: await xcmProxy.getAddress(),
        value: investmentAmount
      });

      // Execute investment - slippage is applied internally
      await expect(
        xcmProxy.connect(operator).executeInvestment(
          user1.address,
          poolAddress,
          await weth.getAddress(),
          investmentAmount,
          -5,
          5,
          positionId
        )
      ).to.not.be.reverted;

      // If slippage was applied correctly, the position should be created
      const position = await xcmProxy.getPosition(positionId);
      expect(position.active).to.equal(true);
    });

    it("should use custom slippage when set", async function () {
      // Set custom slippage
      const customSlippage = 100; // 1%
      await xcmProxy.connect(deployer).setDefaultSlippage(customSlippage);
      
      expect(await xcmProxy.defaultSlippageBps()).to.equal(customSlippage);

      const investmentAmount = ethers.parseEther("100");
      const positionId = "0x3334567890123456789012345678901234567890123456789012345678901235";
      
      await deployer.sendTransaction({
        to: await xcmProxy.getAddress(),
        value: investmentAmount
      });

      await expect(
        xcmProxy.connect(operator).executeInvestment(
          user1.address,
          poolAddress,
          await weth.getAddress(),
          investmentAmount,
          -5,
          5,
          positionId
        )
      ).to.not.be.reverted;
    });
  });

  describe("Additional Investment Tests", function () {
    it("should handle asymmetric ranges", async function () {
      const investmentAmount = ethers.parseEther("10");
      const positionId = "0x4434567890123456789012345678901234567890123456789012345678901235";
      
      await deployer.sendTransaction({
        to: await xcmProxy.getAddress(),
        value: investmentAmount
      });

      // Asymmetric: -2% to +10%
      await expect(
        xcmProxy.connect(operator).executeInvestment(
          user1.address,
          poolAddress,
          await weth.getAddress(),
          investmentAmount,
          -2,
          10,
          positionId
        )
      ).to.not.be.reverted;
    });

    it("should handle wide ranges", async function () {
      const investmentAmount = ethers.parseEther("10");
      const positionId = "0x5534567890123456789012345678901234567890123456789012345678901235";
      
      await deployer.sendTransaction({
        to: await xcmProxy.getAddress(),
        value: investmentAmount
      });

      // Wide range: -50% to +50%
      await expect(
        xcmProxy.connect(operator).executeInvestment(
          user1.address,
          poolAddress,
          await weth.getAddress(),
          investmentAmount,
          -50,
          50,
          positionId
        )
      ).to.not.be.reverted;
    });

    it("should handle narrow ranges", async function () {
      const investmentAmount = ethers.parseEther("10");
      const positionId = "0x6634567890123456789012345678901234567890123456789012345678901235";
      
      await deployer.sendTransaction({
        to: await xcmProxy.getAddress(),
        value: investmentAmount
      });

      // Narrow range: -1% to +1%
      await expect(
        xcmProxy.connect(operator).executeInvestment(
          user1.address,
          poolAddress,
          await weth.getAddress(),
          investmentAmount,
          -1,
          1,
          positionId
        )
      ).to.not.be.reverted;
    });
  });
});

