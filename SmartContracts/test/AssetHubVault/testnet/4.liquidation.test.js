/**
 * AssetHubVault Testnet Liquidation Tests
 * 
 * Tests liquidation settlement flow on deployed contract
 * Safe for testnet - simulates XCM returns via direct contract funding
 * 
 * Covers TEST-AHV-024 to TEST-AHV-028
 * 
 * Usage:
 *   npx hardhat test test/AssetHubVault/testnet/4.liquidation.test.js --network passethub
 * 
 * Requirements:
 *   - ASSET_PK in .env must have PAS tokens
 *   - ASSETHUB_CONTRACT must point to deployed vault
 *   - Account must be operator
 *   - Must have at least one active position (run 3.investment.test.js first)
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AssetHubVault Testnet - Liquidation Settlement", function () {
  let vault;
  let operator;
  let testPositionId;
  const VAULT_ADDRESS = process.env.ASSETHUB_CONTRACT;

  // Test parameters
  const MOONBASE_CHAIN_ID = 1287;
  const TEST_POOL_ID = "0x1234567890abcdef1234567890abcdef12345678"; // address format
  const WETH_ADDRESS = "0x1436aE0dF0A8663F18c0Ec51d7e2E46591730715";
  
  // XCM parameters (mock - will be skipped in test mode)
  const MOCK_XCM_DESTINATION = "0x010100a10f";
  const MOCK_XCM_MESSAGE = "0x";

  before(async function () {
    if (!VAULT_ADDRESS || VAULT_ADDRESS === ethers.ZeroAddress) {
      throw new Error("Set ASSETHUB_CONTRACT environment variable");
    }

    [operator] = await ethers.getSigners();

    const AssetHubVault = await ethers.getContractFactory(
      "contracts/V1(Current)/AssetHubVault.sol:AssetHubVault"
    );
    vault = AssetHubVault.attach(VAULT_ADDRESS);

    console.log(`\n✅ Connected to vault at: ${VAULT_ADDRESS}`);
    console.log(`✅ Network: ${network.name}`);
    console.log(`✅ Operator: ${operator.address}\n`);

    // Note: testPositionId will be set by individual tests as needed
    // Each test creates and manages its own positions
  });

  describe("Liquidation Settlement - Basic Flow", function () {
    it("should allow operator to settle liquidation (TEST-AHV-024)", async function () {
      // Create a fresh position for this test
      await vault.connect(operator).deposit({ value: ethers.parseEther("1.0") });
      await new Promise(resolve => setTimeout(resolve, 6000));

      const tx = await vault.connect(operator).dispatchInvestment(
        operator.address,
        MOONBASE_CHAIN_ID,
        TEST_POOL_ID,
        WETH_ADDRESS,
        ethers.parseEther("0.5"),
        -50,
        50,
        MOCK_XCM_DESTINATION,
        MOCK_XCM_MESSAGE
      );
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Get position ID from event
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          const parsed = vault.interface.parseLog(log);
          return parsed && parsed.name === "InvestmentInitiated";
        } catch {
          return false;
        }
      });
      
      const parsed = vault.interface.parseLog(event);
      const newPositionId = parsed.args[0]; // positionId
      const investedAmount = ethers.parseEther("0.5");

      // Confirm execution (simulates remote chain confirming position is active)
      const mockRemotePositionId = ethers.keccak256(ethers.toUtf8Bytes("remote-pos-1"));
      const mockLiquidity = 1000000n;
      await vault.connect(operator).confirmExecution(
        newPositionId,
        mockRemotePositionId,
        mockLiquidity
      );
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Simulate XCM return: send proceeds to contract
      const proceedsAmount = ethers.parseEther("0.6"); // 20% profit
      await operator.sendTransaction({
        to: VAULT_ADDRESS,
        value: proceedsAmount
      });
      await new Promise(resolve => setTimeout(resolve, 6000));

      const userBalanceBefore = await vault.getUserBalance(operator.address);

      // Settle liquidation
      const settleTx = await vault.connect(operator).settleLiquidation(
        newPositionId,
        proceedsAmount
      );
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Verify user balance increased
      const userBalanceAfter = await vault.getUserBalance(operator.address);
      expect(userBalanceAfter).to.equal(userBalanceBefore + proceedsAmount);

      // Verify events
      const settleReceipt = await settleTx.wait();
      const posLiqEvent = settleReceipt.logs.find(log => {
        try {
          const parsed = vault.interface.parseLog(log);
          return parsed && parsed.name === "PositionLiquidated";
        } catch {
          return false;
        }
      });
      
      const liqSettledEvent = settleReceipt.logs.find(log => {
        try {
          const parsed = vault.interface.parseLog(log);
          return parsed && parsed.name === "LiquidationSettled";
        } catch {
          return false;
        }
      });

      expect(posLiqEvent).to.not.be.undefined;
      expect(liqSettledEvent).to.not.be.undefined;

      const profit = proceedsAmount - investedAmount;
      const profitPercent = (Number(profit) / Number(investedAmount) * 100).toFixed(2);

      console.log(`   ✓ Position settled successfully`);
      console.log(`   ✓ Invested: ${ethers.formatEther(investedAmount)} ETH`);
      console.log(`   ✓ Proceeds: ${ethers.formatEther(proceedsAmount)} ETH`);
      console.log(`   ✓ Profit: ${ethers.formatEther(profit)} ETH (${profitPercent}%)`);
      console.log(`   ✓ Position marked as liquidated`);
      console.log(`   ✓ User balance increased`);
    });

    it("should allow user to withdraw after settlement (TEST-AHV-027)", async function () {
      const balanceBefore = await vault.getUserBalance(operator.address);
      
      if (balanceBefore === 0n) {
        this.skip(); // Skip if no balance to withdraw
      }

      const withdrawAmount = balanceBefore > ethers.parseEther("0.1") 
        ? ethers.parseEther("0.1") 
        : balanceBefore;

      await vault.connect(operator).withdraw(withdrawAmount);
      await new Promise(resolve => setTimeout(resolve, 6000));

      const balanceAfter = await vault.getUserBalance(operator.address);
      expect(balanceAfter).to.equal(balanceBefore - withdrawAmount);

      console.log(`   ✓ Successfully withdrew ${ethers.formatEther(withdrawAmount)} ETH after settlement`);
    });
  });

  describe("Liquidation Settlement - Validation", function () {
    it("should revert on zero amount (TEST-AHV-025)", async function () {
      // Create and activate a position
      await vault.connect(operator).deposit({ value: ethers.parseEther("0.3") });
      await new Promise(resolve => setTimeout(resolve, 6000));

      const tx = await vault.connect(operator).dispatchInvestment(
        operator.address,
        MOONBASE_CHAIN_ID,
        TEST_POOL_ID,
        WETH_ADDRESS,
        ethers.parseEther("0.1"),
        -50,
        50,
        MOCK_XCM_DESTINATION,
        MOCK_XCM_MESSAGE
      );
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Get position ID and confirm
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          const parsed = vault.interface.parseLog(log);
          return parsed && parsed.name === "InvestmentInitiated";
        } catch {
          return false;
        }
      });
      const parsed = vault.interface.parseLog(event);
      const posId = parsed.args[0];

      const mockRemotePositionId = ethers.keccak256(ethers.toUtf8Bytes("zero-test-pos"));
      await vault.connect(operator).confirmExecution(posId, mockRemotePositionId, 1000000n);
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Try to settle with zero amount
      await expect(
        vault.connect(operator).settleLiquidation(
          posId,
          0 // Zero amount
        )
      ).to.be.revertedWithCustomError(vault, "AmountZero");
    });

    it("should revert on inactive position (TEST-AHV-025)", async function () {
      // Create and immediately settle a position
      await vault.connect(operator).deposit({ value: ethers.parseEther("0.5") });
      await new Promise(resolve => setTimeout(resolve, 6000));

      const tx = await vault.connect(operator).dispatchInvestment(
        operator.address,
        MOONBASE_CHAIN_ID,
        TEST_POOL_ID,
        WETH_ADDRESS,
        ethers.parseEther("0.2"),
        -50,
        50,
        MOCK_XCM_DESTINATION,
        MOCK_XCM_MESSAGE
      );
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Get position ID from event
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          const parsed = vault.interface.parseLog(log);
          return parsed && parsed.name === "InvestmentInitiated";
        } catch {
          return false;
        }
      });
      const parsed = vault.interface.parseLog(event);
      const posId = parsed.args[0];

      // Confirm execution
      const mockRemotePositionId = ethers.keccak256(ethers.toUtf8Bytes("remote-pos-2"));
      await vault.connect(operator).confirmExecution(posId, mockRemotePositionId, 1000000n);
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Send proceeds and settle
      await operator.sendTransaction({
        to: VAULT_ADDRESS,
        value: ethers.parseEther("0.25")
      });
      await new Promise(resolve => setTimeout(resolve, 6000));

      await vault.connect(operator).settleLiquidation(
        posId,
        ethers.parseEther("0.25")
      );
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Try to settle again - should fail
      await expect(
        vault.connect(operator).settleLiquidation(
          posId,
          ethers.parseEther("0.1")
        )
      ).to.be.revertedWith("Position not active");

      console.log(`   ✓ Cannot settle inactive position (TEST-AHV-026)`);
    });

    it("should revert on insufficient contract balance (TEST-AHV-025)", async function () {
      // Create a position
      await vault.connect(operator).deposit({ value: ethers.parseEther("0.5") });
      await new Promise(resolve => setTimeout(resolve, 6000));

      const tx = await vault.connect(operator).dispatchInvestment(
        operator.address,
        MOONBASE_CHAIN_ID,
        TEST_POOL_ID,
        WETH_ADDRESS,
        ethers.parseEther("0.3"),
        -50,
        50,
        MOCK_XCM_DESTINATION,
        MOCK_XCM_MESSAGE
      );
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Get position ID from event
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          const parsed = vault.interface.parseLog(log);
          return parsed && parsed.name === "InvestmentInitiated";
        } catch {
          return false;
        }
      });
      const parsed = vault.interface.parseLog(event);
      const posId = parsed.args[0];

      // Try to settle with more than contract has
      const contractBalance = await ethers.provider.getBalance(VAULT_ADDRESS);
      const tooMuch = contractBalance + ethers.parseEther("1000");

      await expect(
        vault.connect(operator).settleLiquidation(
          posId,
          tooMuch
        )
      ).to.be.reverted; // Will revert with insufficient balance
    });
  });

  describe("Liquidation Settlement - Position State", function () {
    it("should track settled positions correctly", async function () {
      // Use stats function instead of loading all positions
      const stats = await vault.getUserPositionStats(operator.address);
      
      console.log(`\n   📊 Position State Summary`);
      console.log(`   Total Positions: ${stats.total}`);
      console.log(`   Pending: ${stats.pending}`);
      console.log(`   Active: ${stats.active}`);
      console.log(`   Liquidated: ${stats.liquidated}`);
      
      // Get sample of liquidated positions for verification
      const liquidatedPositions = await vault.getUserPositionsByStatus(
        operator.address,
        2, // Liquidated status
        10 // Max 10
      );
      
      let totalLiquidated = 0n;
      for (let i = 0; i < liquidatedPositions.length; i++) {
        const amount = liquidatedPositions[i][8]; // amount
        totalLiquidated += amount;
      }
      
      if (liquidatedPositions.length > 0) {
        console.log(`   Sample Liquidated: ${ethers.formatEther(totalLiquidated)} ETH (from ${liquidatedPositions.length} positions)`);
      }

      console.log(`   ==========================================\n`);

      expect(stats.total).to.be.gte(1n);
      expect(stats.liquidated).to.be.gte(1n);
    });

    it("should maintain position data after settlement", async function () {
      // Create and settle a position
      await vault.connect(operator).deposit({ value: ethers.parseEther("0.5") });
      await new Promise(resolve => setTimeout(resolve, 6000));

      const tx = await vault.connect(operator).dispatchInvestment(
        operator.address,
        MOONBASE_CHAIN_ID,
        TEST_POOL_ID,
        WETH_ADDRESS,
        ethers.parseEther("0.2"),
        -50,
        50,
        MOCK_XCM_DESTINATION,
        MOCK_XCM_MESSAGE
      );
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Get position ID and confirm execution
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          const parsed = vault.interface.parseLog(log);
          return parsed && parsed.name === "InvestmentInitiated";
        } catch {
          return false;
        }
      });
      const parsed = vault.interface.parseLog(event);
      const posId = parsed.args[0];

      // Confirm execution
      const mockRemotePositionId = ethers.keccak256(ethers.toUtf8Bytes("test-settle-pos"));
      await vault.connect(operator).confirmExecution(posId, mockRemotePositionId, 1000000n);
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Get position data before settlement using getPosition
      const posBefore = await vault.getPosition(posId);
      expect(posBefore.status).to.equal(1); // Should be Active

      // Settle
      await operator.sendTransaction({
        to: VAULT_ADDRESS,
        value: ethers.parseEther("0.25")
      });
      await new Promise(resolve => setTimeout(resolve, 6000));

      await vault.connect(operator).settleLiquidation(
        posId,
        ethers.parseEther("0.25")
      );
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Get position data after settlement
      const posAfter = await vault.getPosition(posId);

      // Verify all data preserved except status
      expect(posAfter.user.toLowerCase()).to.equal(posBefore.user.toLowerCase());
      expect(posAfter.poolId.toLowerCase()).to.equal(posBefore.poolId.toLowerCase());
      expect(posAfter.baseAsset.toLowerCase()).to.equal(posBefore.baseAsset.toLowerCase());
      expect(posAfter.chainId).to.equal(posBefore.chainId);
      expect(posAfter.amount).to.equal(posBefore.amount);
      expect(posAfter.status).to.equal(2); // status should now be Liquidated

      console.log(`   ✓ Position data preserved after settlement`);
      console.log(`   ✓ Status changed from Active (1) to Liquidated (2)`);
    });
  });

  describe("Liquidation Settlement - User Balance", function () {
    it("should correctly credit proceeds to user balance", async function () {
      const userBalanceBefore = await vault.getUserBalance(operator.address);

      // Create position
      await vault.connect(operator).deposit({ value: ethers.parseEther("0.5") });
      await new Promise(resolve => setTimeout(resolve, 6000));

      const afterDeposit = await vault.getUserBalance(operator.address);

      const tx = await vault.connect(operator).dispatchInvestment(
        operator.address,
        MOONBASE_CHAIN_ID,
        TEST_POOL_ID,
        WETH_ADDRESS,
        ethers.parseEther("0.3"),
        -50,
        50,
        MOCK_XCM_DESTINATION,
        MOCK_XCM_MESSAGE
      );
      await new Promise(resolve => setTimeout(resolve, 6000));

      const afterDispatch = await vault.getUserBalance(operator.address);
      expect(afterDispatch).to.equal(afterDeposit - ethers.parseEther("0.3"));

      // Get position ID from event
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          const parsed = vault.interface.parseLog(log);
          return parsed && parsed.name === "InvestmentInitiated";
        } catch {
          return false;
        }
      });
      const parsed = vault.interface.parseLog(event);
      const posId = parsed.args[0];

      // Confirm execution
      const mockRemotePositionId = ethers.keccak256(ethers.toUtf8Bytes("remote-pos-3"));
      await vault.connect(operator).confirmExecution(posId, mockRemotePositionId, 1000000n);
      await new Promise(resolve => setTimeout(resolve, 6000));

      const proceedsAmount = ethers.parseEther("0.35"); // Profit of 0.05
      await operator.sendTransaction({
        to: VAULT_ADDRESS,
        value: proceedsAmount
      });
      await new Promise(resolve => setTimeout(resolve, 6000));

      await vault.connect(operator).settleLiquidation(
        posId,
        proceedsAmount
      );
      await new Promise(resolve => setTimeout(resolve, 6000));

      const afterSettle = await vault.getUserBalance(operator.address);
      expect(afterSettle).to.equal(afterDispatch + proceedsAmount);

      const netChange = afterSettle - userBalanceBefore;
      console.log(`   ✓ Net balance change: ${ethers.formatEther(netChange)} ETH`);
      console.log(`   ✓ (Deposit + Proceeds - Investment)`);
    });
  });

  describe("Liquidation Summary", function () {
    it("should display complete liquidation history", async function () {
      // Use stats function for efficient counting
      const stats = await vault.getUserPositionStats(operator.address);
      const userBalance = await vault.getUserBalance(operator.address);
      const contractBalance = await ethers.provider.getBalance(VAULT_ADDRESS);

      console.log(`\n   📊 Liquidation Test Summary`);
      console.log(`   ==========================================`);
      console.log(`   Total Positions Created: ${stats.total}`);
      console.log(`   Pending Positions: ${stats.pending}`);
      console.log(`   Active Positions: ${stats.active}`);
      console.log(`   Liquidated Positions: ${stats.liquidated}`);
      console.log(`   User Withdrawable Balance: ${ethers.formatEther(userBalance)} ETH`);
      console.log(`   Contract Total Balance: ${ethers.formatEther(contractBalance)} ETH`);
      
      // Get sample of liquidated positions
      if (stats.liquidated > 0) {
        const liquidatedSample = await vault.getUserPositionsByStatus(
          operator.address,
          2, // Liquidated
          5 // Show first 5
        );
        console.log(`\n   Recent Liquidations (showing ${liquidatedSample.length}):`);
        for (let i = 0; i < liquidatedSample.length; i++) {
          const amount = liquidatedSample[i][8];
          const chainId = liquidatedSample[i][3];
          console.log(`   ${i + 1}. ${ethers.formatEther(amount)} ETH on chain ${chainId}`);
        }
      }
      
      console.log(`   ==========================================\n`);

      expect(stats.liquidated).to.be.gte(1n, "Should have at least one liquidated position");
    });
  });
});
