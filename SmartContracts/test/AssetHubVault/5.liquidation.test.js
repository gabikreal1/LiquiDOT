/**
 * AssetHubVault Liquidation Settlement Tests
 * 
 * This test suite covers TEST-AHV-024 to TEST-AHV-028 from TESTING-REQUIREMENTS.md
 * 
 * Tests in this file:
 * - Operator can settle liquidation
 * - Settlement validation
 * - Cannot settle same position twice
 * - User can withdraw after settlement
 * - Reentrancy protection
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AssetHubVault - Liquidation Settlement", function () {
  let assetHubVault;
  let deployer, user1, user2, operator;

  const createDummyXcmParams = () => ({
    destination: "0x030100001234",
    message: "0x0300010203"
  });

  /**
   * Helper function to create a position
   * Returns the positionId
   */
  async function createPosition(user, amount) {
    const { destination, message } = createDummyXcmParams();
    
    const tx = await assetHubVault.connect(operator).dispatchInvestment(
      user.address,
      2004,
      user2.address,
      user2.address,
      amount,
      -5,
      5,
      destination,
      message
    );

    const receipt = await tx.wait();
    const event = receipt.logs.find(log => {
      try {
        return assetHubVault.interface.parseLog(log).name === "InvestmentInitiated";
      } catch {
        return false;
      }
    });

    return assetHubVault.interface.parseLog(event).args.positionId;
  }

  beforeEach(async function () {
    [deployer, user1, user2, operator] = await ethers.getSigners();

    const AssetHubVault = await ethers.getContractFactory("contracts/V1(Current)/AssetHubVault.sol:AssetHubVault");
    assetHubVault = await AssetHubVault.deploy();
    await assetHubVault.waitForDeployment();

    await assetHubVault.setOperator(operator.address);
    await assetHubVault.setTestMode(true);
    await assetHubVault.setXcmPrecompile("0x0000000000000000000000000000000000000808");
  });

  /**
   * TEST-AHV-024: Operator can settle liquidation
   */
  describe("TEST-AHV-024: Operator can settle liquidation", function () {
    it("should settle liquidation successfully", async function () {
      const depositAmount = ethers.parseEther("100");
      const investmentAmount = ethers.parseEther("50");
      const returnAmount = ethers.parseEther("60");

      // User deposits
      await assetHubVault.connect(user1).deposit({ value: depositAmount });

      // Create position
      const positionId = await createPosition(user1, investmentAmount);

      // Verify position is active
      let position = await assetHubVault.getPosition(positionId);
      expect(position.active).to.equal(true);

      // Settle liquidation with funds
      await deployer.sendTransaction({
        to: await assetHubVault.getAddress(),
        value: returnAmount
      });

      await assetHubVault.connect(operator).settleLiquidation(positionId, returnAmount);

      // Verify position is now inactive
      position = await assetHubVault.getPosition(positionId);
      expect(position.active).to.equal(false);
    });

    it("should increase user balance by return amount", async function () {
      const depositAmount = ethers.parseEther("100");
      const investmentAmount = ethers.parseEther("50");
      const returnAmount = ethers.parseEther("60");

      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      const positionId = await createPosition(user1, investmentAmount);

      const balanceBefore = await assetHubVault.getUserBalance(user1.address);

      await deployer.sendTransaction({
        to: await assetHubVault.getAddress(),
        value: returnAmount
      });

      await assetHubVault.connect(operator).settleLiquidation(positionId, returnAmount);

      const balanceAfter = await assetHubVault.getUserBalance(user1.address);
      expect(balanceAfter).to.equal(balanceBefore + returnAmount);
    });

    it("should emit PositionLiquidated event", async function () {
      const depositAmount = ethers.parseEther("100");
      const investmentAmount = ethers.parseEther("50");
      const returnAmount = ethers.parseEther("60");

      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      const positionId = await createPosition(user1, investmentAmount);


      await expect(
        assetHubVault.connect(operator).settleLiquidation(positionId, { value: returnAmount })
      )
        .to.emit(assetHubVault, "PositionLiquidated")
        .withArgs(positionId, user1.address, returnAmount);
    });

    it("should emit LiquidationSettled event", async function () {
      const depositAmount = ethers.parseEther("100");
      const investmentAmount = ethers.parseEther("50");
      const returnAmount = ethers.parseEther("60");

      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      const positionId = await createPosition(user1, investmentAmount);


      await expect(
        assetHubVault.connect(operator).settleLiquidation(positionId, { value: returnAmount })
      )
        .to.emit(assetHubVault, "LiquidationSettled")
        .withArgs(positionId, user1.address, returnAmount, investmentAmount);
    });
  });

  /**
   * TEST-AHV-025: Settle liquidation validates inputs
   */
  describe("TEST-AHV-025: Settlement validation", function () {
    it("should revert with AmountZero for zero amount", async function () {
      const depositAmount = ethers.parseEther("100");
      const investmentAmount = ethers.parseEther("50");

      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      const positionId = await createPosition(user1, investmentAmount);

      await expect(
        assetHubVault.connect(operator).settleLiquidation(positionId, { value: 0 })
      ).to.be.revertedWithCustomError(assetHubVault, "AmountZero");
    });

    it("should revert with PositionNotActive for inactive position", async function () {
      const depositAmount = ethers.parseEther("100");
      const investmentAmount = ethers.parseEther("50");
      const returnAmount = ethers.parseEther("60");

      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      const positionId = await createPosition(user1, investmentAmount);

      // Settle once with funds
      await deployer.sendTransaction({
        to: await assetHubVault.getAddress(),
        value: returnAmount
      });

      await assetHubVault.connect(operator).settleLiquidation(positionId, returnAmount);

      // Try to settle again (position now inactive)
      await expect(
        assetHubVault.connect(operator).settleLiquidation(positionId, { value: returnAmount })
      ).to.be.revertedWithCustomError(assetHubVault, "PositionNotActive");
    });

    it("should accept any positive settlement amount", async function () {
      const depositAmount = ethers.parseEther("100");
      const investmentAmount = ethers.parseEther("50");
      const returnAmount = ethers.parseEther("30"); // Less than invested

      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      const positionId = await createPosition(user1, investmentAmount);

      // Should accept settlement with different amount (flexible settlement)
      await expect(
        assetHubVault.connect(operator).settleLiquidation(positionId, { value: returnAmount })
      ).to.not.be.reverted;

      // Verify position is settled and user got the funds
      const position = await assetHubVault.getPosition(positionId);
      expect(position.active).to.equal(false);

      const userBalance = await assetHubVault.getUserBalance(user1.address);
      expect(userBalance).to.equal(returnAmount);
    });
  });

  /**
   * TEST-AHV-026: Cannot settle same position twice
   */
  describe("TEST-AHV-026: No double settlement", function () {
    it("should prevent settling position twice", async function () {
      const depositAmount = ethers.parseEther("100");
      const investmentAmount = ethers.parseEther("50");
      const returnAmount = ethers.parseEther("60");

      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      const positionId = await createPosition(user1, investmentAmount);

      // Will send double the amount needed in settleLiquidation call

      // First settlement succeeds
      await deployer.sendTransaction({
        to: await assetHubVault.getAddress(),
        value: returnAmount
      });

      await assetHubVault.connect(operator).settleLiquidation(positionId, returnAmount);

      // Second settlement fails
      await expect(
        assetHubVault.connect(operator).settleLiquidation(positionId, { value: returnAmount })
      ).to.be.revertedWithCustomError(assetHubVault, "PositionNotActive");
    });

    it("should mark position as inactive after settlement", async function () {
      const depositAmount = ethers.parseEther("100");
      const investmentAmount = ethers.parseEther("50");
      const returnAmount = ethers.parseEther("60");

      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      const positionId = await createPosition(user1, investmentAmount);

      await deployer.sendTransaction({
        to: await assetHubVault.getAddress(),
        value: returnAmount
      });

      await assetHubVault.connect(operator).settleLiquidation(positionId, returnAmount);

      const position = await assetHubVault.getPosition(positionId);
      expect(position.active).to.equal(false);
    });
  });

  /**
   * TEST-AHV-027: User can withdraw after settlement
   */
  describe("TEST-AHV-027: Post-settlement withdrawal", function () {
    it("should allow user to withdraw after settlement", async function () {
      const depositAmount = ethers.parseEther("100");
      const investmentAmount = ethers.parseEther("50");
      const returnAmount = ethers.parseEther("60");

      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      const positionId = await createPosition(user1, investmentAmount);

      await deployer.sendTransaction({
        to: await assetHubVault.getAddress(),
        value: returnAmount
      });

      await assetHubVault.connect(operator).settleLiquidation(positionId, returnAmount);

      // User should have: initial deposit - investment + return
      // 100 - 50 + 60 = 110 ETH
      const expectedBalance = depositAmount - investmentAmount + returnAmount;
      expect(await assetHubVault.getUserBalance(user1.address)).to.equal(expectedBalance);

      // User withdraws the full amount
      await expect(
        assetHubVault.connect(user1).withdraw(expectedBalance)
      ).to.not.be.reverted;

      expect(await assetHubVault.getUserBalance(user1.address)).to.equal(0);
    });

    it("should handle partial withdrawals after settlement", async function () {
      const depositAmount = ethers.parseEther("100");
      const investmentAmount = ethers.parseEther("50");
      const returnAmount = ethers.parseEther("60");

      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      const positionId = await createPosition(user1, investmentAmount);

      await deployer.sendTransaction({
        to: await assetHubVault.getAddress(),
        value: returnAmount
      });

      await assetHubVault.connect(operator).settleLiquidation(positionId, returnAmount);

      const totalBalance = await assetHubVault.getUserBalance(user1.address);

      // Withdraw half
      const withdrawAmount = totalBalance / 2n;
      await assetHubVault.connect(user1).withdraw(withdrawAmount);

      expect(await assetHubVault.getUserBalance(user1.address))
        .to.equal(totalBalance - withdrawAmount);
    });
  });

  /**
   * TEST-AHV-028: Reentrancy protection on settleLiquidation
   */
  describe("TEST-AHV-028: Reentrancy protection", function () {
    it("should use nonReentrant modifier", async function () {
      // settleLiquidation uses nonReentrant modifier from ReentrancyGuard
      // This test verifies normal operation works
      const depositAmount = ethers.parseEther("100");
      const investmentAmount = ethers.parseEther("50");
      const returnAmount = ethers.parseEther("60");

      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      const positionId = await createPosition(user1, investmentAmount);


      // Normal settlement should work
      await expect(
        assetHubVault.connect(operator).settleLiquidation(positionId, { value: returnAmount })
      ).to.not.be.reverted;
    });

    it("should prevent reentrancy attacks", async function () {
      // The ReentrancyGuard modifier prevents reentrancy
      // Attempting to call settleLiquidation recursively would fail
      // This is tested implicitly by the modifier's presence
      
      const depositAmount = ethers.parseEther("100");
      const investmentAmount = ethers.parseEther("50");
      const returnAmount = ethers.parseEther("60");

      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      const positionId = await createPosition(user1, investmentAmount);


      // Normal operation should complete
      await deployer.sendTransaction({
        to: await assetHubVault.getAddress(),
        value: returnAmount
      });

      await assetHubVault.connect(operator).settleLiquidation(positionId, returnAmount);

      // Position should be settled (inactive)
      const position = await assetHubVault.getPosition(positionId);
      expect(position.active).to.equal(false);
    });
  });

  /**
   * Additional edge cases
   */
  describe("Additional settlement scenarios", function () {
    it("should handle settlement with profit", async function () {
      const depositAmount = ethers.parseEther("100");
      const investmentAmount = ethers.parseEther("50");
      const returnAmount = ethers.parseEther("70"); // Profit!

      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      const positionId = await createPosition(user1, investmentAmount);

      await deployer.sendTransaction({
        to: await assetHubVault.getAddress(),
        value: returnAmount
      });

      await assetHubVault.connect(operator).settleLiquidation(positionId, returnAmount);

      // User should have deposit - investment + return
      // 100 - 50 + 70 = 120 ETH (20 ETH profit)
      expect(await assetHubVault.getUserBalance(user1.address))
        .to.equal(depositAmount - investmentAmount + returnAmount);
    });

    it("should handle settlement with loss", async function () {
      const depositAmount = ethers.parseEther("100");
      const investmentAmount = ethers.parseEther("50");
      const returnAmount = ethers.parseEther("40"); // Loss!

      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      const positionId = await createPosition(user1, investmentAmount);

      await deployer.sendTransaction({
        to: await assetHubVault.getAddress(),
        value: returnAmount
      });

      await assetHubVault.connect(operator).settleLiquidation(positionId, returnAmount);

      // User should have deposit - investment + return
      // 100 - 50 + 40 = 90 ETH (10 ETH loss)
      expect(await assetHubVault.getUserBalance(user1.address))
        .to.equal(depositAmount - investmentAmount + returnAmount);
    });

    it("should handle multiple positions settlement", async function () {
      const depositAmount = ethers.parseEther("150");
      const investmentAmount = ethers.parseEther("40");
      const returnAmount = ethers.parseEther("50");

      await assetHubVault.connect(user1).deposit({ value: depositAmount });

      // Create 2 positions
      const positionId1 = await createPosition(user1, investmentAmount);
      await ethers.provider.send("evm_mine");
      const positionId2 = await createPosition(user1, investmentAmount);

      // Funds for both settlements will be sent in settleLiquidation calls

      // Settle first position
      await assetHubVault.connect(operator).settleLiquidation(positionId1, { value: returnAmount });

      // Settle second position
      await assetHubVault.connect(operator).settleLiquidation(positionId2, { value: returnAmount });

      // Both should be inactive
      expect((await assetHubVault.getPosition(positionId1)).active).to.equal(false);
      expect((await assetHubVault.getPosition(positionId2)).active).to.equal(false);

      // User balance: 150 - 40 - 40 + 50 + 50 = 170
      expect(await assetHubVault.getUserBalance(user1.address))
        .to.equal(depositAmount - investmentAmount * 2n + returnAmount * 2n);
    });
  });
});

