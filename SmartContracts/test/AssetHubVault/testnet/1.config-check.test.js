/**
 * AssetHubVault Testnet Configuration Tests
 * 
 * These are READ-ONLY tests that check the deployed contract configuration.
 * 100% safe to run on testnet - no state modifications.
 * 
 * Usage:
 *   $env:ASSETHUB_CONTRACT="0xYourContractAddress"
 *   npx hardhat test test/AssetHubVault/testnet/1.config-check.test.js
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AssetHubVault Testnet - Configuration Check", function () {
  let vault;
  const VAULT_ADDRESS = process.env.ASSETHUB_CONTRACT;

  before(async function () {
    if (!VAULT_ADDRESS || VAULT_ADDRESS === ethers.ZeroAddress) {
      throw new Error(
        "❌ ASSETHUB_CONTRACT environment variable not set!\n" +
        "   Set it to your deployed contract address:\n" +
        "   $env:ASSETHUB_CONTRACT=\"0xYourAddress\""
      );
    }

    console.log(`\n🔗 Connecting to AssetHubVault at: ${VAULT_ADDRESS}`);

    const AssetHubVault = await ethers.getContractFactory(
      "contracts/V1(Current)/AssetHubVault.sol:AssetHubVault"
    );
    vault = AssetHubVault.attach(VAULT_ADDRESS);

    // Verify connection
    try {
      await vault.admin();
      console.log("✅ Successfully connected to contract\n");
    } catch (error) {
      throw new Error(`Failed to connect: ${error.message}`);
    }
  });

  describe("Contract Deployment", function () {
    it("should be deployed at correct address", async function () {
      expect(await vault.getAddress()).to.equal(VAULT_ADDRESS);
    });

    it("should respond to function calls", async function () {
      // Smoke test - can we call functions?
      await vault.paused(); // Should not throw
    });
  });

  describe("Role Configuration", function () {
    it("should have admin configured", async function () {
      const admin = await vault.admin();
      expect(admin).to.be.properAddress;
      expect(admin).to.not.equal(ethers.ZeroAddress);
      console.log(`   Admin: ${admin}`);
    });

    it("should have operator configured", async function () {
      const operator = await vault.operator();
      expect(operator).to.be.properAddress;
      expect(operator).to.not.equal(ethers.ZeroAddress);
      console.log(`   Operator: ${operator}`);
    });

    it("should have emergency address configured", async function () {
      const emergency = await vault.emergency();
      expect(emergency).to.be.properAddress;
      expect(emergency).to.not.equal(ethers.ZeroAddress);
      console.log(`   Emergency: ${emergency}`);
    });
  });

  describe("XCM Configuration", function () {
    it("should have XCM precompile set", async function () {
      const precompile = await vault.XCM_PRECOMPILE();
      
      if (precompile === ethers.ZeroAddress) {
        console.log("   ⚠️  WARNING: XCM precompile not set!");
        console.log("   This must be set before dispatching investments");
      } else {
        console.log(`   XCM Precompile: ${precompile}`);
        expect(precompile).to.be.properAddress;
      }
    });

    it("should check if XCM precompile is frozen", async function () {
      const frozen = await vault.xcmPrecompileFrozen();
      console.log(`   XCM Frozen: ${frozen}`);
      
      if (frozen) {
        console.log("   ⚠️  XCM precompile is frozen - cannot be changed");
      }
    });
  });

  describe("Contract State", function () {
    it("should check if contract is paused", async function () {
      const paused = await vault.paused();
      console.log(`   Paused: ${paused}`);
      
      if (paused) {
        console.log("   ⚠️  WARNING: Contract is paused!");
        console.log("   Operations will be blocked");
      }
    });

    it("should check test mode status", async function () {
      const testMode = await vault.testMode();
      console.log(`   Test Mode: ${testMode}`);
      
      if (testMode) {
        console.log("   ✅ Test mode enabled - XCM calls will be skipped");
      } else {
        console.log("   ⚠️  Production mode - XCM calls will be attempted");
      }
    });
  });

  describe("Contract Balance", function () {
    it("should report contract balance", async function () {
      const balance = await ethers.provider.getBalance(VAULT_ADDRESS);
      console.log(`   Contract Balance: ${ethers.formatEther(balance)} ETH`);
      expect(balance).to.be.gte(0);
    });
  });

  describe("Summary", function () {
    it("should display configuration summary", async function () {
      const admin = await vault.admin();
      const operator = await vault.operator();
      const emergency = await vault.emergency();
      const precompile = await vault.XCM_PRECOMPILE();
      const paused = await vault.paused();
      const testMode = await vault.testMode();
      const frozen = await vault.xcmPrecompileFrozen();
      const balance = await ethers.provider.getBalance(VAULT_ADDRESS);

      console.log("\n" + "=".repeat(60));
      console.log("  AssetHubVault Configuration Summary");
      console.log("=".repeat(60));
      console.log(`Contract: ${VAULT_ADDRESS}`);
      console.log(`Admin: ${admin}`);
      console.log(`Operator: ${operator}`);
      console.log(`Emergency: ${emergency}`);
      console.log(`XCM Precompile: ${precompile}`);
      console.log(`XCM Frozen: ${frozen}`);
      console.log(`Paused: ${paused}`);
      console.log(`Test Mode: ${testMode}`);
      console.log(`Balance: ${ethers.formatEther(balance)} ETH`);
      console.log("=".repeat(60) + "\n");

      // Always pass - this is just for display
      expect(true).to.be.true;
    });
  });
});

