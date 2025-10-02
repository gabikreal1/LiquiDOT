/**
 * XCMProxy Configuration Tests
 * 
 * Covers TEST-XP-007 to TEST-XP-012 from TESTING-REQUIREMENTS.md
 * 
 * Tests:
 * - Supported tokens management
 * - XCM configuration
 * - Slippage settings
 * - Test mode toggle
 * - Configuration freezing
 * 
 * Usage:
 *   npx hardhat test test/XCMProxy/3.config.test.js
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("XCMProxy - Configuration", function () {
  let xcmProxy;
  let owner, user1;
  let mockQuoter, mockRouter;

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();

    // Deploy mock contracts
    const MockERC20 = await ethers.getContractFactory("contracts/test/MockERC20.sol:MockERC20");
    mockQuoter = await MockERC20.deploy("Mock Quoter", "QUOT");
    mockRouter = await MockERC20.deploy("Mock Router", "ROUT");

    // Deploy XCMProxy
    const XCMProxy = await ethers.getContractFactory("contracts/V1(Current)/XCMProxy.sol:XCMProxy");
    xcmProxy = await XCMProxy.deploy(
      await mockQuoter.getAddress(),
      await mockRouter.getAddress()
    );
    await xcmProxy.waitForDeployment();
  });

  /**
   * TEST-XP-007: Owner can add supported tokens
   */
  describe("TEST-XP-007: Add supported tokens", function () {
    it("should allow owner to add supported token", async function () {
      const tokenAddress = "0x1111111111111111111111111111111111111111";
      
      await xcmProxy.connect(owner).addSupportedToken(tokenAddress);
      
      expect(await xcmProxy.supportedTokens(tokenAddress)).to.equal(true);
    });

    it("should emit event when token is added", async function () {
      const tokenAddress = "0x1111111111111111111111111111111111111111";
      
      await expect(
        xcmProxy.connect(owner).addSupportedToken(tokenAddress)
      )
        .to.emit(xcmProxy, "TokenSupported")
        .withArgs(tokenAddress, true);
    });

    it("should support multiple tokens", async function () {
      const token1 = "0x1111111111111111111111111111111111111111";
      const token2 = "0x2222222222222222222222222222222222222222";
      const token3 = "0x3333333333333333333333333333333333333333";
      
      await xcmProxy.connect(owner).addSupportedToken(token1);
      await xcmProxy.connect(owner).addSupportedToken(token2);
      await xcmProxy.connect(owner).addSupportedToken(token3);
      
      expect(await xcmProxy.supportedTokens(token1)).to.equal(true);
      expect(await xcmProxy.supportedTokens(token2)).to.equal(true);
      expect(await xcmProxy.supportedTokens(token3)).to.equal(true);
    });

    it("should allow re-adding already supported token", async function () {
      const tokenAddress = "0x1111111111111111111111111111111111111111";
      
      await xcmProxy.connect(owner).addSupportedToken(tokenAddress);
      
      // Should not revert
      await expect(
        xcmProxy.connect(owner).addSupportedToken(tokenAddress)
      ).to.not.be.reverted;
      
      expect(await xcmProxy.supportedTokens(tokenAddress)).to.equal(true);
    });

    it("should reject zero address token", async function () {
      await expect(
        xcmProxy.connect(owner).addSupportedToken(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(xcmProxy, "ZeroAddress");
    });
  });

  /**
   * TEST-XP-008: Owner can remove supported tokens
   */
  describe("TEST-XP-008: Remove supported tokens", function () {
    it("should allow owner to remove supported token", async function () {
      const tokenAddress = "0x1111111111111111111111111111111111111111";
      
      await xcmProxy.connect(owner).addSupportedToken(tokenAddress);
      expect(await xcmProxy.supportedTokens(tokenAddress)).to.equal(true);
      
      await xcmProxy.connect(owner).removeSupportedToken(tokenAddress);
      
      expect(await xcmProxy.supportedTokens(tokenAddress)).to.equal(false);
    });

    it("should emit event when token is removed", async function () {
      const tokenAddress = "0x1111111111111111111111111111111111111111";
      
      await xcmProxy.connect(owner).addSupportedToken(tokenAddress);
      
      await expect(
        xcmProxy.connect(owner).removeSupportedToken(tokenAddress)
      )
        .to.emit(xcmProxy, "TokenSupported")
        .withArgs(tokenAddress, false);
    });

    it("should allow removing non-supported token", async function () {
      const tokenAddress = "0x1111111111111111111111111111111111111111";
      
      // Should not revert even if token wasn't supported
      await expect(
        xcmProxy.connect(owner).removeSupportedToken(tokenAddress)
      ).to.not.be.reverted;
    });

    it("should not affect other supported tokens", async function () {
      const token1 = "0x1111111111111111111111111111111111111111";
      const token2 = "0x2222222222222222222222222222222222222222";
      
      await xcmProxy.connect(owner).addSupportedToken(token1);
      await xcmProxy.connect(owner).addSupportedToken(token2);
      
      await xcmProxy.connect(owner).removeSupportedToken(token1);
      
      expect(await xcmProxy.supportedTokens(token1)).to.equal(false);
      expect(await xcmProxy.supportedTokens(token2)).to.equal(true);
    });
  });

  /**
   * TEST-XP-009: XCM configuration can be set
   */
  describe("TEST-XP-009: XCM configuration", function () {
    it("should allow owner to set XTokens precompile", async function () {
      const precompileAddress = "0x0000000000000000000000000000000000000804";
      
      await xcmProxy.connect(owner).setXTokensPrecompile(precompileAddress);
      
      expect(await xcmProxy.xTokensPrecompile()).to.equal(precompileAddress);
    });

    it("should emit event when XTokens precompile is set", async function () {
      const precompileAddress = "0x0000000000000000000000000000000000000804";
      
      await expect(
        xcmProxy.connect(owner).setXTokensPrecompile(precompileAddress)
      )
        .to.emit(xcmProxy, "XTokensPrecompileSet")
        .withArgs(precompileAddress);
    });

    it("should allow owner to set default destination weight", async function () {
      const newWeight = 2000000000; // 2B
      
      await xcmProxy.connect(owner).setDefaultDestWeight(newWeight);
      
      expect(await xcmProxy.defaultDestWeight()).to.equal(newWeight);
    });

    it("should allow owner to set Asset Hub para ID", async function () {
      const newParaId = 1001;
      
      await xcmProxy.connect(owner).setAssetHubParaId(newParaId);
      
      expect(await xcmProxy.assetHubParaId()).to.equal(newParaId);
    });

    it("should emit events when XCM config is updated", async function () {
      const newWeight = 2000000000;
      const newParaId = 1001;
      
      await expect(
        xcmProxy.connect(owner).setDefaultDestWeight(newWeight)
      ).to.emit(xcmProxy, "DefaultDestWeightSet");

      await expect(
        xcmProxy.connect(owner).setAssetHubParaId(newParaId)
      ).to.emit(xcmProxy, "AssetHubParaIdSet");
    });

    it("should reject zero address for XTokens precompile", async function () {
      await expect(
        xcmProxy.connect(owner).setXTokensPrecompile(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(xcmProxy, "ZeroAddress");
    });
  });

  /**
   * TEST-XP-010: XCM config cannot be changed when frozen
   */
  describe("TEST-XP-010: XCM config freezing", function () {
    it("should allow owner to freeze XCM config", async function () {
      await xcmProxy.connect(owner).freezeXcmConfig();
      
      expect(await xcmProxy.xcmConfigFrozen()).to.equal(true);
    });

    it("should emit event when XCM config is frozen", async function () {
      await expect(
        xcmProxy.connect(owner).freezeXcmConfig()
      ).to.emit(xcmProxy, "XcmConfigFrozen");
    });

    it("should prevent setting XTokens precompile when frozen", async function () {
      await xcmProxy.connect(owner).freezeXcmConfig();
      
      const precompileAddress = "0x0000000000000000000000000000000000000804";
      
      await expect(
        xcmProxy.connect(owner).setXTokensPrecompile(precompileAddress)
      ).to.be.revertedWith("xcm config frozen");
    });

    it("should prevent setting dest weight when frozen", async function () {
      await xcmProxy.connect(owner).freezeXcmConfig();
      
      await expect(
        xcmProxy.connect(owner).setDefaultDestWeight(2000000000)
      ).to.be.revertedWith("xcm config frozen");
    });

    it("should prevent setting para ID when frozen", async function () {
      await xcmProxy.connect(owner).freezeXcmConfig();
      
      await expect(
        xcmProxy.connect(owner).setAssetHubParaId(1001)
      ).to.be.revertedWith("xcm config frozen");
    });

    it("should prevent freezing when already frozen", async function () {
      await xcmProxy.connect(owner).freezeXcmConfig();
      
      await expect(
        xcmProxy.connect(owner).freezeXcmConfig()
      ).to.be.revertedWith("already frozen");
    });

    it("should allow setting config before freezing", async function () {
      const precompileAddress = "0x0000000000000000000000000000000000000804";
      
      // Should work before freezing
      await expect(
        xcmProxy.connect(owner).setXTokensPrecompile(precompileAddress)
      ).to.not.be.reverted;
      
      // Freeze
      await xcmProxy.connect(owner).freezeXcmConfig();
      
      // Should fail after freezing
      await expect(
        xcmProxy.connect(owner).setXTokensPrecompile(precompileAddress)
      ).to.be.revertedWith("xcm config frozen");
    });
  });

  /**
   * TEST-XP-011: Slippage configuration works
   */
  describe("TEST-XP-011: Slippage configuration", function () {
    it("should have default slippage of 50 bps (0.5%)", async function () {
      expect(await xcmProxy.defaultSlippageBps()).to.equal(50);
    });

    it("should allow owner to set slippage", async function () {
      const newSlippage = 100; // 1%
      
      await xcmProxy.connect(owner).setDefaultSlippage(newSlippage);
      
      expect(await xcmProxy.defaultSlippageBps()).to.equal(newSlippage);
    });

    it("should emit event when slippage is set", async function () {
      const newSlippage = 100;
      
      await expect(
        xcmProxy.connect(owner).setDefaultSlippage(newSlippage)
      )
        .to.emit(xcmProxy, "DefaultSlippageSet")
        .withArgs(newSlippage);
    });

    it("should reject slippage over 10000 bps (100%)", async function () {
      await expect(
        xcmProxy.connect(owner).setDefaultSlippage(10001)
      ).to.be.revertedWith("slippage too high");
    });

    it("should allow slippage of exactly 10000 bps", async function () {
      await expect(
        xcmProxy.connect(owner).setDefaultSlippage(10000)
      ).to.not.be.reverted;
      
      expect(await xcmProxy.defaultSlippageBps()).to.equal(10000);
    });

    it("should allow zero slippage", async function () {
      await expect(
        xcmProxy.connect(owner).setDefaultSlippage(0)
      ).to.not.be.reverted;
      
      expect(await xcmProxy.defaultSlippageBps()).to.equal(0);
    });

    it("should handle various valid slippage values", async function () {
      const testValues = [1, 10, 50, 100, 500, 1000, 5000];
      
      for (const value of testValues) {
        await xcmProxy.connect(owner).setDefaultSlippage(value);
        expect(await xcmProxy.defaultSlippageBps()).to.equal(value);
      }
    });
  });

  /**
   * TEST-XP-012: Test mode can be toggled
   */
  describe("TEST-XP-012: Test mode", function () {
    it("should have test mode disabled by default", async function () {
      expect(await xcmProxy.testMode()).to.equal(false);
    });

    it("should allow owner to enable test mode", async function () {
      await xcmProxy.connect(owner).setTestMode(true);
      
      expect(await xcmProxy.testMode()).to.equal(true);
    });

    it("should allow owner to disable test mode", async function () {
      await xcmProxy.connect(owner).setTestMode(true);
      await xcmProxy.connect(owner).setTestMode(false);
      
      expect(await xcmProxy.testMode()).to.equal(false);
    });

    it("should emit event when test mode is changed", async function () {
      await expect(
        xcmProxy.connect(owner).setTestMode(true)
      )
        .to.emit(xcmProxy, "TestModeSet")
        .withArgs(true);

      await expect(
        xcmProxy.connect(owner).setTestMode(false)
      )
        .to.emit(xcmProxy, "TestModeSet")
        .withArgs(false);
    });

    it("should allow toggling test mode multiple times", async function () {
      await xcmProxy.connect(owner).setTestMode(true);
      expect(await xcmProxy.testMode()).to.equal(true);
      
      await xcmProxy.connect(owner).setTestMode(false);
      expect(await xcmProxy.testMode()).to.equal(false);
      
      await xcmProxy.connect(owner).setTestMode(true);
      expect(await xcmProxy.testMode()).to.equal(true);
    });

    it("should reject non-owner toggling test mode", async function () {
      await expect(
        xcmProxy.connect(user1).setTestMode(true)
      ).to.be.revertedWithCustomError(xcmProxy, "OwnableUnauthorizedAccount");
    });
  });

  describe("Additional Configuration Tests", function () {
    it("should handle full configuration setup", async function () {
      // Setup complete configuration
      const precompile = "0x0000000000000000000000000000000000000804";
      const token1 = "0x1111111111111111111111111111111111111111";
      const token2 = "0x2222222222222222222222222222222222222222";
      
      await xcmProxy.connect(owner).setXTokensPrecompile(precompile);
      await xcmProxy.connect(owner).setDefaultDestWeight(2000000000);
      await xcmProxy.connect(owner).setAssetHubParaId(1000);
      await xcmProxy.connect(owner).setDefaultSlippage(100);
      await xcmProxy.connect(owner).addSupportedToken(token1);
      await xcmProxy.connect(owner).addSupportedToken(token2);
      await xcmProxy.connect(owner).setTestMode(true);
      
      // Verify all settings
      expect(await xcmProxy.xTokensPrecompile()).to.equal(precompile);
      expect(await xcmProxy.defaultDestWeight()).to.equal(2000000000);
      expect(await xcmProxy.assetHubParaId()).to.equal(1000);
      expect(await xcmProxy.defaultSlippageBps()).to.equal(100);
      expect(await xcmProxy.supportedTokens(token1)).to.equal(true);
      expect(await xcmProxy.supportedTokens(token2)).to.equal(true);
      expect(await xcmProxy.testMode()).to.equal(true);
    });

    it("should allow updating configuration multiple times", async function () {
      await xcmProxy.connect(owner).setDefaultSlippage(50);
      expect(await xcmProxy.defaultSlippageBps()).to.equal(50);
      
      await xcmProxy.connect(owner).setDefaultSlippage(100);
      expect(await xcmProxy.defaultSlippageBps()).to.equal(100);
      
      await xcmProxy.connect(owner).setDefaultSlippage(200);
      expect(await xcmProxy.defaultSlippageBps()).to.equal(200);
    });
  });
});

