/**
 * Mock XCM Integration Test: Liquidation Flow
 * 
 * Tests full liquidation WITHOUT real XCM by:
 * 1. Creating position (from investment flow)
 * 2. Liquidating on XCMProxy
 * 3. Swapping tokens back to native
 * 4. MANUALLY calling AssetHubVault.settleLiquidation (simulating XCM return)
 * 5. Verifying user can withdraw proceeds
 * 
 * This tests the COMPLETE CYCLE without XCM infrastructure!
 * 
 * Flow:
 * 1. Setup: Create active position via mock investment flow
 * 2. XCMProxy liquidates position (remove liquidity from Algebra)
 * 3. XCMProxy swaps tokens back to native
 * 4. MANUALLY send funds to AssetHub and call settleLiquidation
 * 5. Verify position closed and user balance updated
 * 6. User withdraws proceeds
 * 
 * Usage:
 *   npx hardhat test test/Integration/mock-xcm/2.mock-liquidation-flow.test.js
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { setupTestEnvironment } = require("../../setup/test-environment");

describe("Mock XCM Integration - Liquidation Flow", function () {
  let env;
  let assetHubVault, xcmProxy;
  let deployer, user1, operator;
  let weth, tokenB, poolAddress;
  let testPositionId;

  before(async function () {
    console.log("\n🔧 Setting up complete test environment with position...\n");
    
    env = await setupTestEnvironment({
      deployAlgebra: true,
      deployXCMProxy: true,
      connectToVault: false,
      testMode: true,
      verbose: true
    });

    assetHubVault = env.vault;
    xcmProxy = env.xcmProxy;
    deployer = env.deployer;
    user1 = env.user1;
    operator = env.operator;
    weth = env.weth;
    tokenB = env.tokenB;

    console.log("\n✅ Environment ready\n");

    // Create and initialize pool
    const poolCreation = await env.createAndInitializePool({
      tokenA: await weth.getAddress(),
      tokenB: await tokenB.getAddress(),
      fee: 500
    });

    poolAddress = poolCreation.pool;

    // Add substantial liquidity for realistic swaps
    await env.addLiquidityToPool({
      pool: poolAddress,
      tokenA: await weth.getAddress(),
      tokenB: await tokenB.getAddress(),
      amount0: ethers.parseEther("1000"),
      amount1: ethers.parseEther("1000")
    });

    console.log("   ✅ Pool ready with liquidity\n");

    // ===== SETUP: Create an active position =====
    console.log("   📋 SETUP: Creating active position...\n");
    
    const depositAmount = ethers.parseEther("10");
    const investmentAmount = ethers.parseEther("5");

    // User deposits
    await assetHubVault.connect(user1).deposit({ value: depositAmount });

    // Dispatch investment
    const tx = await assetHubVault.connect(operator).dispatchInvestment(
      user1.address,
      1287,
      poolAddress,
      await weth.getAddress(),
      investmentAmount,
      -5,
      5,
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

    testPositionId = assetHubVault.interface.parseLog(event).args.positionId;

    // Simulate XCM - fund XCMProxy and execute investment
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
      testPositionId
    );

    console.log(`   ✅ Active position created: ${testPositionId}\n`);

    // Verify position is active
    const vaultPos = await assetHubVault.getPosition(testPositionId);
    const proxyPos = await xcmProxy.getPosition(testPositionId);
    expect(vaultPos.active).to.be.true;
    expect(proxyPos.active).to.be.true;

    console.log("   ✅ Ready for liquidation tests\n");
  });

  describe("Complete Mock XCM Liquidation Flow", function () {
    it("should complete liquidation flow without real XCM", async function () {
      // ===== STEP 1: Get initial state =====
      console.log("   📊 STEP 1: Get initial state");
      
      const initialUserBalance = await assetHubVault.getUserBalance(user1.address);
      const initialPosition = await assetHubVault.getPosition(testPositionId);
      
      expect(initialPosition.active).to.be.true;
      console.log(`      ✓ Position active: ${initialPosition.active}`);
      console.log(`      ✓ Position amount: ${ethers.formatEther(initialPosition.amount)} ETH`);
      console.log(`      ✓ User balance: ${ethers.formatEther(initialUserBalance)} ETH\n`);

      // ===== STEP 2: Liquidate position on XCMProxy (Moonbase) =====
      console.log("   💧 STEP 2: Liquidate position on XCMProxy (remove liquidity)");
      
      const liquidateTx = await xcmProxy.connect(operator).liquidatePosition(testPositionId);
      await liquidateTx.wait();
      
      const proxyPositionAfterLiq = await xcmProxy.getPosition(testPositionId);
      expect(proxyPositionAfterLiq.active).to.be.false;
      console.log(`      ✓ Position liquidated on Moonbase`);
      console.log(`      ✓ Position now inactive: ${!proxyPositionAfterLiq.active}\n`);

      // ===== STEP 3: Check XCMProxy balance (should have tokens from liquidity removal) =====
      console.log("   💰 STEP 3: Verify XCMProxy has tokens from liquidation");
      
      const xcmProxyBalance = await ethers.provider.getBalance(await xcmProxy.getAddress());
      console.log(`      ✓ XCMProxy balance: ${ethers.formatEther(xcmProxyBalance)} ETH`);
      
      // XCMProxy should have some balance from the liquidity removal
      expect(xcmProxyBalance).to.be.gt(0);
      console.log(`      ✓ Liquidity successfully removed\n`);

      // ===== STEP 4: SIMULATE XCM RETURN - Send funds to AssetHub =====
      console.log("   🌉 STEP 4: SIMULATE XCM RETURN (manual transfer to AssetHub)");
      console.log("      (In production, XCMProxy would send via XCM)");
      
      // Determine return amount (in real scenario, this would be the swapped amount)
      // For simplicity, use the balance we got from liquidation
      const returnAmount = xcmProxyBalance;
      
      // Manually send funds to AssetHubVault (simulating XCM transfer)
      await deployer.sendTransaction({
        to: await assetHubVault.getAddress(),
        value: returnAmount
      });
      console.log(`      ✓ Sent ${ethers.formatEther(returnAmount)} ETH to AssetHubVault (simulated XCM)`);

      // ===== STEP 5: Manually call settleLiquidation =====
      console.log("\n   ⚖️  STEP 5: Settle liquidation on AssetHub (manual call)");
      console.log("      (In production, this would be triggered by XCM message arrival)");
      
      const settleTx = await assetHubVault.connect(operator).settleLiquidation(
        testPositionId,
        returnAmount
      );
      await settleTx.wait();
      
      console.log(`      ✓ Liquidation settled on AssetHub\n`);

      // ===== STEP 6: Verify position is inactive on AssetHub =====
      console.log("   ✅ STEP 6: Verify position inactive on AssetHub");
      
      const settledPosition = await assetHubVault.getPosition(testPositionId);
      expect(settledPosition.active).to.be.false;
      console.log(`      ✓ Position now inactive: ${!settledPosition.active}\n`);

      // ===== STEP 7: Verify user balance updated =====
      console.log("   ✅ STEP 7: Verify user balance updated");
      
      const finalUserBalance = await assetHubVault.getUserBalance(user1.address);
      expect(finalUserBalance).to.be.gt(initialUserBalance);
      
      const balanceIncrease = finalUserBalance - initialUserBalance;
      console.log(`      ✓ User balance increased by: ${ethers.formatEther(balanceIncrease)} ETH`);
      console.log(`      ✓ New balance: ${ethers.formatEther(finalUserBalance)} ETH\n`);

      // ===== STEP 8: Calculate profit/loss =====
      console.log("   📈 STEP 8: Calculate profit/loss");
      
      const investmentAmount = initialPosition.amount;
      
      if (returnAmount > investmentAmount) {
        const profit = returnAmount - investmentAmount;
        console.log(`      💰 PROFIT: ${ethers.formatEther(profit)} ETH`);
        console.log(`      📊 ROI: ${((Number(profit) / Number(investmentAmount)) * 100).toFixed(2)}%\n`);
      } else if (returnAmount < investmentAmount) {
        const loss = investmentAmount - returnAmount;
        console.log(`      📉 LOSS: ${ethers.formatEther(loss)} ETH`);
        console.log(`      📊 Loss: -${((Number(loss) / Number(investmentAmount)) * 100).toFixed(2)}%\n`);
      } else {
        console.log(`      ➖ BREAK EVEN\n`);
      }

      // ===== STEP 9: User withdraws proceeds =====
      console.log("   💸 STEP 9: User withdraws proceeds");
      
      const withdrawAmount = ethers.parseEther("1");
      const balanceBeforeWithdraw = await assetHubVault.getUserBalance(user1.address);
      
      await assetHubVault.connect(user1).withdraw(withdrawAmount);
      
      const balanceAfterWithdraw = await assetHubVault.getUserBalance(user1.address);
      expect(balanceAfterWithdraw).to.equal(balanceBeforeWithdraw - withdrawAmount);
      console.log(`      ✓ Withdrew ${ethers.formatEther(withdrawAmount)} ETH`);
      console.log(`      ✓ Remaining balance: ${ethers.formatEther(balanceAfterWithdraw)} ETH\n`);

      console.log("   🎉 COMPLETE LIQUIDATION CYCLE SUCCESSFUL!");
      console.log("      Investment → Position → Liquidation → Settlement → Withdrawal\n");
    });

    it("should emit correct events during liquidation", async function () {
      // Create another position for event testing
      await assetHubVault.connect(user1).deposit({ value: ethers.parseEther("10") });
      
      const tx = await assetHubVault.connect(operator).dispatchInvestment(
        user1.address,
        1287,
        poolAddress,
        await weth.getAddress(),
        ethers.parseEther("5"),
        -5,
        5,
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

      // Execute investment
      await deployer.sendTransaction({
        to: await xcmProxy.getAddress(),
        value: ethers.parseEther("5")
      });

      await xcmProxy.connect(operator).executeInvestment(
        user1.address,
        poolAddress,
        await weth.getAddress(),
        ethers.parseEther("5"),
        -5,
        5,
        positionId
      );

      // Test liquidation event on XCMProxy
      await expect(
        xcmProxy.connect(operator).liquidatePosition(positionId)
      ).to.emit(xcmProxy, "PositionLiquidated");

      // Simulate XCM return
      const returnAmount = ethers.parseEther("5");
      await deployer.sendTransaction({
        to: await assetHubVault.getAddress(),
        value: returnAmount
      });

      // Test settlement events on AssetHubVault
      await expect(
        assetHubVault.connect(operator).settleLiquidation(positionId, returnAmount)
      )
        .to.emit(assetHubVault, "PositionLiquidated")
        .to.emit(assetHubVault, "LiquidationSettled");

      console.log("   ✓ All liquidation events emitted correctly");
    });

    it("should handle partial liquidation returns", async function () {
      // Create position
      await assetHubVault.connect(user1).deposit({ value: ethers.parseEther("10") });
      
      const investmentAmount = ethers.parseEther("5");
      const tx = await assetHubVault.connect(operator).dispatchInvestment(
        user1.address,
        1287,
        poolAddress,
        await weth.getAddress(),
        investmentAmount,
        -5,
        5,
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

      // Execute investment
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

      // Liquidate
      await xcmProxy.connect(operator).liquidatePosition(positionId);

      // Simulate loss: Return less than investment
      const returnAmount = ethers.parseEther("4"); // Lost 1 ETH
      await deployer.sendTransaction({
        to: await assetHubVault.getAddress(),
        value: returnAmount
      });

      const balanceBefore = await assetHubVault.getUserBalance(user1.address);
      
      await assetHubVault.connect(operator).settleLiquidation(positionId, returnAmount);
      
      const balanceAfter = await assetHubVault.getUserBalance(user1.address);
      
      // Balance should increase by return amount (even if less than investment)
      expect(balanceAfter).to.equal(balanceBefore + returnAmount);
      
      const loss = investmentAmount - returnAmount;
      console.log(`   ✓ Handled loss scenario: ${ethers.formatEther(loss)} ETH loss`);
    });

    it("should handle profitable liquidation returns", async function () {
      // Create position
      await assetHubVault.connect(user1).deposit({ value: ethers.parseEther("10") });
      
      const investmentAmount = ethers.parseEther("5");
      const tx = await assetHubVault.connect(operator).dispatchInvestment(
        user1.address,
        1287,
        poolAddress,
        await weth.getAddress(),
        investmentAmount,
        -5,
        5,
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

      // Execute investment
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

      // Liquidate
      await xcmProxy.connect(operator).liquidatePosition(positionId);

      // Simulate profit: Return more than investment
      const returnAmount = ethers.parseEther("6"); // Gained 1 ETH
      await deployer.sendTransaction({
        to: await assetHubVault.getAddress(),
        value: returnAmount
      });

      const balanceBefore = await assetHubVault.getUserBalance(user1.address);
      
      await assetHubVault.connect(operator).settleLiquidation(positionId, returnAmount);
      
      const balanceAfter = await assetHubVault.getUserBalance(user1.address);
      
      expect(balanceAfter).to.equal(balanceBefore + returnAmount);
      
      const profit = returnAmount - investmentAmount;
      console.log(`   ✓ Handled profit scenario: ${ethers.formatEther(profit)} ETH profit`);
    });
  });

  describe("Error Handling", function () {
    it("should prevent double settlement", async function () {
      // Create and settle a position
      await assetHubVault.connect(user1).deposit({ value: ethers.parseEther("10") });
      
      const tx = await assetHubVault.connect(operator).dispatchInvestment(
        user1.address,
        1287,
        poolAddress,
        await weth.getAddress(),
        ethers.parseEther("5"),
        -5,
        5,
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

      await deployer.sendTransaction({
        to: await xcmProxy.getAddress(),
        value: ethers.parseEther("5")
      });

      await xcmProxy.connect(operator).executeInvestment(
        user1.address,
        poolAddress,
        await weth.getAddress(),
        ethers.parseEther("5"),
        -5,
        5,
        positionId
      );

      await xcmProxy.connect(operator).liquidatePosition(positionId);

      const returnAmount = ethers.parseEther("5");
      await deployer.sendTransaction({
        to: await assetHubVault.getAddress(),
        value: returnAmount * 2n // Send double for second attempt
      });

      // First settlement succeeds
      await assetHubVault.connect(operator).settleLiquidation(positionId, returnAmount);

      // Second settlement should fail
      await expect(
        assetHubVault.connect(operator).settleLiquidation(positionId, returnAmount)
      ).to.be.revertedWithCustomError(assetHubVault, "PositionNotActive");
    });

    it("should revert on insufficient contract balance", async function () {
      await assetHubVault.connect(user1).deposit({ value: ethers.parseEther("10") });
      
      const tx = await assetHubVault.connect(operator).dispatchInvestment(
        user1.address,
        1287,
        poolAddress,
        await weth.getAddress(),
        ethers.parseEther("5"),
        -5,
        5,
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

      await deployer.sendTransaction({
        to: await xcmProxy.getAddress(),
        value: ethers.parseEther("5")
      });

      await xcmProxy.connect(operator).executeInvestment(
        user1.address,
        poolAddress,
        await weth.getAddress(),
        ethers.parseEther("5"),
        -5,
        5,
        positionId
      );

      await xcmProxy.connect(operator).liquidatePosition(positionId);

      // Try to settle without sending funds to contract
      await expect(
        assetHubVault.connect(operator).settleLiquidation(positionId, ethers.parseEther("5"))
      ).to.be.revertedWith("Insufficient contract balance");
    });
  });

  describe("State Verification", function () {
    it("should verify position inactive on both contracts after liquidation", async function () {
      await assetHubVault.connect(user1).deposit({ value: ethers.parseEther("10") });
      
      const tx = await assetHubVault.connect(operator).dispatchInvestment(
        user1.address,
        1287,
        poolAddress,
        await weth.getAddress(),
        ethers.parseEther("5"),
        -5,
        5,
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

      await deployer.sendTransaction({
        to: await xcmProxy.getAddress(),
        value: ethers.parseEther("5")
      });

      await xcmProxy.connect(operator).executeInvestment(
        user1.address,
        poolAddress,
        await weth.getAddress(),
        ethers.parseEther("5"),
        -5,
        5,
        positionId
      );

      // Liquidate on XCMProxy
      await xcmProxy.connect(operator).liquidatePosition(positionId);
      const proxyPos = await xcmProxy.getPosition(positionId);
      expect(proxyPos.active).to.be.false;

      // Settle on AssetHub
      await deployer.sendTransaction({
        to: await assetHubVault.getAddress(),
        value: ethers.parseEther("5")
      });
      await assetHubVault.connect(operator).settleLiquidation(positionId, ethers.parseEther("5"));
      
      const vaultPos = await assetHubVault.getPosition(positionId);
      expect(vaultPos.active).to.be.false;

      console.log("   ✓ Position inactive on both XCMProxy and AssetHubVault");
    });
  });
});

