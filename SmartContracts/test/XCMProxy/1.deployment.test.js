/**
 * XCMProxy Deployment & Initialization Tests
 * 
 * Covers TEST-XP-001 to TEST-XP-002 from TESTING-REQUIREMENTS.md
 * 
 * Tests:
 * - Contract deployment
 * - Initial state verification
 * - Integration setup (Algebra contracts)
 * 
 * Usage:
 *   npx hardhat test test/XCMProxy/1.deployment.test.js
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("XCMProxy - Deployment & Initialization", function () {
  let xcmProxy;
  let deployer, user1;
  let mockQuoter, mockRouter, mockNFPM, mockXTokens;

  beforeEach(async function () {
    [deployer, user1] = await ethers.getSigners();

    // Deploy mock contracts for Algebra integration
    const MockERC20 = await ethers.getContractFactory("contracts/test/MockERC20.sol:MockERC20");
    mockQuoter = await MockERC20.deploy("Mock Quoter", "QUOT");
    mockRouter = await MockERC20.deploy("Mock Router", "ROUT");
    mockNFPM = await MockERC20.deploy("Mock NFPM", "NFPM");
    mockXTokens = await MockERC20.deploy("Mock XTokens", "XTOK");

    // Deploy XCMProxy
    const XCMProxy = await ethers.getContractFactory("contracts/V1(Current)/XCMProxy.sol:XCMProxy");
    xcmProxy = await XCMProxy.deploy(
      await mockQuoter.getAddress(),
      await mockRouter.getAddress()
    );
    await xcmProxy.waitForDeployment();
  });

  /**
   * TEST-XP-001: Contract deploys successfully
   */
  describe("TEST-XP-001: Deployment", function () {
    it("should deploy successfully", async function () {
      expect(await xcmProxy.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await xcmProxy.getAddress()).to.be.properAddress;
    });

    it("should set owner to deployer", async function () {
      expect(await xcmProxy.owner()).to.equal(deployer.address);
    });

    it("should set operator to deployer initially", async function () {
      expect(await xcmProxy.operator()).to.equal(deployer.address);
    });

    it("should set quoter contract address", async function () {
      const quoterAddress = await xcmProxy.quoterContract();
      expect(quoterAddress).to.equal(await mockQuoter.getAddress());
    });

    it("should set swap router contract address", async function () {
      const routerAddress = await xcmProxy.swapRouterContract();
      expect(routerAddress).to.equal(await mockRouter.getAddress());
    });

    it("should initialize with default values", async function () {
      // Default XCM parameters
      expect(await xcmProxy.defaultDestWeight()).to.equal(1000000000); // 1B
      expect(await xcmProxy.assetHubParaId()).to.equal(1000); // Asset Hub para ID
      
      // Test mode should be false by default
      expect(await xcmProxy.testMode()).to.equal(false);
      
      // Should not be paused initially
      expect(await xcmProxy.paused()).to.equal(false);
      
      // Position counter starts at 0
      expect(await xcmProxy.positionCounter()).to.equal(0);
    });

    it("should initialize with zero XCM config initially", async function () {
      expect(await xcmProxy.xTokensPrecompile()).to.equal(ethers.ZeroAddress);
      expect(await xcmProxy.xcmConfigFrozen()).to.equal(false);
    });

    it("should initialize with default slippage", async function () {
      const defaultSlippage = await xcmProxy.defaultSlippageBps();
      expect(defaultSlippage).to.equal(50); // 0.5% default
    });

    it("should not have NFPM set initially", async function () {
      expect(await xcmProxy.nfpmContract()).to.equal(ethers.ZeroAddress);
    });
  });

  /**
   * TEST-XP-002: Owner can set integrations
   */
  describe("TEST-XP-002: Integration Setup", function () {
    it("should allow owner to set NFPM address", async function () {
      await xcmProxy.setNFPM(await mockNFPM.getAddress());
      
      expect(await xcmProxy.nfpmContract()).to.equal(await mockNFPM.getAddress());
    });

    it("should emit event when NFPM is set", async function () {
      await expect(
        xcmProxy.setNFPM(await mockNFPM.getAddress())
      )
        .to.emit(xcmProxy, "NFPMSet")
        .withArgs(await mockNFPM.getAddress());
    });

    it("should allow owner to update integrations", async function () {
      const newQuoter = await (await ethers.getContractFactory("contracts/test/MockERC20.sol:MockERC20"))
        .deploy("New Quoter", "NQUOT");
      const newRouter = await (await ethers.getContractFactory("contracts/test/MockERC20.sol:MockERC20"))
        .deploy("New Router", "NROUT");

      await xcmProxy.setIntegrations(
        await newQuoter.getAddress(),
        await newRouter.getAddress()
      );

      expect(await xcmProxy.quoterContract()).to.equal(await newQuoter.getAddress());
      expect(await xcmProxy.swapRouterContract()).to.equal(await newRouter.getAddress());
    });

    it("should emit event when integrations are updated", async function () {
      const newQuoter = await (await ethers.getContractFactory("contracts/test/MockERC20.sol:MockERC20"))
        .deploy("New Quoter", "NQUOT");
      const newRouter = await (await ethers.getContractFactory("contracts/test/MockERC20.sol:MockERC20"))
        .deploy("New Router", "NROUT");

      await expect(
        xcmProxy.setIntegrations(
          await newQuoter.getAddress(),
          await newRouter.getAddress()
        )
      )
        .to.emit(xcmProxy, "IntegrationsSet")
        .withArgs(await newQuoter.getAddress(), await newRouter.getAddress());
    });

    it("should reject zero address for NFPM", async function () {
      await expect(
        xcmProxy.setNFPM(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(xcmProxy, "ZeroAddress");
    });

    it("should reject zero address for quoter", async function () {
      await expect(
        xcmProxy.setIntegrations(
          ethers.ZeroAddress,
          await mockRouter.getAddress()
        )
      ).to.be.revertedWithCustomError(xcmProxy, "ZeroAddress");
    });

    it("should reject zero address for router", async function () {
      await expect(
        xcmProxy.setIntegrations(
          await mockQuoter.getAddress(),
          ethers.ZeroAddress
        )
      ).to.be.revertedWithCustomError(xcmProxy, "ZeroAddress");
    });

    it("should allow setting XTokens precompile", async function () {
      const precompileAddress = "0x0000000000000000000000000000000000000804";
      
      await xcmProxy.setXTokensPrecompile(precompileAddress);
      
      expect(await xcmProxy.xTokensPrecompile()).to.equal(precompileAddress);
    });

    it("should emit event when XTokens precompile is set", async function () {
      const precompileAddress = "0x0000000000000000000000000000000000000804";
      
      await expect(
        xcmProxy.setXTokensPrecompile(precompileAddress)
      )
        .to.emit(xcmProxy, "XTokensPrecompileSet")
        .withArgs(precompileAddress);
    });
  });

  describe("Additional Deployment Checks", function () {
    it("should have correct contract name in events", async function () {
      // Just verify we can deploy and call functions
      await xcmProxy.setTestMode(true);
      expect(await xcmProxy.testMode()).to.equal(true);
    });

    it("should support receive() function for native tokens", async function () {
      // Send some ETH to the contract
      await deployer.sendTransaction({
        to: await xcmProxy.getAddress(),
        value: ethers.parseEther("1.0")
      });

      const balance = await ethers.provider.getBalance(await xcmProxy.getAddress());
      expect(balance).to.equal(ethers.parseEther("1.0"));
    });

    it("should initialize with no supported tokens", async function () {
      // By default, no tokens should be supported
      const randomToken = "0x1111111111111111111111111111111111111111";
      expect(await xcmProxy.supportedTokens(randomToken)).to.equal(false);
    });

    it("should initialize with no positions", async function () {
      const positions = await xcmProxy.getActivePositions();
      expect(positions.length).to.equal(0);
    });

    it("should initialize with empty user positions", async function () {
      const userPositions = await xcmProxy.getUserPositions(user1.address);
      expect(userPositions.length).to.equal(0);
    });
  });

  describe("Deployment Gas Costs", function () {
    it("should report deployment gas cost", async function () {
      const XCMProxy = await ethers.getContractFactory("contracts/V1(Current)/XCMProxy.sol:XCMProxy");
      const deployTx = await XCMProxy.deploy(
        await mockQuoter.getAddress(),
        await mockRouter.getAddress()
      );
      
      const receipt = await deployTx.deploymentTransaction().wait();
      const gasUsed = receipt.gasUsed;

      console.log(`   XCMProxy deployment gas: ${gasUsed.toString()}`);
      
      // Just informational - no assertion
      expect(gasUsed).to.be.gt(0);
    });
  });

  describe("Constructor Parameter Validation", function () {
    it("should reject zero address for quoter in constructor", async function () {
      const XCMProxy = await ethers.getContractFactory("contracts/V1(Current)/XCMProxy.sol:XCMProxy");
      
      await expect(
        XCMProxy.deploy(
          ethers.ZeroAddress,
          await mockRouter.getAddress()
        )
      ).to.be.revertedWithCustomError(xcmProxy, "ZeroAddress");
    });

    it("should reject zero address for router in constructor", async function () {
      const XCMProxy = await ethers.getContractFactory("contracts/V1(Current)/XCMProxy.sol:XCMProxy");
      
      await expect(
        XCMProxy.deploy(
          await mockQuoter.getAddress(),
          ethers.ZeroAddress
        )
      ).to.be.revertedWithCustomError(xcmProxy, "ZeroAddress");
    });
  });
});

