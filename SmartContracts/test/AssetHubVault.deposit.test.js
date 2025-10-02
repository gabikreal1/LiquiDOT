const { expect } = require("chai");
const { ethers } = require("hardhat");
const { setupTestEnvironment, mintTokens } = require("./setup/test-environment");

describe("AssetHubVault - Deposit & Withdrawal", function () {
    let env;
    let assetHubVault, user1, user2;
    
    beforeEach(async function () {
        // Setup complete test environment with REAL contracts
        env = await setupTestEnvironment();
        
        assetHubVault = env.assetHubVault;
        user1 = env.user1;
        user2 = env.user2;
    });
    
    describe("Deposit", function () {
        
        it("TEST-AHV-007: User can deposit native tokens", async function () {
            const depositAmount = ethers.utils.parseEther("10");
            
            // User deposits
            await expect(
                assetHubVault.connect(user1).deposit({ value: depositAmount })
            ).to.emit(assetHubVault, "Deposit")
              .withArgs(user1.address, depositAmount);
            
            // Check balance updated
            const balance = await assetHubVault.getUserBalance(user1.address);
            expect(balance).to.equal(depositAmount);
            
            // Check contract received funds
            const contractBalance = await ethers.provider.getBalance(assetHubVault.address);
            expect(contractBalance).to.equal(depositAmount);
        });
        
        it("TEST-AHV-008: Deposit reverts with zero amount", async function () {
            await expect(
                assetHubVault.connect(user1).deposit({ value: 0 })
            ).to.be.revertedWithCustomError(assetHubVault, "AmountZero");
        });
        
        it("TEST-AHV-009: Multiple users can deposit independently", async function () {
            const amount1 = ethers.utils.parseEther("5");
            const amount2 = ethers.utils.parseEther("10");
            
            // User 1 deposits
            await assetHubVault.connect(user1).deposit({ value: amount1 });
            
            // User 2 deposits
            await assetHubVault.connect(user2).deposit({ value: amount2 });
            
            // Check balances tracked separately
            expect(await assetHubVault.getUserBalance(user1.address)).to.equal(amount1);
            expect(await assetHubVault.getUserBalance(user2.address)).to.equal(amount2);
        });
        
    });
    
    describe("Withdrawal", function () {
        
        it("TEST-AHV-010: User can withdraw full balance", async function () {
            const depositAmount = ethers.utils.parseEther("10");
            
            // Deposit first
            await assetHubVault.connect(user1).deposit({ value: depositAmount });
            
            // Withdraw
            const balanceBefore = await ethers.provider.getBalance(user1.address);
            
            const tx = await assetHubVault.connect(user1).withdraw(depositAmount);
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
            
            // Check event emitted
            await expect(tx)
                .to.emit(assetHubVault, "Withdrawal")
                .withArgs(user1.address, depositAmount);
            
            // Check user balance updated
            expect(await assetHubVault.getUserBalance(user1.address)).to.equal(0);
            
            // Check user received funds (minus gas)
            const balanceAfter = await ethers.provider.getBalance(user1.address);
            expect(balanceAfter).to.equal(balanceBefore.add(depositAmount).sub(gasUsed));
        });
        
        it("TEST-AHV-011: User can withdraw partial balance", async function () {
            const depositAmount = ethers.utils.parseEther("10");
            const withdrawAmount = ethers.utils.parseEther("6");
            const remaining = depositAmount.sub(withdrawAmount);
            
            // Deposit
            await assetHubVault.connect(user1).deposit({ value: depositAmount });
            
            // Partial withdrawal
            await assetHubVault.connect(user1).withdraw(withdrawAmount);
            
            // Check remaining balance
            expect(await assetHubVault.getUserBalance(user1.address)).to.equal(remaining);
        });
        
        it("TEST-AHV-012: Withdraw reverts with insufficient balance", async function () {
            const depositAmount = ethers.utils.parseEther("5");
            const withdrawAmount = ethers.utils.parseEther("10");
            
            // Deposit
            await assetHubVault.connect(user1).deposit({ value: depositAmount });
            
            // Try to withdraw more than balance
            await expect(
                assetHubVault.connect(user1).withdraw(withdrawAmount)
            ).to.be.revertedWithCustomError(assetHubVault, "InsufficientBalance");
        });
        
        it("TEST-AHV-013: Withdraw reverts with zero amount", async function () {
            await expect(
                assetHubVault.connect(user1).withdraw(0)
            ).to.be.revertedWithCustomError(assetHubVault, "AmountZero");
        });
        
    });
    
    describe("Reentrancy Protection", function () {
        
        it("TEST-AHV-014: Reentrancy protection on deposit", async function () {
            // Deploy malicious contract that attempts reentrancy
            const MaliciousDepositor = await ethers.getContractFactory("MaliciousDepositor");
            const malicious = await MaliciousDepositor.deploy(assetHubVault.address);
            
            // Fund malicious contract
            await user1.sendTransaction({
                to: malicious.address,
                value: ethers.utils.parseEther("10")
            });
            
            // Attempt reentrancy attack
            await expect(
                malicious.attack()
            ).to.be.revertedWith("ReentrancyGuard: reentrant call");
        });
        
        it("TEST-AHV-015: Reentrancy protection on withdraw", async function () {
            // Similar test for withdrawal reentrancy
            const MaliciousWithdrawer = await ethers.getContractFactory("MaliciousWithdrawer");
            const malicious = await MaliciousWithdrawer.deploy(assetHubVault.address);
            
            // Deposit from malicious contract
            await malicious.deposit({ value: ethers.utils.parseEther("10") });
            
            // Attempt reentrancy attack on withdrawal
            await expect(
                malicious.attack()
            ).to.be.revertedWith("ReentrancyGuard: reentrant call");
        });
        
    });
});

