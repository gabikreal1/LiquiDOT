/**
 * AssetHubVault Deployment & Initialization Tests
 * 
 * This test suite covers TEST-AHV-001 and TEST-AHV-002 from TESTING-REQUIREMENTS.md
 * 
 * Tests in this file:
 * - Contract deploys successfully with correct initial state
 * - All roles initialized properly
 * - State variables set to expected defaults
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AssetHubVault - Deployment & Initialization", function () {
  let assetHubVault;
  let deployer, user1, user2, operator, emergency;

  /**
   * Deploy a fresh AssetHubVault before each test
   * Note: We deploy fresh here rather than using the test environment
   * to ensure isolation and test deployment behavior itself
   */
  beforeEach(async function () {
    // Get test signers
    [deployer, user1, user2, operator, emergency] = await ethers.getSigners();

    // Deploy AssetHubVault
    const AssetHubVault = await ethers.getContractFactory("contracts/V1(Current)/AssetHubVault.sol:AssetHubVault");
    assetHubVault = await AssetHubVault.deploy();
    await assetHubVault.waitForDeployment();
  });

  /**
   * TEST-AHV-001: Contract deploys successfully
   * 
   * Verifies that:
   * - Contract deploys without errors
   * - Admin, operator, emergency roles all set to deployer
   * - XCM_PRECOMPILE initialized to address(0)
   * - paused = false
   * - xcmPrecompileFrozen = false
   * - testMode = false
   */
  describe("TEST-AHV-001: Deployment", function () {
    it("should deploy successfully", async function () {
      // Verify contract deployed and has an address
      const address = await assetHubVault.getAddress();
      expect(address).to.be.properAddress;
    });

    it("should set admin to deployer", async function () {
      expect(await assetHubVault.admin()).to.equal(deployer.address);
    });

    it("should set operator to deployer", async function () {
      expect(await assetHubVault.operator()).to.equal(deployer.address);
    });

    it("should set emergency address to deployer", async function () {
      expect(await assetHubVault.emergency()).to.equal(deployer.address);
    });

    it("should initialize XCM_PRECOMPILE to zero address", async function () {
      expect(await assetHubVault.XCM_PRECOMPILE()).to.equal(ethers.ZeroAddress);
    });

    it("should initialize paused to false", async function () {
      expect(await assetHubVault.paused()).to.equal(false);
    });

    it("should initialize xcmPrecompileFrozen to false", async function () {
      expect(await assetHubVault.xcmPrecompileFrozen()).to.equal(false);
    });

    it("should initialize testMode to false", async function () {
      expect(await assetHubVault.testMode()).to.equal(false);
    });
  });

  /**
   * TEST-AHV-002: Initial state variables correct
   * 
   * Verifies that:
   * - All user balances are 0
   * - No positions exist
   * - All mappings are empty
   */
  describe("TEST-AHV-002: Initial State", function () {
    it("should have zero balance for any user", async function () {
      expect(await assetHubVault.getUserBalance(user1.address)).to.equal(0);
      expect(await assetHubVault.getUserBalance(user2.address)).to.equal(0);
      expect(await assetHubVault.getUserBalance(deployer.address)).to.equal(0);
    });

    it("should have no positions for any user", async function () {
      const positions = await assetHubVault.getUserPositions(user1.address);
      expect(positions).to.be.an('array').that.is.empty;
    });

    it("should have zero contract balance", async function () {
      const balance = await ethers.provider.getBalance(await assetHubVault.getAddress());
      expect(balance).to.equal(0);
    });

    it("should return false for any position active check", async function () {
      // Generate a dummy position ID
      const dummyPositionId = ethers.id("dummy_position");
      const position = await assetHubVault.getPosition(dummyPositionId);
      expect(position.active).to.equal(false);
    });
  });

  /**
   * Additional deployment tests
   */
  describe("Deployment edge cases", function () {
    it("should be able to call view functions without reverting", async function () {
      // Test that all view functions work immediately after deployment
      await assetHubVault.admin();
      await assetHubVault.operator();
      await assetHubVault.emergency();
      await assetHubVault.paused();
      await assetHubVault.testMode();
      await assetHubVault.getUserBalance(deployer.address);
      await assetHubVault.getUserPositions(deployer.address);
    });

    it("should have proper ownership structure", async function () {
      // Admin should be able to call admin functions
      // We'll test one admin function to verify ownership works
      await expect(
        assetHubVault.setOperator(operator.address)
      ).to.not.be.reverted;

      // Verify the change took effect
      expect(await assetHubVault.operator()).to.equal(operator.address);
    });
  });
});

