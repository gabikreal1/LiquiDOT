/**
 * XCMProxy Testnet Asset Reception Tests
 * 
 * Tests receiving assets from Asset Hub and creating pending positions
 * Safe for testnet - uses test mode to simulate XCM calls
 * 
 * Usage:
 *   npx hardhat test test/XCMProxy/testnet/2.receive-assets.test.js --network moonbase
 * 
 * Requirements:
 *   - MOON_PK in .env must have DEV tokens
 *   - XCMPROXY_CONTRACT must point to deployed contract
 *   - Contract must be in test mode (testMode = true)
 *   - Test tokens must be added to supportedTokens mapping
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("XCMProxy Testnet - Receive Assets", function () {
  let proxy;
  let operator;
  const PROXY_ADDRESS = process.env.XCMPROXY_CONTRACT;

  // Test parameters - Moonbase Alpha addresses
  const WETH_MOONBASE = "0x1436aE0dF0A8663F18c0Ec51d7e2E46591730715"; // Wrapped ETH on Moonbase
  const TEST_POOL_ID = "0x1234567890abcdef1234567890abcdef12345678"; // Mock pool address
  
  before(async function () {
    if (!PROXY_ADDRESS || PROXY_ADDRESS === ethers.ZeroAddress) {
      throw new Error("Set XCMPROXY_CONTRACT environment variable");
    }

    [operator] = await ethers.getSigners();

    const XCMProxy = await ethers.getContractFactory(
      "contracts/V1(Current)/XCMProxy.sol:XCMProxy"
    );
    proxy = XCMProxy.attach(PROXY_ADDRESS);

    // Check if we're owner and can enable test mode
    const contractOwner = await proxy.owner();
    const testMode = await proxy.testMode();
    
    if (!testMode) {
      console.log("\n⚠️  WARNING: Test mode is disabled!");
      
      // If we're owner, enable it automatically
      if (contractOwner.toLowerCase() === operator.address.toLowerCase()) {
        console.log("   ✅ Detected owner account - enabling test mode...");
        const tx = await proxy.setTestMode(true);
        await tx.wait();
        console.log("   ✅ Test mode enabled successfully\n");
      } else {
        console.log("   ❌ Test account is not owner - cannot enable test mode");
        console.log(`   Contract owner: ${contractOwner}`);
        console.log(`   Test account: ${operator.address}`);
        console.log("   Please run as owner or enable test mode manually\n");
        throw new Error("Test mode must be enabled");
      }
    }

    console.log(`\n✅ Connected to XCMProxy at: ${PROXY_ADDRESS}`);
    console.log(`✅ Network: ${network.name}`);
    console.log(`✅ Operator: ${operator.address}`);
    console.log(`✅ Test Mode: Enabled\n`);
  });

  describe("Asset Reception - Basic Flow", function () {
    it("should receive assets and create pending position", async function () {
      // Generate unique position ID
      const assetHubPositionId = ethers.keccak256(
        ethers.toUtf8Bytes(`test-pos-${Date.now()}`)
      );

      // Encode investment parameters
      const investmentParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256[]", "int24", "int24", "address", "uint16"],
        [
          TEST_POOL_ID,           // poolId
          WETH_MOONBASE,          // baseAsset
          [ethers.parseEther("0.5"), ethers.parseEther("0.5")], // amounts
          -50,                    // lowerRangePercent
          50,                     // upperRangePercent
          operator.address,       // positionOwner
          100                     // slippageBps (1%)
        ]
      );

      const amount = ethers.parseEther("1.0");

      // In test mode, we can call receiveAssets directly
      // In production, this would be called via XCM transact instruction
      const tx = await proxy.receiveAssets(
        assetHubPositionId,
        WETH_MOONBASE,
        operator.address,
        amount,
        investmentParams
      );

      // Verify events
      const receipt = await tx.wait();
      const assetsReceivedEvent = receipt.logs.find(log => {
        try {
          const parsed = proxy.interface.parseLog(log);
          return parsed && parsed.name === "AssetsReceived";
        } catch {
          return false;
        }
      });

      const pendingCreatedEvent = receipt.logs.find(log => {
        try {
          const parsed = proxy.interface.parseLog(log);
          return parsed && parsed.name === "PendingPositionCreated";
        } catch {
          return false;
        }
      });

      expect(assetsReceivedEvent).to.not.be.undefined;
      expect(pendingCreatedEvent).to.not.be.undefined;

      // Verify pending position created
      const pendingPosition = await proxy.pendingPositions(assetHubPositionId);
      expect(pendingPosition.exists).to.be.true;
      expect(pendingPosition.token.toLowerCase()).to.equal(WETH_MOONBASE.toLowerCase());
      expect(pendingPosition.user).to.equal(operator.address);
      expect(pendingPosition.amount).to.equal(amount);
      expect(pendingPosition.poolId.toLowerCase()).to.equal(TEST_POOL_ID.toLowerCase());

      console.log(`   ✓ Pending position created`);
      console.log(`   ✓ Position ID: ${assetHubPositionId}`);
      console.log(`   ✓ Amount: ${ethers.formatEther(amount)} ETH`);
    });

    it("should reject unsupported tokens", async function () {
      const assetHubPositionId = ethers.keccak256(
        ethers.toUtf8Bytes(`test-pos-unsupported-${Date.now()}`)
      );

      const UNSUPPORTED_TOKEN = "0x0000000000000000000000000000000000000001";

      const investmentParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256[]", "int24", "int24", "address", "uint16"],
        [TEST_POOL_ID, WETH_MOONBASE, [], -50, 50, operator.address, 100]
      );

      await expect(
        proxy.receiveAssets(
          assetHubPositionId,
          UNSUPPORTED_TOKEN,
          operator.address,
          ethers.parseEther("1.0"),
          investmentParams
        )
      ).to.be.revertedWith("Token not supported");
    });

    it("should reject zero amount", async function () {
      const assetHubPositionId = ethers.keccak256(
        ethers.toUtf8Bytes(`test-pos-zero-${Date.now()}`)
      );

      const investmentParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256[]", "int24", "int24", "address", "uint16"],
        [TEST_POOL_ID, WETH_MOONBASE, [], -50, 50, operator.address, 100]
      );

      await expect(
        proxy.receiveAssets(
          assetHubPositionId,
          WETH_MOONBASE,
          operator.address,
          0,
          investmentParams
        )
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("should reject zero user address", async function () {
      const assetHubPositionId = ethers.keccak256(
        ethers.toUtf8Bytes(`test-pos-zeroaddr-${Date.now()}`)
      );

      const investmentParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256[]", "int24", "int24", "address", "uint16"],
        [TEST_POOL_ID, WETH_MOONBASE, [], -50, 50, operator.address, 100]
      );

      await expect(
        proxy.receiveAssets(
          assetHubPositionId,
          WETH_MOONBASE,
          ethers.ZeroAddress,
          ethers.parseEther("1.0"),
          investmentParams
        )
      ).to.be.revertedWith("Invalid user address");
    });

    it("should reject duplicate position IDs", async function () {
      const assetHubPositionId = ethers.keccak256(
        ethers.toUtf8Bytes(`test-pos-duplicate-${Date.now()}`)
      );

      const investmentParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256[]", "int24", "int24", "address", "uint16"],
        [TEST_POOL_ID, WETH_MOONBASE, [], -50, 50, operator.address, 100]
      );

      // Create first position
      const tx1 = await proxy.receiveAssets(
        assetHubPositionId,
        WETH_MOONBASE,
        operator.address,
        ethers.parseEther("1.0"),
        investmentParams
      );
      await tx1.wait();

      // Verify it was created
      const pending = await proxy.pendingPositions(assetHubPositionId);
      expect(pending.exists).to.be.true;

      // Try to create duplicate - should revert
      await expect(
        proxy.receiveAssets(
          assetHubPositionId,
          WETH_MOONBASE,
          operator.address,
          ethers.parseEther("1.0"),
          investmentParams
        )
      ).to.be.revertedWith("Position already pending");
    });
  });

  describe("Pending Position Management", function () {
    it("should store all investment parameters correctly", async function () {
      const assetHubPositionId = ethers.keccak256(
        ethers.toUtf8Bytes(`test-pos-params-${Date.now()}`)
      );

      const amounts = [ethers.parseEther("0.6"), ethers.parseEther("0.4")];
      const lowerRange = -100;
      const upperRange = 200;
      const slippage = 150; // 1.5%

      const investmentParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256[]", "int24", "int24", "address", "uint16"],
        [TEST_POOL_ID, WETH_MOONBASE, amounts, lowerRange, upperRange, operator.address, slippage]
      );

      const tx = await proxy.receiveAssets(
        assetHubPositionId,
        WETH_MOONBASE,
        operator.address,
        ethers.parseEther("1.0"),
        investmentParams
      );
      await tx.wait();

      const pending = await proxy.pendingPositions(assetHubPositionId);
      
      expect(pending.exists).to.be.true;
      expect(pending.lowerRangePercent).to.equal(lowerRange);
      expect(pending.upperRangePercent).to.equal(upperRange);
      expect(pending.slippageBps).to.equal(slippage);
      expect(pending.baseAsset.toLowerCase()).to.equal(WETH_MOONBASE.toLowerCase());
      expect(pending.poolId.toLowerCase()).to.equal(TEST_POOL_ID.toLowerCase());
      
      console.log(`   ✓ Investment parameters stored correctly`);
      console.log(`   ✓ Range: ${lowerRange}% to ${upperRange}%`);
      console.log(`   ✓ Slippage: ${slippage / 100}%`);
    });
  });

  describe("XCM Caller Authorization (Test Mode)", function () {
    it("should allow calls in test mode regardless of caller", async function () {
      // In test mode, trustedXcmCaller check is bypassed
      const assetHubPositionId = ethers.keccak256(
        ethers.toUtf8Bytes(`test-pos-testmode-${Date.now()}`)
      );

      const investmentParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256[]", "int24", "int24", "address", "uint16"],
        [TEST_POOL_ID, WETH_MOONBASE, [], -50, 50, operator.address, 100]
      );

      // Should succeed even if we're not the trusted caller
      const tx = await proxy.receiveAssets(
        assetHubPositionId,
        WETH_MOONBASE,
        operator.address,
        ethers.parseEther("1.0"),
        investmentParams
      );
      const receipt = await tx.wait();
      
      expect(receipt.status).to.equal(1);

      console.log(`   ✓ Test mode allows direct contract calls`);
    });
  });
});
