/**
 * AssetHubVault Testnet Deposit Tests
 * 
 * Tests deposit/withdrawal behavior on deployed contract
 * Safe for testnet - works with existing state
 * 
 * Covers TEST-AHV-007 to TEST-AHV-013 (testnet-safe subset)
 * 
 * Usage:
 *   $env:ASSETHUB_CONTRACT="0xYourAddress"
 *   npx hardhat test test/AssetHubVault/testnet/2.deposits.test.js
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AssetHubVault Testnet - Deposits & Withdrawals", function () {
  let vault;
  let user1, user2;
  const VAULT_ADDRESS = process.env.ASSETHUB_CONTRACT;

  before(async function () {
    if (!VAULT_ADDRESS || VAULT_ADDRESS === ethers.ZeroAddress) {
      throw new Error("Set ASSETHUB_CONTRACT environment variable");
    }

    [user1, user2] = await ethers.getSigners();

    const AssetHubVault = await ethers.getContractFactory(
      "contracts/V1(Current)/AssetHubVault.sol:AssetHubVault"
    );
    vault = AssetHubVault.attach(VAULT_ADDRESS);

    console.log(`\n✅ Connected to vault at: ${VAULT_ADDRESS}\n`);
  });

  describe("Deposit Functionality", function () {
    it("should accept deposits (TEST-AHV-007)", async function () {
      const balanceBefore = await vault.getUserBalance(user1.address);
      const depositAmount = ethers.parseEther("0.1"); // Small test amount

      await vault.connect(user1).deposit({ value: depositAmount });

      const balanceAfter = await vault.getUserBalance(user1.address);
      expect(balanceAfter).to.equal(balanceBefore + depositAmount);

      console.log(`   ✓ Deposited ${ethers.formatEther(depositAmount)} ETH`);
      console.log(`   ✓ New balance: ${ethers.formatEther(balanceAfter)} ETH`);
    });

    it("should emit Deposit event", async function () {
      const depositAmount = ethers.parseEther("0.01");

      await expect(
        vault.connect(user1).deposit({ value: depositAmount })
      )
        .to.emit(vault, "Deposit")
        .withArgs(user1.address, depositAmount);
    });

    it("should revert on zero deposit (TEST-AHV-008)", async function () {
      await expect(
        vault.connect(user1).deposit({ value: 0 })
      ).to.be.revertedWithCustomError(vault, "AmountZero");
    });

    it("should handle multiple deposits from same user", async function () {
      const balanceBefore = await vault.getUserBalance(user1.address);
      
      await vault.connect(user1).deposit({ value: ethers.parseEther("0.05") });
      await vault.connect(user1).deposit({ value: ethers.parseEther("0.05") });
      
      const balanceAfter = await vault.getUserBalance(user1.address);
      expect(balanceAfter).to.equal(balanceBefore + ethers.parseEther("0.1"));
    });

    it("should allow multiple users to deposit independently (TEST-AHV-009)", async function () {
      const user1BalanceBefore = await vault.getUserBalance(user1.address);
      const user2BalanceBefore = await vault.getUserBalance(user2.address);

      await vault.connect(user1).deposit({ value: ethers.parseEther("0.1") });
      await vault.connect(user2).deposit({ value: ethers.parseEther("0.2") });

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
        await vault.connect(user1).deposit({ value: ethers.parseEther("0.5") });
      }

      const balanceBefore = await vault.getUserBalance(user1.address);
      const withdrawAmount = ethers.parseEther("0.01");

      if (balanceBefore < withdrawAmount) {
        console.log("   ⚠️  Balance too low - skipping");
        this.skip();
      }

      await vault.connect(user1).withdraw(withdrawAmount);

      const balanceAfter = await vault.getUserBalance(user1.address);
      expect(balanceAfter).to.equal(balanceBefore - withdrawAmount);

      console.log(`   ✓ Withdrew ${ethers.formatEther(withdrawAmount)} ETH`);
      console.log(`   ✓ Remaining balance: ${ethers.formatEther(balanceAfter)} ETH`);
    });

    it("should emit Withdraw event", async function () {
      const balance = await vault.getUserBalance(user1.address);

      if (balance === 0n) {
        await vault.connect(user1).deposit({ value: ethers.parseEther("0.1") });
      }

      const withdrawAmount = ethers.parseEther("0.01");
      const currentBalance = await vault.getUserBalance(user1.address);

      if (currentBalance < withdrawAmount) {
        this.skip();
      }

      await expect(
        vault.connect(user1).withdraw(withdrawAmount)
      )
        .to.emit(vault, "Withdraw")
        .withArgs(user1.address, withdrawAmount);
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
      
      await vault.connect(user2).deposit({ value: depositAmount });
      const balance = await vault.getUserBalance(user2.address);

      await vault.connect(user2).withdraw(balance);

      const finalBalance = await vault.getUserBalance(user2.address);
      expect(finalBalance).to.equal(0);

      console.log(`   ✓ Withdrew full balance: ${ethers.formatEther(balance)} ETH`);
    });
  });

  describe("Balance Consistency", function () {
    it("should maintain consistent balances across operations", async function () {
      const initialBalance = await vault.getUserBalance(user1.address);

      // Deposit
      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });
      const afterDeposit = await vault.getUserBalance(user1.address);
      expect(afterDeposit).to.equal(initialBalance + ethers.parseEther("1"));

      // Withdraw
      await vault.connect(user1).withdraw(ethers.parseEther("0.5"));
      const afterWithdraw = await vault.getUserBalance(user1.address);
      expect(afterWithdraw).to.equal(afterDeposit - ethers.parseEther("0.5"));

      // Final balance should be initial + 0.5
      expect(afterWithdraw).to.equal(initialBalance + ethers.parseEther("0.5"));

      console.log(`   ✓ Balance consistency maintained`);
      console.log(`      Initial: ${ethers.formatEther(initialBalance)} ETH`);
      console.log(`      Final: ${ethers.formatEther(afterWithdraw)} ETH`);
    });

    it("should not affect other users' balances", async function () {
      const user2BalanceBefore = await vault.getUserBalance(user2.address);

      // User1 deposits
      await vault.connect(user1).deposit({ value: ethers.parseEther("0.1") });

      // User2 balance should not change
      const user2BalanceAfter = await vault.getUserBalance(user2.address);
      expect(user2BalanceAfter).to.equal(user2BalanceBefore);
    });
  });

  describe("Contract State", function () {
    it("should update contract balance on deposits", async function () {
      const contractBalanceBefore = await ethers.provider.getBalance(VAULT_ADDRESS);
      const depositAmount = ethers.parseEther("0.1");

      await vault.connect(user1).deposit({ value: depositAmount });

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

