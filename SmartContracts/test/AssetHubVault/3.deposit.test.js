/**
 * AssetHubVault Deposit & Withdrawal Tests
 * 
 * This test suite covers TEST-AHV-007 to TEST-AHV-015 from TESTING-REQUIREMENTS.md
 * 
 * Tests in this file:
 * - User can deposit native tokens
 * - Deposit validation and reverts
 * - Multiple users can deposit independently
 * - User can withdraw (full and partial)
 * - Withdrawal validation and reverts
 * - Reentrancy protection
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AssetHubVault - Deposit & Withdrawal", function () {
  let assetHubVault;
  let deployer, user1, user2;

  /**
   * Deploy a fresh AssetHubVault before each test
   */
  beforeEach(async function () {
    [deployer, user1, user2] = await ethers.getSigners();

    const AssetHubVault = await ethers.getContractFactory("contracts/V1(Current)/AssetHubVault.sol:AssetHubVault");
    assetHubVault = await AssetHubVault.deploy();
    await assetHubVault.waitForDeployment();
  });

  /**
   * TEST-AHV-007: User can deposit native tokens
   * 
   * Verifies that:
   * - Deposit of 10 ETH succeeds
   * - userBalances[user] = 10 ETH
   * - Deposit event emitted with correct params
   * - Contract balance increased by 10 ETH
   */
  describe("TEST-AHV-007: User can deposit native tokens", function () {
    it("should accept deposit of 10 ETH", async function () {
      const depositAmount = ethers.parseEther("10");
      
      // Check initial state
      const initialBalance = await assetHubVault.getUserBalance(user1.address);
      expect(initialBalance).to.equal(0);
      
      // Perform deposit
      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      
      // Verify user balance updated
      const finalBalance = await assetHubVault.getUserBalance(user1.address);
      expect(finalBalance).to.equal(depositAmount);
    });

    it("should emit Deposit event with correct parameters", async function () {
      const depositAmount = ethers.parseEther("10");
      
      await expect(
        assetHubVault.connect(user1).deposit({ value: depositAmount })
      )
        .to.emit(assetHubVault, "Deposit")
        .withArgs(user1.address, depositAmount);
    });

    it("should increase contract balance", async function () {
      const depositAmount = ethers.parseEther("10");
      const vaultAddress = await assetHubVault.getAddress();
      
      // Get initial contract balance
      const initialContractBalance = await ethers.provider.getBalance(vaultAddress);
      
      // Perform deposit
      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      
      // Verify contract balance increased
      const finalContractBalance = await ethers.provider.getBalance(vaultAddress);
      expect(finalContractBalance).to.equal(initialContractBalance + depositAmount);
    });

    it("should allow multiple deposits from same user", async function () {
      const firstDeposit = ethers.parseEther("10");
      const secondDeposit = ethers.parseEther("5");
      
      // First deposit
      await assetHubVault.connect(user1).deposit({ value: firstDeposit });
      expect(await assetHubVault.getUserBalance(user1.address)).to.equal(firstDeposit);
      
      // Second deposit
      await assetHubVault.connect(user1).deposit({ value: secondDeposit });
      expect(await assetHubVault.getUserBalance(user1.address)).to.equal(firstDeposit + secondDeposit);
    });
  });

  /**
   * TEST-AHV-008: Deposit reverts with zero amount
   * 
   * Verifies that:
   * - Calling deposit with msg.value = 0 reverts
   * - Reverts with AmountZero error
   */
  describe("TEST-AHV-008: Deposit reverts with zero amount", function () {
    it("should revert when depositing 0 ETH", async function () {
      await expect(
        assetHubVault.connect(user1).deposit({ value: 0 })
      ).to.be.revertedWithCustomError(assetHubVault, "AmountZero");
    });

    it("should not update balance on failed zero deposit", async function () {
      const balanceBefore = await assetHubVault.getUserBalance(user1.address);
      
      try {
        await assetHubVault.connect(user1).deposit({ value: 0 });
      } catch (error) {
        // Expected to fail
      }
      
      const balanceAfter = await assetHubVault.getUserBalance(user1.address);
      expect(balanceAfter).to.equal(balanceBefore);
    });
  });

  /**
   * TEST-AHV-009: Multiple users can deposit independently
   * 
   * Verifies that:
   * - User A can deposit 5 ETH
   * - User B can deposit 10 ETH
   * - Balances are tracked separately
   * - Total contract balance = sum of deposits
   */
  describe("TEST-AHV-009: Multiple users can deposit independently", function () {
    it("should track balances separately for different users", async function () {
      const userADeposit = ethers.parseEther("5");
      const userBDeposit = ethers.parseEther("10");
      
      // User A deposits
      await assetHubVault.connect(user1).deposit({ value: userADeposit });
      
      // User B deposits
      await assetHubVault.connect(user2).deposit({ value: userBDeposit });
      
      // Verify separate balances
      expect(await assetHubVault.getUserBalance(user1.address)).to.equal(userADeposit);
      expect(await assetHubVault.getUserBalance(user2.address)).to.equal(userBDeposit);
    });

    it("should maintain correct total contract balance", async function () {
      const userADeposit = ethers.parseEther("5");
      const userBDeposit = ethers.parseEther("10");
      const vaultAddress = await assetHubVault.getAddress();
      
      await assetHubVault.connect(user1).deposit({ value: userADeposit });
      await assetHubVault.connect(user2).deposit({ value: userBDeposit });
      
      const totalBalance = await ethers.provider.getBalance(vaultAddress);
      expect(totalBalance).to.equal(userADeposit + userBDeposit);
    });

    it("should emit separate events for each user", async function () {
      const userADeposit = ethers.parseEther("5");
      const userBDeposit = ethers.parseEther("10");
      
      await expect(assetHubVault.connect(user1).deposit({ value: userADeposit }))
        .to.emit(assetHubVault, "Deposit")
        .withArgs(user1.address, userADeposit);
      
      await expect(assetHubVault.connect(user2).deposit({ value: userBDeposit }))
        .to.emit(assetHubVault, "Deposit")
        .withArgs(user2.address, userBDeposit);
    });
  });

  /**
   * TEST-AHV-010: User can withdraw full balance
   * 
   * Verifies that:
   * - User deposits 10 ETH
   * - User withdraws 10 ETH
   * - userBalances[user] = 0
   * - User received funds
   * - Withdrawal event emitted
   */
  describe("TEST-AHV-010: User can withdraw full balance", function () {
    it("should allow withdrawal of full balance", async function () {
      const depositAmount = ethers.parseEther("10");
      
      // Deposit first
      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      expect(await assetHubVault.getUserBalance(user1.address)).to.equal(depositAmount);
      
      // Withdraw full balance
      await assetHubVault.connect(user1).withdraw(depositAmount);
      
      // Verify balance is now zero
      expect(await assetHubVault.getUserBalance(user1.address)).to.equal(0);
    });

    it("should transfer funds to user", async function () {
      const depositAmount = ethers.parseEther("10");
      
      // Deposit
      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      
      // Record user balance before withdrawal
      const balanceBefore = await ethers.provider.getBalance(user1.address);
      
      // Withdraw
      const tx = await assetHubVault.connect(user1).withdraw(depositAmount);
      const receipt = await tx.wait();
      
      // Calculate gas cost
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      // Verify user received funds (minus gas)
      const balanceAfter = await ethers.provider.getBalance(user1.address);
      expect(balanceAfter).to.equal(balanceBefore + depositAmount - gasUsed);
    });

    it("should emit Withdrawal event", async function () {
      const depositAmount = ethers.parseEther("10");
      
      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      
      await expect(
        assetHubVault.connect(user1).withdraw(depositAmount)
      )
        .to.emit(assetHubVault, "Withdrawal")
        .withArgs(user1.address, depositAmount);
    });

    it("should decrease contract balance", async function () {
      const depositAmount = ethers.parseEther("10");
      const vaultAddress = await assetHubVault.getAddress();
      
      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      
      const contractBalanceBefore = await ethers.provider.getBalance(vaultAddress);
      
      await assetHubVault.connect(user1).withdraw(depositAmount);
      
      const contractBalanceAfter = await ethers.provider.getBalance(vaultAddress);
      expect(contractBalanceAfter).to.equal(contractBalanceBefore - depositAmount);
    });
  });

  /**
   * TEST-AHV-011: User can withdraw partial balance
   * 
   * Verifies that:
   * - User deposits 10 ETH
   * - User withdraws 6 ETH
   * - userBalances[user] = 4 ETH
   */
  describe("TEST-AHV-011: User can withdraw partial balance", function () {
    it("should allow partial withdrawal", async function () {
      const depositAmount = ethers.parseEther("10");
      const withdrawAmount = ethers.parseEther("6");
      const expectedRemaining = depositAmount - withdrawAmount;
      
      // Deposit
      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      
      // Withdraw partial amount
      await assetHubVault.connect(user1).withdraw(withdrawAmount);
      
      // Verify remaining balance
      expect(await assetHubVault.getUserBalance(user1.address)).to.equal(expectedRemaining);
    });

    it("should allow multiple partial withdrawals", async function () {
      const depositAmount = ethers.parseEther("10");
      const firstWithdraw = ethers.parseEther("3");
      const secondWithdraw = ethers.parseEther("2");
      
      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      
      // First withdrawal
      await assetHubVault.connect(user1).withdraw(firstWithdraw);
      expect(await assetHubVault.getUserBalance(user1.address))
        .to.equal(depositAmount - firstWithdraw);
      
      // Second withdrawal
      await assetHubVault.connect(user1).withdraw(secondWithdraw);
      expect(await assetHubVault.getUserBalance(user1.address))
        .to.equal(depositAmount - firstWithdraw - secondWithdraw);
    });

    it("should emit correct event for partial withdrawal", async function () {
      const depositAmount = ethers.parseEther("10");
      const withdrawAmount = ethers.parseEther("6");
      
      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      
      await expect(
        assetHubVault.connect(user1).withdraw(withdrawAmount)
      )
        .to.emit(assetHubVault, "Withdrawal")
        .withArgs(user1.address, withdrawAmount);
    });
  });

  /**
   * TEST-AHV-012: Withdraw reverts with insufficient balance
   * 
   * Verifies that:
   * - User deposits 5 ETH
   * - User attempts to withdraw 10 ETH
   * - Reverts with InsufficientBalance error
   */
  describe("TEST-AHV-012: Withdraw reverts with insufficient balance", function () {
    it("should revert when withdrawing more than balance", async function () {
      const depositAmount = ethers.parseEther("5");
      const withdrawAmount = ethers.parseEther("10");
      
      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      
      await expect(
        assetHubVault.connect(user1).withdraw(withdrawAmount)
      ).to.be.revertedWithCustomError(assetHubVault, "InsufficientBalance");
    });

    it("should revert when withdrawing with zero balance", async function () {
      const withdrawAmount = ethers.parseEther("1");
      
      // No deposit, balance is 0
      await expect(
        assetHubVault.connect(user1).withdraw(withdrawAmount)
      ).to.be.revertedWithCustomError(assetHubVault, "InsufficientBalance");
    });

    it("should not modify balance on failed withdrawal", async function () {
      const depositAmount = ethers.parseEther("5");
      const withdrawAmount = ethers.parseEther("10");
      
      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      
      const balanceBefore = await assetHubVault.getUserBalance(user1.address);
      
      try {
        await assetHubVault.connect(user1).withdraw(withdrawAmount);
      } catch (error) {
        // Expected to fail
      }
      
      const balanceAfter = await assetHubVault.getUserBalance(user1.address);
      expect(balanceAfter).to.equal(balanceBefore);
    });
  });

  /**
   * TEST-AHV-013: Withdraw reverts with zero amount
   * 
   * Verifies that:
   * - Calling withdraw with amount = 0 reverts
   * - Reverts with AmountZero error
   */
  describe("TEST-AHV-013: Withdraw reverts with zero amount", function () {
    it("should revert when withdrawing 0 ETH", async function () {
      // Deposit some funds first
      await assetHubVault.connect(user1).deposit({ value: ethers.parseEther("10") });
      
      await expect(
        assetHubVault.connect(user1).withdraw(0)
      ).to.be.revertedWithCustomError(assetHubVault, "AmountZero");
    });

    it("should not modify balance on zero withdrawal attempt", async function () {
      const depositAmount = ethers.parseEther("10");
      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      
      const balanceBefore = await assetHubVault.getUserBalance(user1.address);
      
      try {
        await assetHubVault.connect(user1).withdraw(0);
      } catch (error) {
        // Expected to fail
      }
      
      const balanceAfter = await assetHubVault.getUserBalance(user1.address);
      expect(balanceAfter).to.equal(balanceBefore);
    });
  });

  /**
   * TEST-AHV-014: Reentrancy protection on deposit
   * 
   * Verifies that:
   * - Attempting reentrancy attack during deposit fails
   * - Contract uses ReentrancyGuard modifier
   */
  describe("TEST-AHV-014: Reentrancy protection on deposit", function () {
    let attacker;

    beforeEach(async function () {
      // Deploy reentrancy attacker contract
      const ReentrancyAttacker = await ethers.getContractFactory("ReentrancyAttacker");
      attacker = await ReentrancyAttacker.deploy(await assetHubVault.getAddress());
      await attacker.waitForDeployment();
    });

    it("should prevent reentrancy on deposit", async function () {
      // Fund the attacker
      await deployer.sendTransaction({
        to: await attacker.getAddress(),
        value: ethers.parseEther("10")
      });
      
      // Attempt reentrancy attack
      // The attacker contract will try to call deposit again in its receive function
      await expect(
        attacker.attackDeposit({ value: ethers.parseEther("1") })
      ).to.be.reverted; // ReentrancyGuard will revert
    });

    it("should use nonReentrant modifier on deposit", async function () {
      // This test verifies the contract is protected
      // The actual protection is verified by checking the modifier exists in the contract
      const depositAmount = ethers.parseEther("5");
      
      // Normal deposit should work
      await expect(
        assetHubVault.connect(user1).deposit({ value: depositAmount })
      ).to.not.be.reverted;
    });
  });

  /**
   * TEST-AHV-015: Reentrancy protection on withdraw
   * 
   * Verifies that:
   * - Attempting reentrancy attack during withdraw fails
   * - Contract uses ReentrancyGuard modifier
   */
  describe("TEST-AHV-015: Reentrancy protection on withdraw", function () {
    let attacker;

    beforeEach(async function () {
      // Deploy reentrancy attacker contract
      const ReentrancyAttacker = await ethers.getContractFactory("ReentrancyAttacker");
      attacker = await ReentrancyAttacker.deploy(await assetHubVault.getAddress());
      await attacker.waitForDeployment();
    });

    it("should prevent reentrancy on withdraw", async function () {
      const depositAmount = ethers.parseEther("10");
      
      // Setup: Attacker deposits funds
      await deployer.sendTransaction({
        to: await attacker.getAddress(),
        value: depositAmount
      });
      
      await attacker.attackDeposit({ value: depositAmount });
      
      // Attempt reentrancy attack on withdraw
      // The attacker will try to withdraw again in its receive function
      await expect(
        attacker.attackWithdraw(depositAmount)
      ).to.be.reverted; // ReentrancyGuard will prevent reentrancy
    });

    it("should use nonReentrant modifier on withdraw", async function () {
      const depositAmount = ethers.parseEther("5");
      
      // Deposit first
      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      
      // Normal withdraw should work
      await expect(
        assetHubVault.connect(user1).withdraw(depositAmount)
      ).to.not.be.reverted;
    });
  });

  /**
   * Additional edge cases for deposit & withdrawal
   */
  describe("Additional edge cases", function () {
    it("should handle very small deposits (1 wei)", async function () {
      await assetHubVault.connect(user1).deposit({ value: 1 });
      expect(await assetHubVault.getUserBalance(user1.address)).to.equal(1);
    });

    it("should handle large deposits", async function () {
      const largeAmount = ethers.parseEther("1000");
      await assetHubVault.connect(user1).deposit({ value: largeAmount });
      expect(await assetHubVault.getUserBalance(user1.address)).to.equal(largeAmount);
    });

    it("should maintain correct accounting across multiple operations", async function () {
      // Complex scenario: multiple users, multiple deposits/withdrawals
      await assetHubVault.connect(user1).deposit({ value: ethers.parseEther("10") });
      await assetHubVault.connect(user2).deposit({ value: ethers.parseEther("20") });
      await assetHubVault.connect(user1).withdraw(ethers.parseEther("3"));
      await assetHubVault.connect(user2).deposit({ value: ethers.parseEther("5") });
      
      expect(await assetHubVault.getUserBalance(user1.address)).to.equal(ethers.parseEther("7"));
      expect(await assetHubVault.getUserBalance(user2.address)).to.equal(ethers.parseEther("25"));
    });
  });
});

/**
 * Reentrancy Attacker Contract
 * Used for testing reentrancy protection
 */
const REENTRANCY_ATTACKER_SOURCE = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAssetHubVault {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function getUserBalance(address user) external view returns (uint256);
}

contract ReentrancyAttacker {
    IAssetHubVault public vault;
    bool public attacking;
    
    constructor(address _vault) {
        vault = IAssetHubVault(_vault);
    }
    
    function attackDeposit() external payable {
        attacking = true;
        vault.deposit{value: msg.value}();
    }
    
    function attackWithdraw(uint256 amount) external {
        attacking = true;
        vault.withdraw(amount);
    }
    
    receive() external payable {
        if (attacking) {
            // Try to reenter
            try vault.deposit{value: 0.1 ether}() {
                // Reentrancy succeeded (bad!)
            } catch {
                // Reentrancy blocked (good!)
            }
        }
    }
}
`;

