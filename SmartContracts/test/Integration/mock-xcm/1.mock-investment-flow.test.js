/**
 * Mock XCM Integration Test: Investment Flow
 * 
 * Tests full integration WITHOUT real XCM by:
 * 1. Deploying both contracts on same network
 * 2. Manually calling functions that XCM would trigger
 * 3. Simulating state relay between chains
 * 
 * This tests the LOGIC of integration before XCM is ready!
 * 
 * Flow:
 * 1. User deposits to AssetHubVault
 * 2. Operator calls dispatchInvestment (with test mode)
 * 3. MANUALLY call XCMProxy.executeInvestment (simulating XCM arrival)
 * 4. Verify position created on both sides
 * 
 * Usage:
 *   npx hardhat test test/Integration/mock-xcm/1.mock-investment-flow.test.js
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { setupTestEnvironment } = require("../../setup/test-environment");

describe("Mock XCM Integration - Investment Flow", function () {
  let env;
  let assetHubVault, xcmProxy;
  let deployer, user1, operator;
  let algebraFactory, nfpm, router, quoter, weth;
  let tokenA, tokenB, poolAddress;

  before(async function () {
    console.log("\n🔧 Setting up complete test environment...\n");
    
    // Deploy complete environment (both contracts + Algebra)
    env = await setupTestEnvironment({
      deployAlgebra: true,
      deployXCMProxy: true,
      connectToVault: false, // Deploy fresh vault for testing
      testMode: true, // Test mode to skip real XCM
      verbose: true
    });

    assetHubVault = env.vault;
    xcmProxy = env.xcmProxy;
    deployer = env.deployer;
    user1 = env.user1;
    operator = env.operator;
    algebraFactory = env.algebraFactory;
    nfpm = env.nfpm;
    router = env.router;
    quoter = env.quoter;
    weth = env.weth;
    tokenA = env.tokenA;
    tokenB = env.tokenB;

    console.log("\n✅ Environment ready:");
    console.log(`   AssetHubVault: ${await assetHubVault.getAddress()}`);
    console.log(`   XCMProxy: ${await xcmProxy.getAddress()}`);
    console.log(`   Algebra Factory: ${await algebraFactory.getAddress()}`);
    console.log(`   WETH: ${await weth.getAddress()}\n`);

    // Create a pool for testing
    const poolCreation = await env.createAndInitializePool({
      tokenA: await weth.getAddress(),
      tokenB: await tokenB.getAddress(),
      fee: 500
    });

    poolAddress = poolCreation.pool;
    console.log(`   Test Pool: ${poolAddress}\n`);

    // Add liquidity to pool so positions can be created
    await env.addLiquidityToPool({
      pool: poolAddress,
      tokenA: await weth.getAddress(),
      tokenB: await tokenB.getAddress(),
      amount0: ethers.parseEther("100"),
      amount1: ethers.parseEther("100")
    });

    console.log("   ✅ Pool initialized with liquidity\n");
  });

  describe("Complete Mock XCM Investment Flow", function () {
    it("should complete investment flow without real XCM", async function () {
      const depositAmount = ethers.parseEther("10");
      const investmentAmount = ethers.parseEther("5");

      // ===== STEP 1: User deposits to AssetHubVault =====
      console.log("   📥 STEP 1: User deposits to AssetHubVault");
      
      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      
      const userBalance = await assetHubVault.getUserBalance(user1.address);
      expect(userBalance).to.equal(depositAmount);
      console.log(`      ✓ Deposited ${ethers.formatEther(depositAmount)} ETH`);
      console.log(`      ✓ User balance: ${ethers.formatEther(userBalance)} ETH\n`);

      // ===== STEP 2: Operator dispatches investment =====
      console.log("   🚀 STEP 2: Operator dispatches investment (test mode - no XCM)");
      
      const tx = await assetHubVault.connect(operator).dispatchInvestment(
        user1.address,
        1287, // Moonbase chainId (even though we're on same network)
        poolAddress,
        await weth.getAddress(), // base asset
        investmentAmount,
        -1, // -1% lower tick
        1,  // +1% upper tick
        "0x030100001234", // dummy XCM destination
        "0x0300010203"    // dummy XCM message
      );

      const receipt = await tx.wait();
      
      // Extract positionId from event
      const event = receipt.logs.find(log => {
        try {
          return assetHubVault.interface.parseLog(log).name === "InvestmentInitiated";
        } catch {
          return false;
        }
      });

      const positionId = assetHubVault.interface.parseLog(event).args.positionId;
      console.log(`      ✓ Investment dispatched, positionId: ${positionId}`);
      
      // Verify user balance reduced
      const balanceAfterDispatch = await assetHubVault.getUserBalance(user1.address);
      expect(balanceAfterDispatch).to.equal(depositAmount - investmentAmount);
      console.log(`      ✓ User balance reduced to: ${ethers.formatEther(balanceAfterDispatch)} ETH\n`);

      // ===== STEP 3: SIMULATE XCM - Manually call XCMProxy =====
      console.log("   🌉 STEP 3: SIMULATE XCM MESSAGE (manual call to XCMProxy)");
      console.log("      (In production, this would be triggered by XCM message arrival)");
      
      // In real scenario, XCM would send:
      // - amount (investmentAmount)
      // - user address
      // - poolId
      // - baseAsset
      // - tick range
      // - positionId
      
      // Manually fund XCMProxy (simulating XCM asset transfer)
      await deployer.sendTransaction({
        to: await xcmProxy.getAddress(),
        value: investmentAmount
      });
      console.log(`      ✓ Funded XCMProxy with ${ethers.formatEther(investmentAmount)} ETH (simulating XCM transfer)`);

      // Manually call executeInvestment (simulating XCM message handler)
      const executeTx = await xcmProxy.connect(operator).executeInvestment(
        user1.address,
        poolAddress,
        await weth.getAddress(),
        investmentAmount,
        -1, // lowerRangePercent
        1,  // upperRangePercent
        positionId // Same positionId from AssetHubVault
      );

      await executeTx.wait();
      console.log(`      ✓ XCMProxy.executeInvestment called (simulated XCM message)\n`);

      // ===== STEP 4: Verify position created on XCMProxy =====
      console.log("   ✅ STEP 4: Verify position created on Moonbase (XCMProxy)");
      
      const proxyPosition = await xcmProxy.getPosition(positionId);
      expect(proxyPosition.active).to.be.true;
      expect(proxyPosition.user).to.equal(user1.address);
      console.log(`      ✓ Position active: ${proxyPosition.active}`);
      console.log(`      ✓ Position user: ${proxyPosition.user}`);
      console.log(`      ✓ NFT tokenId: ${proxyPosition.nftTokenId.toString()}\n`);

      // ===== STEP 5: Verify position tracked on AssetHubVault =====
      console.log("   ✅ STEP 5: Verify position tracked on Asset Hub (AssetHubVault)");
      
      const vaultPosition = await assetHubVault.getPosition(positionId);
      expect(vaultPosition.active).to.be.true;
      expect(vaultPosition.user).to.equal(user1.address);
      expect(vaultPosition.amount).to.equal(investmentAmount);
      console.log(`      ✓ Position active: ${vaultPosition.active}`);
      console.log(`      ✓ Position amount: ${ethers.formatEther(vaultPosition.amount)} ETH`);
      console.log(`      ✓ Position chainId: ${vaultPosition.chainId}\n`);

      // ===== STEP 6: Verify user positions arrays =====
      console.log("   ✅ STEP 6: Verify user positions arrays");
      
      const vaultUserPositions = await assetHubVault.getUserPositions(user1.address);
      const proxyUserPositions = await xcmProxy.getUserPositions(user1.address);
      
      expect(vaultUserPositions.length).to.be.gt(0);
      expect(proxyUserPositions.length).to.be.gt(0);
      console.log(`      ✓ AssetHubVault: User has ${vaultUserPositions.length} position(s)`);
      console.log(`      ✓ XCMProxy: User has ${proxyUserPositions.length} position(s)\n`);

      console.log("   🎉 INTEGRATION TEST PASSED!");
      console.log("      Both contracts successfully coordinated without real XCM!\n");
    });

    it("should handle multiple positions", async function () {
      const depositAmount = ethers.parseEther("20");
      
      await assetHubVault.connect(user1).deposit({ value: depositAmount });

      // Create 3 positions
      const positionIds = [];
      
      for (let i = 0; i < 3; i++) {
        const investmentAmount = ethers.parseEther("5");
        
        // Dispatch on AssetHub
        const tx = await assetHubVault.connect(operator).dispatchInvestment(
          user1.address,
          1287,
          poolAddress,
          await weth.getAddress(),
          investmentAmount,
          -1,
          1,
          "0x030100001234",
          "0x0300010203"
        );

        const receipt = await tx.wait();
        const event = receipt.logs.find(log => {
          try {
            return assetHubVault.interface.parseLog(log).name === "InvestmentInitiated";
          } catch {
            return false;
          }
        });
        const positionId = assetHubVault.interface.parseLog(event).args.positionId;
        positionIds.push(positionId);

        // Simulate XCM
        await deployer.sendTransaction({
          to: await xcmProxy.getAddress(),
          value: investmentAmount
        });

        await xcmProxy.connect(operator).executeInvestment(
          user1.address,
          poolAddress,
          await weth.getAddress(),
          investmentAmount,
          -1,
          1,
          positionId
        );

        // Small delay to ensure different block.timestamp for unique positionIds
        await ethers.provider.send("evm_mine");
      }

      // Verify all positions exist
      const vaultUserPositions = await assetHubVault.getUserPositions(user1.address);
      const proxyUserPositions = await xcmProxy.getUserPositions(user1.address);

      expect(vaultUserPositions.length).to.be.gte(3);
      expect(proxyUserPositions.length).to.be.gte(3);

      console.log(`   ✓ Created 3 positions successfully`);
      console.log(`   ✓ AssetHub tracking: ${vaultUserPositions.length} positions`);
      console.log(`   ✓ Moonbase tracking: ${proxyUserPositions.length} positions`);
    });

    it("should validate parameters on both sides", async function () {
      await assetHubVault.connect(user1).deposit({ value: ethers.parseEther("10") });

      // Test: Invalid range (lower >= upper)
      await expect(
        assetHubVault.connect(operator).dispatchInvestment(
          user1.address,
          1287,
          poolAddress,
          await weth.getAddress(),
          ethers.parseEther("1"),
          5,  // lower
          5,  // upper (invalid!)
          "0x030100001234",
          "0x0300010203"
        )
      ).to.be.revertedWithCustomError(assetHubVault, "InvalidRange");

      // Test: Zero amount
      await expect(
        assetHubVault.connect(operator).dispatchInvestment(
          user1.address,
          1287,
          poolAddress,
          await weth.getAddress(),
          0, // zero amount!
          -1,
          1,
          "0x030100001234",
          "0x0300010203"
        )
      ).to.be.revertedWithCustomError(assetHubVault, "AmountZero");

      console.log("   ✓ Parameter validation working on AssetHubVault");
    });

    it("should emit correct events on both contracts", async function () {
      const depositAmount = ethers.parseEther("10");
      const investmentAmount = ethers.parseEther("5");

      await assetHubVault.connect(user1).deposit({ value: depositAmount });

      // Check AssetHubVault events
      await expect(
        assetHubVault.connect(operator).dispatchInvestment(
          user1.address,
          1287,
          poolAddress,
          await weth.getAddress(),
          investmentAmount,
          -1,
          1,
          "0x030100001234",
          "0x0300010203"
        )
      )
        .to.emit(assetHubVault, "InvestmentInitiated")
        .to.emit(assetHubVault, "BalanceChanged");

      // Get positionId for XCMProxy call
      const positions = await assetHubVault.getUserPositions(user1.address);
      const positionId = positions[positions.length - 1].positionId;

      // Simulate XCM
      await deployer.sendTransaction({
        to: await xcmProxy.getAddress(),
        value: investmentAmount
      });

      // Check XCMProxy events
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
      )
        .to.emit(xcmProxy, "PositionCreated");

      console.log("   ✓ Events emitted correctly on both contracts");
    });
  });

  describe("State Consistency", function () {
    it("should maintain consistent state across both contracts", async function () {
      const depositAmount = ethers.parseEther("10");
      const investmentAmount = ethers.parseEther("5");

      await assetHubVault.connect(user1).deposit({ value: depositAmount });

      // Create position
      const tx = await assetHubVault.connect(operator).dispatchInvestment(
        user1.address,
        1287,
        poolAddress,
        await weth.getAddress(),
        investmentAmount,
        -1,
        1,
        "0x030100001234",
        "0x0300010203"
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return assetHubVault.interface.parseLog(log).name === "InvestmentInitiated";
        } catch {
          return false;
        }
      });
      const positionId = assetHubVault.interface.parseLog(event).args.positionId;

      // Simulate XCM
      await deployer.sendTransaction({
        to: await xcmProxy.getAddress(),
        value: investmentAmount
      });

      await xcmProxy.connect(operator).executeInvestment(
        user1.address,
        poolAddress,
        await weth.getAddress(),
        investmentAmount,
        -1,
        1,
        positionId
      );

      // Verify state matches
      const vaultPosition = await assetHubVault.getPosition(positionId);
      const proxyPosition = await xcmProxy.getPosition(positionId);

      expect(vaultPosition.user).to.equal(proxyPosition.user);
      expect(vaultPosition.active).to.equal(proxyPosition.active);
      expect(vaultPosition.poolId).to.equal(proxyPosition.poolId);
      expect(vaultPosition.amount).to.equal(investmentAmount);

      console.log("   ✓ State is consistent between AssetHub and Moonbase");
      console.log(`      Position ID: ${positionId}`);
      console.log(`      User (both): ${vaultPosition.user}`);
      console.log(`      Active (both): ${vaultPosition.active}`);
      console.log(`      Pool (both): ${vaultPosition.poolId}`);
    });
  });

  describe("Error Handling", function () {
    it("should handle insufficient balance on AssetHub", async function () {
      await assetHubVault.connect(user1).deposit({ value: ethers.parseEther("1") });

      await expect(
        assetHubVault.connect(operator).dispatchInvestment(
          user1.address,
          1287,
          poolAddress,
          await weth.getAddress(),
          ethers.parseEther("100"), // Too much!
          -1,
          1,
          "0x030100001234",
          "0x0300010203"
        )
      ).to.be.revertedWithCustomError(assetHubVault, "InsufficientBalance");
    });

    it("should handle invalid pool on Moonbase", async function () {
      await assetHubVault.connect(user1).deposit({ value: ethers.parseEther("10") });

      const tx = await assetHubVault.connect(operator).dispatchInvestment(
        user1.address,
        1287,
        poolAddress,
        await weth.getAddress(),
        ethers.parseEther("5"),
        -1,
        1,
        "0x030100001234",
        "0x0300010203"
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return assetHubVault.interface.parseLog(log).name === "InvestmentInitiated";
        } catch {
          return false;
        }
      });
      const positionId = assetHubVault.interface.parseLog(event).args.positionId;

      // Simulate XCM
      await deployer.sendTransaction({
        to: await xcmProxy.getAddress(),
        value: ethers.parseEther("5")
      });

      // Try with invalid pool address
      await expect(
        xcmProxy.connect(operator).executeInvestment(
          user1.address,
          ethers.ZeroAddress, // Invalid pool!
          await weth.getAddress(),
          ethers.parseEther("5"),
          -1,
          1,
          positionId
        )
      ).to.be.reverted; // Contract will revert on invalid pool
    });
  });
});

