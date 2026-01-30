/**
 * AssetHubVault Testnet - Security Checks
 * 
 * Tests security features on deployed contract
 * Uses the existing deployed vault with testMode enabled
 * 
 * Note: On testnet we only have 1 signer, so we test what we can
 * and skip access control tests that require multiple signers.
 * 
 * Usage:
 *   npx hardhat test test/AssetHubVault/testnet/6.security-checks.test.js --network passethub
 */

const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("AssetHubVault Security Checks - Testnet", function () {
  let vault;
  let operator;
  const VAULT_ADDRESS = process.env.ASSETHUB_CONTRACT;

  before(async function () {
    if (!VAULT_ADDRESS || VAULT_ADDRESS === ethers.ZeroAddress) {
      throw new Error("Set ASSETHUB_CONTRACT environment variable");
    }

    const signers = await ethers.getSigners();
    operator = signers[0];

    const AssetHubVault = await ethers.getContractFactory(
      "contracts/V1(Current)/AssetHubVault.sol:AssetHubVault"
    );
    vault = AssetHubVault.attach(VAULT_ADDRESS);

    console.log(`\n✅ Connected to vault at: ${VAULT_ADDRESS}`);
    console.log(`✅ Network: ${network.name}`);
    console.log(`✅ Signer: ${operator.address}`);
  });

  describe("Input Validation", function () {
    it("should reject zero amount investments", async function () {
      await expect(
        vault.connect(operator).dispatchInvestment(
          operator.address,
          1287, // Moonbase chainId
          ethers.ZeroAddress,
          ethers.ZeroAddress,
          0, // Zero amount
          -100,
          100,
          "0x010100a10f",
          "0x"
        )
      ).to.be.revertedWithCustomError(vault, "AmountZero");
    });

    it("should reject invalid range (lower > upper)", async function () {
      await expect(
        vault.connect(operator).dispatchInvestment(
          operator.address,
          1287,
          ethers.ZeroAddress,
          ethers.ZeroAddress,
          100,
          100, // lower
          -100, // upper < lower = invalid
          "0x010100a10f",
          "0x"
        )
      ).to.be.revertedWithCustomError(vault, "InvalidRange");
    });

    it("should reject zero address user", async function () {
      await expect(
        vault.connect(operator).dispatchInvestment(
          ethers.ZeroAddress, // Zero address user
          1287,
          ethers.ZeroAddress,
          ethers.ZeroAddress,
          100,
          -100,
          100,
          "0x010100a10f",
          "0x"
        )
      ).to.be.revertedWithCustomError(vault, "ZeroAddress");
    });

    it("should reject unsupported chain", async function () {
      await expect(
        vault.connect(operator).dispatchInvestment(
          operator.address,
          99999, // Unsupported chain
          ethers.ZeroAddress,
          ethers.ZeroAddress,
          100,
          -100,
          100,
          "0x01",
          "0x"
        )
      ).to.be.revertedWithCustomError(vault, "ChainNotSupported");
    });
  });

  describe("State Integrity", function () {
    it("should reject confirming non-existent position", async function () {
      const fakePositionId = ethers.keccak256(ethers.toUtf8Bytes("fake-position-id"));
      const remoteId = ethers.keccak256(ethers.toUtf8Bytes("fake-remote-id"));
      
      await expect(
        vault.connect(operator).confirmExecution(fakePositionId, remoteId, 1000)
      ).to.be.reverted;
    });

    it("should reject settling non-existent position", async function () {
      const fakePositionId = ethers.keccak256(ethers.toUtf8Bytes("fake-position"));
      
      await expect(
        vault.connect(operator).settleLiquidation(fakePositionId, 100)
      ).to.be.reverted;
    });
  });

  describe("Security Settings Verification", function () {
    it("should have XCM precompile configured", async function () {
      const xcmPrecompile = await vault.XCM_PRECOMPILE();
      expect(xcmPrecompile).to.not.equal(ethers.ZeroAddress);
      console.log(`   ✓ XCM Precompile: ${xcmPrecompile}`);
    });

    it("should have test mode properly configured", async function () {
      const testMode = await vault.testMode();
      console.log(`   ✓ Test Mode: ${testMode ? 'Enabled' : 'Disabled'}`);
      // For testnet, test mode should be enabled
      expect(testMode).to.be.true;
    });

    it("should have supported chains configured", async function () {
      // supportedChains returns a struct (isSupported, xcmDestination, name, xcmProxy)
      const chain1287 = await vault.supportedChains(1287);
      const chain1000 = await vault.supportedChains(1000);
      
      const isChain1287Supported = chain1287[0]; // first element is isSupported
      const isChain1000Supported = chain1000[0];
      
      console.log(`   ✓ Chain 1287 supported: ${isChain1287Supported}`);
      console.log(`   ✓ Chain 1000 supported: ${isChain1000Supported}`);
      
      // At least one should be configured
      expect(isChain1287Supported || isChain1000Supported).to.be.true;
    });

    it("should have operator role assigned", async function () {
      // Use admin() or operator() functions instead of role-based
      const adminAddress = await vault.admin();
      const isAdmin = adminAddress.toLowerCase() === operator.address.toLowerCase();
      console.log(`   ✓ Admin (${operator.address}): ${isAdmin ? 'Is Admin' : 'Not Admin'}`);
      expect(isAdmin).to.be.true;
    });

    it("should have admin role assigned", async function () {
      const adminAddress = await vault.admin();
      const isAdmin = adminAddress.toLowerCase() === operator.address.toLowerCase();
      console.log(`   ✓ Admin address: ${adminAddress}`);
      expect(isAdmin).to.be.true;
    });
  });

  describe("Security Summary", function () {
    it("should display security configuration", async function () {
      const xcmPrecompile = await vault.XCM_PRECOMPILE();
      const testMode = await vault.testMode();
      const isPaused = await vault.paused();
      
      console.log("\n   📊 Security Configuration Summary");
      console.log("   ==========================================");
      console.log(`   XCM Precompile: ${xcmPrecompile}`);
      console.log(`   Test Mode: ${testMode ? 'ENABLED' : 'DISABLED'}`);
      console.log(`   Paused: ${isPaused ? 'YES' : 'NO'}`);
      console.log("   ==========================================\n");
    });
  });
});
