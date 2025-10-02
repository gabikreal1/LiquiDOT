/**
 * XCMProxy Access Control Tests
 * 
 * Covers TEST-XP-003 to TEST-XP-006 from TESTING-REQUIREMENTS.md
 * 
 * Tests:
 * - Owner-only functions
 * - Operator-only functions
 * - Role transfers
 * - Pause/unpause functionality
 * 
 * Usage:
 *   npx hardhat test test/XCMProxy/2.access.test.js
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("XCMProxy - Access Control", function () {
  let xcmProxy;
  let owner, operator, user1, user2;
  let mockQuoter, mockRouter, mockNFPM;

  beforeEach(async function () {
    [owner, operator, user1, user2] = await ethers.getSigners();

    // Deploy mock contracts
    const MockERC20 = await ethers.getContractFactory("contracts/test/MockERC20.sol:MockERC20");
    mockQuoter = await MockERC20.deploy("Mock Quoter", "QUOT");
    mockRouter = await MockERC20.deploy("Mock Router", "ROUT");
    mockNFPM = await MockERC20.deploy("Mock NFPM", "NFPM");

    // Deploy XCMProxy
    const XCMProxy = await ethers.getContractFactory("contracts/V1(Current)/XCMProxy.sol:XCMProxy");
    xcmProxy = await XCMProxy.deploy(
      await mockQuoter.getAddress(),
      await mockRouter.getAddress()
    );
    await xcmProxy.waitForDeployment();

    // Set operator to a different address
    await xcmProxy.connect(owner).setOperator(operator.address);
  });

  /**
   * TEST-XP-003: Only owner can call owner functions
   */
  describe("TEST-XP-003: Owner-only functions", function () {
    it("should allow owner to set integrations", async function () {
      await expect(
        xcmProxy.connect(owner).setIntegrations(
          await mockQuoter.getAddress(),
          await mockRouter.getAddress()
        )
      ).to.not.be.reverted;
    });

    it("should reject non-owner setting integrations", async function () {
      await expect(
        xcmProxy.connect(user1).setIntegrations(
          await mockQuoter.getAddress(),
          await mockRouter.getAddress()
        )
      ).to.be.revertedWithCustomError(xcmProxy, "OwnableUnauthorizedAccount");
    });

    it("should allow owner to set NFPM", async function () {
      await expect(
        xcmProxy.connect(owner).setNFPM(await mockNFPM.getAddress())
      ).to.not.be.reverted;
    });

    it("should reject non-owner setting NFPM", async function () {
      await expect(
        xcmProxy.connect(user1).setNFPM(await mockNFPM.getAddress())
      ).to.be.revertedWithCustomError(xcmProxy, "OwnableUnauthorizedAccount");
    });

    it("should allow owner to set XTokens precompile", async function () {
      const precompile = "0x0000000000000000000000000000000000000804";
      
      await expect(
        xcmProxy.connect(owner).setXTokensPrecompile(precompile)
      ).to.not.be.reverted;
    });

    it("should reject non-owner setting XTokens precompile", async function () {
      const precompile = "0x0000000000000000000000000000000000000804";
      
      await expect(
        xcmProxy.connect(user1).setXTokensPrecompile(precompile)
      ).to.be.revertedWithCustomError(xcmProxy, "OwnableUnauthorizedAccount");
    });

    it("should allow owner to add supported tokens", async function () {
      const tokenAddress = "0x1111111111111111111111111111111111111111";
      
      await expect(
        xcmProxy.connect(owner).addSupportedToken(tokenAddress)
      ).to.not.be.reverted;
    });

    it("should reject non-owner adding supported tokens", async function () {
      const tokenAddress = "0x1111111111111111111111111111111111111111";
      
      await expect(
        xcmProxy.connect(user1).addSupportedToken(tokenAddress)
      ).to.be.revertedWithCustomError(xcmProxy, "OwnableUnauthorizedAccount");
    });

    it("should allow owner to remove supported tokens", async function () {
      const tokenAddress = "0x1111111111111111111111111111111111111111";
      await xcmProxy.connect(owner).addSupportedToken(tokenAddress);
      
      await expect(
        xcmProxy.connect(owner).removeSupportedToken(tokenAddress)
      ).to.not.be.reverted;
    });

    it("should reject non-owner removing supported tokens", async function () {
      const tokenAddress = "0x1111111111111111111111111111111111111111";
      await xcmProxy.connect(owner).addSupportedToken(tokenAddress);
      
      await expect(
        xcmProxy.connect(user1).removeSupportedToken(tokenAddress)
      ).to.be.revertedWithCustomError(xcmProxy, "OwnableUnauthorizedAccount");
    });

    it("should allow owner to set slippage", async function () {
      await expect(
        xcmProxy.connect(owner).setDefaultSlippage(100) // 1%
      ).to.not.be.reverted;
    });

    it("should reject non-owner setting slippage", async function () {
      await expect(
        xcmProxy.connect(user1).setDefaultSlippage(100)
      ).to.be.revertedWithCustomError(xcmProxy, "OwnableUnauthorizedAccount");
    });

    it("should allow owner to pause contract", async function () {
      await expect(
        xcmProxy.connect(owner).pause()
      ).to.not.be.reverted;
    });

    it("should reject non-owner pausing contract", async function () {
      await expect(
        xcmProxy.connect(user1).pause()
      ).to.be.revertedWithCustomError(xcmProxy, "OwnableUnauthorizedAccount");
    });

    it("should allow owner to unpause contract", async function () {
      await xcmProxy.connect(owner).pause();
      
      await expect(
        xcmProxy.connect(owner).unpause()
      ).to.not.be.reverted;
    });

    it("should reject non-owner unpausing contract", async function () {
      await xcmProxy.connect(owner).pause();
      
      await expect(
        xcmProxy.connect(user1).unpause()
      ).to.be.revertedWithCustomError(xcmProxy, "OwnableUnauthorizedAccount");
    });

    it("should allow owner to set test mode", async function () {
      await expect(
        xcmProxy.connect(owner).setTestMode(true)
      ).to.not.be.reverted;
    });

    it("should reject non-owner setting test mode", async function () {
      await expect(
        xcmProxy.connect(user1).setTestMode(true)
      ).to.be.revertedWithCustomError(xcmProxy, "OwnableUnauthorizedAccount");
    });

    it("should allow owner to freeze XCM config", async function () {
      await expect(
        xcmProxy.connect(owner).freezeXcmConfig()
      ).to.not.be.reverted;
    });

    it("should reject non-owner freezing XCM config", async function () {
      await expect(
        xcmProxy.connect(user1).freezeXcmConfig()
      ).to.be.revertedWithCustomError(xcmProxy, "OwnableUnauthorizedAccount");
    });
  });

  /**
   * TEST-XP-004: Only operator can call operator functions
   */
  describe("TEST-XP-004: Operator-only functions", function () {
    beforeEach(async function () {
      // Setup for operator tests
      await xcmProxy.setNFPM(await mockNFPM.getAddress());
      await xcmProxy.setTestMode(true);
    });

    it("should allow operator to execute investment", async function () {
      // This will fail in execution but should pass access control
      // We just verify it doesn't revert due to access control
      const poolAddress = "0x1111111111111111111111111111111111111111";
      const baseAsset = "0x2222222222222222222222222222222222222222";
      
      // Will fail for other reasons (pool doesn't exist, etc) but NOT access control
      await expect(
        xcmProxy.connect(operator).executeInvestment(
          user1.address,
          poolAddress,
          baseAsset,
          ethers.parseEther("1"),
          -5,
          5,
          "0x123456"
        )
      ).to.not.be.revertedWithCustomError(xcmProxy, "NotOperator");
    });

    it("should reject non-operator executing investment", async function () {
      const poolAddress = "0x1111111111111111111111111111111111111111";
      const baseAsset = "0x2222222222222222222222222222222222222222";
      
      await expect(
        xcmProxy.connect(user1).executeInvestment(
          user1.address,
          poolAddress,
          baseAsset,
          ethers.parseEther("1"),
          -5,
          5,
          "0x123456"
        )
      ).to.be.revertedWithCustomError(xcmProxy, "NotOperator");
    });

    it("should allow operator to liquidate position", async function () {
      // Will fail for other reasons but NOT access control
      const positionId = "0x1234567890123456789012345678901234567890123456789012345678901234";
      
      await expect(
        xcmProxy.connect(operator).liquidatePosition(positionId)
      ).to.not.be.revertedWithCustomError(xcmProxy, "NotOperator");
    });

    it("should reject non-operator liquidating position", async function () {
      const positionId = "0x1234567890123456789012345678901234567890123456789012345678901234";
      
      await expect(
        xcmProxy.connect(user1).liquidatePosition(positionId)
      ).to.be.revertedWithCustomError(xcmProxy, "NotOperator");
    });

    it("should allow operator to collect fees", async function () {
      const positionId = "0x1234567890123456789012345678901234567890123456789012345678901234";
      
      await expect(
        xcmProxy.connect(operator).collectFees(positionId)
      ).to.not.be.revertedWithCustomError(xcmProxy, "NotOperator");
    });

    it("should reject non-operator collecting fees", async function () {
      const positionId = "0x1234567890123456789012345678901234567890123456789012345678901234";
      
      await expect(
        xcmProxy.connect(user1).collectFees(positionId)
      ).to.be.revertedWithCustomError(xcmProxy, "NotOperator");
    });

    it("should allow owner to act as operator initially", async function () {
      // Owner is also operator initially
      const XCMProxy = await ethers.getContractFactory("contracts/V1(Current)/XCMProxy.sol:XCMProxy");
      const newProxy = await XCMProxy.deploy(
        await mockQuoter.getAddress(),
        await mockRouter.getAddress()
      );
      await newProxy.waitForDeployment();

      // Owner should be operator
      expect(await newProxy.operator()).to.equal(owner.address);
    });
  });

  /**
   * TEST-XP-005: Owner can update operator
   */
  describe("TEST-XP-005: Operator role transfer", function () {
    it("should allow owner to set new operator", async function () {
      await xcmProxy.connect(owner).setOperator(user1.address);
      
      expect(await xcmProxy.operator()).to.equal(user1.address);
    });

    it("should emit event when operator is changed", async function () {
      await expect(
        xcmProxy.connect(owner).setOperator(user1.address)
      )
        .to.emit(xcmProxy, "OperatorSet")
        .withArgs(user1.address);
    });

    it("should allow new operator to call operator functions", async function () {
      await xcmProxy.connect(owner).setOperator(user1.address);
      await xcmProxy.connect(owner).setTestMode(true);
      await xcmProxy.connect(owner).setNFPM(await mockNFPM.getAddress());

      const positionId = "0x1234567890123456789012345678901234567890123456789012345678901234";
      
      // user1 is now operator
      await expect(
        xcmProxy.connect(user1).liquidatePosition(positionId)
      ).to.not.be.revertedWithCustomError(xcmProxy, "NotOperator");
    });

    it("should prevent old operator from calling operator functions", async function () {
      await xcmProxy.connect(owner).setOperator(user1.address);

      const positionId = "0x1234567890123456789012345678901234567890123456789012345678901234";
      
      // operator is no longer the operator
      await expect(
        xcmProxy.connect(operator).liquidatePosition(positionId)
      ).to.be.revertedWithCustomError(xcmProxy, "NotOperator");
    });

    it("should reject setting operator to zero address", async function () {
      await expect(
        xcmProxy.connect(owner).setOperator(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(xcmProxy, "ZeroAddress");
    });

    it("should reject non-owner setting operator", async function () {
      await expect(
        xcmProxy.connect(user1).setOperator(user2.address)
      ).to.be.revertedWithCustomError(xcmProxy, "OwnableUnauthorizedAccount");
    });
  });

  /**
   * TEST-XP-006: Pause/unpause functionality
   */
  describe("TEST-XP-006: Pause/Unpause", function () {
    it("should pause contract", async function () {
      await xcmProxy.connect(owner).pause();
      
      expect(await xcmProxy.paused()).to.equal(true);
    });

    it("should unpause contract", async function () {
      await xcmProxy.connect(owner).pause();
      await xcmProxy.connect(owner).unpause();
      
      expect(await xcmProxy.paused()).to.equal(false);
    });

    it("should emit Paused event", async function () {
      await expect(
        xcmProxy.connect(owner).pause()
      ).to.emit(xcmProxy, "Paused");
    });

    it("should emit Unpaused event", async function () {
      await xcmProxy.connect(owner).pause();
      
      await expect(
        xcmProxy.connect(owner).unpause()
      ).to.emit(xcmProxy, "Unpaused");
    });

    it("should block operations when paused", async function () {
      await xcmProxy.connect(owner).setTestMode(true);
      await xcmProxy.connect(owner).setNFPM(await mockNFPM.getAddress());
      await xcmProxy.connect(owner).pause();

      const poolAddress = "0x1111111111111111111111111111111111111111";
      const baseAsset = "0x2222222222222222222222222222222222222222";
      
      await expect(
        xcmProxy.connect(operator).executeInvestment(
          user1.address,
          poolAddress,
          baseAsset,
          ethers.parseEther("1"),
          -5,
          5,
          "0x123456"
        )
      ).to.be.revertedWithCustomError(xcmProxy, "EnforcedPause");
    });

    it("should allow operations when unpaused", async function () {
      await xcmProxy.connect(owner).setTestMode(true);
      await xcmProxy.connect(owner).setNFPM(await mockNFPM.getAddress());
      await xcmProxy.connect(owner).pause();
      await xcmProxy.connect(owner).unpause();

      const poolAddress = "0x1111111111111111111111111111111111111111";
      const baseAsset = "0x2222222222222222222222222222222222222222";
      
      // Should fail for other reasons, but NOT because it's paused
      await expect(
        xcmProxy.connect(operator).executeInvestment(
          user1.address,
          poolAddress,
          baseAsset,
          ethers.parseEther("1"),
          -5,
          5,
          "0x123456"
        )
      ).to.not.be.revertedWithCustomError(xcmProxy, "EnforcedPause");
    });

    it("should not allow pausing when already paused", async function () {
      await xcmProxy.connect(owner).pause();
      
      await expect(
        xcmProxy.connect(owner).pause()
      ).to.be.revertedWithCustomError(xcmProxy, "EnforcedPause");
    });

    it("should not allow unpausing when not paused", async function () {
      await expect(
        xcmProxy.connect(owner).unpause()
      ).to.be.revertedWithCustomError(xcmProxy, "ExpectedPause");
    });
  });

  describe("Ownership Transfer", function () {
    it("should allow owner to transfer ownership", async function () {
      await xcmProxy.connect(owner).transferOwnership(user1.address);
      
      // Ownership transfer needs to be accepted in OpenZeppelin v5
      await xcmProxy.connect(user1).acceptOwnership();
      
      expect(await xcmProxy.owner()).to.equal(user1.address);
    });

    it("should prevent old owner from calling owner functions after transfer", async function () {
      await xcmProxy.connect(owner).transferOwnership(user1.address);
      await xcmProxy.connect(user1).acceptOwnership();

      await expect(
        xcmProxy.connect(owner).pause()
      ).to.be.revertedWithCustomError(xcmProxy, "OwnableUnauthorizedAccount");
    });

    it("should allow new owner to call owner functions", async function () {
      await xcmProxy.connect(owner).transferOwnership(user1.address);
      await xcmProxy.connect(user1).acceptOwnership();

      await expect(
        xcmProxy.connect(user1).pause()
      ).to.not.be.reverted;
    });
  });
});

