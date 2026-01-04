/**
 * AssetHubVault Testnet Deposit Tests
 * 
 * Tests deposit/withdrawal behavior on deployed contract
 * Safe for testnet - works with existing state
 * 
 * Covers TEST-AHV-007 to TEST-AHV-013 (testnet-safe subset)
 * 
 * Usage:
 *   npx hardhat test test/AssetHubVault/testnet/2.deposits.test.js --network passethub
 * 
 * Requirements:
 *   - ASSET_PK in .env must have PAS tokens
 *   - ASSETHUB_CONTRACT must point to deployed vault
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { safeDeposit, safeWithdraw, wait } = require("./helpers");

describe("AssetHubVault Testnet - Deposits & Withdrawals", function () {
  let vault;
  let user1, user2;
  const VAULT_ADDRESS = process.env.ASSETHUB_CONTRACT;

  before(async function () {
    if (!VAULT_ADDRESS || VAULT_ADDRESS === ethers.ZeroAddress) {
      throw new Error("Set ASSETHUB_CONTRACT environment variable");
    }

    // Get signers from the network (passethub network uses ASSET_PK from .env)
    const signers = await ethers.getSigners();
    user1 = signers[0]; // Your funded account
    user2 = signers[1] || signers[0]; // Use same if only one available

    const AssetHubVault = await ethers.getContractFactory(
      "contracts/V1(Current)/AssetHubVault.sol:AssetHubVault"
    );
    vault = AssetHubVault.attach(VAULT_ADDRESS);

    console.log(`\n✅ Connected to vault at: ${VAULT_ADDRESS}`);
    console.log(`✅ Network: ${network.name}`);
    console.log(`✅ User1 (tester): ${user1.address}`);
    if (user2 && user2.address !== user1.address) {
      console.log(`✅ User2: ${user2.address}\n`);
    } else {
      console.log(`⚠️  Using single user for all tests\n`);
    }
  });

  describe("Deposit Functionality", function () {
    it("should accept deposits (TEST-AHV-007)", async function () {
      const balanceBefore = await vault.getUserBalance(user1.address);
      const depositAmount = ethers.parseEther("0.1"); // Small test amount

      await safeDeposit(vault, user1, depositAmount);

      const balanceAfter = await vault.getUserBalance(user1.address);
      expect(balanceAfter).to.equal(balanceBefore + depositAmount);

      console.log(`   ✓ Deposited ${ethers.formatEther(depositAmount)} ETH`);
      console.log(`   ✓ New balance: ${ethers.formatEther(balanceAfter)} ETH`);
    });

    it("should emit Deposit event", async function () {
      const depositAmount = ethers.parseEther("0.01");
      const gasEst = await vault.connect(user1).deposit.estimateGas({ value: depositAmount });

      await expect(
        vault.connect(user1).deposit({ value: depositAmount, gasLimit: gasEst * 2n })
      )
        .to.emit(vault, "Deposit")
        .withArgs(user1.address, depositAmount);
      
      await wait(1000);
    });

    it("should revert on zero deposit (TEST-AHV-008)", async function () {
      await expect(
        vault.connect(user1).deposit({ value: 0 })
      ).to.be.revertedWithCustomError(vault, "AmountZero");
    });

    it("should handle multiple deposits from same user", async function () {
      const balanceBefore = await vault.getUserBalance(user1.address);
      
      await safeDeposit(vault, user1, ethers.parseEther("0.05"));
      await safeDeposit(vault, user1, ethers.parseEther("0.05"));
      
      const balanceAfter = await vault.getUserBalance(user1.address);
      expect(balanceAfter).to.equal(balanceBefore + ethers.parseEther("0.1"));
    });

    it("should allow multiple users to deposit independently (TEST-AHV-009)", async function () {
      if (user2.address === user1.address) {
        this.skip(); // Skip if only one account available
      }

      const user1BalanceBefore = await vault.getUserBalance(user1.address);
      const user2BalanceBefore = await vault.getUserBalance(user2.address);

      await safeDeposit(vault, user1, ethers.parseEther("0.1"));
      await safeDeposit(vault, user2, ethers.parseEther("0.2"));

      const user1BalanceAfter = await vault.getUserBalance(user1.address);
      const user2BalanceAfter = await vault.getUserBalance(user2.address);

      expect(user1BalanceAfter).to.equal(user1BalanceBefore + ethers.parseEther("0.1"));
      expect(user2BalanceAfter).to.equal(user2BalanceBefore + ethers.parseEther("0.2"));

      console.log(`   ✓ User1 balance: ${ethers.formatEther(user1BalanceAfter)} ETH`);
      console.log(`   ✓ User2 balance: ${ethers.formatEther(user2BalanceAfter)} ETH`);
    });
  });

  describe("Withdrawal Functionality", function () {
    it("should allow withdrawal if balance exists (TEST-AHV-010/011)", async function () {
      const balance = await vault.getUserBalance(user1.address);

      if (balance === 0n) {
        console.log("   ⚠️  User has no balance - depositing first");
        await safeDeposit(vault, user1, ethers.parseEther("0.5"));
      }

      const balanceBefore = await vault.getUserBalance(user1.address);
      const withdrawAmount = ethers.parseEther("0.01");

      if (balanceBefore < withdrawAmount) {
        console.log("   ⚠️  Balance too low - skipping");
        this.skip();
      }

      await safeWithdraw(vault, user1, withdrawAmount);

      const balanceAfter = await vault.getUserBalance(user1.address);
      expect(balanceAfter).to.equal(balanceBefore - withdrawAmount);

      console.log(`   ✓ Withdrew ${ethers.formatEther(withdrawAmount)} ETH`);
      console.log(`   ✓ Remaining balance: ${ethers.formatEther(balanceAfter)} ETH`);
    });

    it("should emit Withdraw event", async function () {
      // Need existing balance first
      await safeDeposit(vault, user1, ethers.parseEther("0.05"));
      
      const withdrawAmount = ethers.parseEther("0.01");
      const gasEst = await vault.connect(user1).withdraw.estimateGas(withdrawAmount);

      await expect(
        vault.connect(user1).withdraw(withdrawAmount, { gasLimit: gasEst * 2n })
      )
        .to.emit(vault, "Withdrawal") // Correct event name
        .withArgs(user1.address, withdrawAmount);
      
      await wait(1000);
    });

    it("should revert on insufficient balance (TEST-AHV-012)", async function () {
      const balance = await vault.getUserBalance(user1.address);
      const tooMuch = balance + ethers.parseEther("1000");

      await expect(
        vault.connect(user1).withdraw(tooMuch)
      ).to.be.revertedWithCustomError(vault, "InsufficientBalance");
    });

    it("should revert on zero withdrawal (TEST-AHV-013)", async function () {
      await expect(
        vault.connect(user1).withdraw(0)
      ).to.be.revertedWithCustomError(vault, "AmountZero");
    });

    it("should handle full balance withdrawal", async function () {
      // Deposit a specific amount and withdraw it all
      const depositAmount = ethers.parseEther("0.5");
      
      await safeDeposit(vault, user1, depositAmount);
      
      const balance = await vault.getUserBalance(user1.address);

      await safeWithdraw(vault, user1, balance);

      const finalBalance = await vault.getUserBalance(user1.address);
      expect(finalBalance).to.equal(0);

      console.log(`   ✓ Withdrew full balance: ${ethers.formatEther(balance)} ETH`);
    });
  });

  describe("Balance Consistency", function () {
    it("should maintain consistent balances across operations", async function () {
      const initialBalance = await vault.getUserBalance(user1.address);

      // Deposit
      await safeDeposit(vault, user1, ethers.parseEther("1"));
      
      const afterDeposit = await vault.getUserBalance(user1.address);
      expect(afterDeposit).to.equal(initialBalance + ethers.parseEther("1"));

      // Withdraw
      await safeWithdraw(vault, user1, ethers.parseEther("0.5"));
      
      const afterWithdraw = await vault.getUserBalance(user1.address);
      expect(afterWithdraw).to.equal(afterDeposit - ethers.parseEther("0.5"));

      // Final balance should be initial + 0.5
      expect(afterWithdraw).to.equal(initialBalance + ethers.parseEther("0.5"));

      console.log(`   ✓ Balance consistency maintained`);
      console.log(`      Initial: ${ethers.formatEther(initialBalance)} ETH`);
      console.log(`      Final: ${ethers.formatEther(afterWithdraw)} ETH`);
    });

    it("should not affect other users' balances", async function () {
      if (user2.address === user1.address) {
        this.skip(); // Skip if only one account available
      }

      const user2BalanceBefore = await vault.getUserBalance(user2.address);

      // User1 deposits
      await safeDeposit(vault, user1, ethers.parseEther("0.1"));

      // User2 balance should not change
      const user2BalanceAfter = await vault.getUserBalance(user2.address);
      expect(user2BalanceAfter).to.equal(user2BalanceBefore);
    });
  });

  describe("Contract State", function () {
    it("should update contract balance on deposits", async function () {
      const contractBalanceBefore = await ethers.provider.getBalance(VAULT_ADDRESS);
      const depositAmount = ethers.parseEther("0.1");

      await safeDeposit(vault, user1, depositAmount);

      const contractBalanceAfter = await ethers.provider.getBalance(VAULT_ADDRESS);
      expect(contractBalanceAfter).to.be.gte(contractBalanceBefore);

      console.log(`   Contract balance: ${ethers.formatEther(contractBalanceAfter)} ETH`);
    });

    it("should not be paused for deposits/withdrawals", async function () {
      const paused = await vault.paused();
      
      if (paused) {
        console.log("   ⚠️  Contract is paused!");
        expect(paused).to.be.false; // This will fail if paused
      } else {
        console.log("   ✓ Contract is operational");
      }
    });
  });
});