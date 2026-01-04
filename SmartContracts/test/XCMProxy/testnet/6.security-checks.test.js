const { expect } = require("chai");
const { ethers } = require("hardhat");
const { getMoonbaseTestConfig } = require("./config");

describe("XCMProxy Security Checks", function () {
  let proxy;
  let operator;
  let user;
  const moonbase = getMoonbaseTestConfig();
  const PROXY_ADDRESS = moonbase.proxyAddress;
  const BASE_TOKEN = moonbase.baseToken;
  const POOL_ID = moonbase.poolAddress;

  before(async function () {
    if (!PROXY_ADDRESS) {
      this.skip();
    }
    const signers = await ethers.getSigners();
    operator = signers[0];
    // Create a random wallet for the unauthorized user test
    user = ethers.Wallet.createRandom().connect(ethers.provider);
    
    const XCMProxy = await ethers.getContractFactory("contracts/V1(Current)/XCMProxy.sol:XCMProxy");
    proxy = XCMProxy.attach(PROXY_ADDRESS);
  });

  describe("Vulnerability Fix Verification", function () {
    it("should have Quoter set for slippage calculations", async function () {
      const quoter = await proxy.quoterContract();
      expect(quoter).to.not.equal(ethers.ZeroAddress, "Quoter must be set for secure swaps");
    });

    it("should have SwapRouter set", async function () {
      const router = await proxy.swapRouterContract();
      expect(router).to.not.equal(ethers.ZeroAddress, "SwapRouter must be set");
    });
  });

  describe("Liquidation Settlement Security", function () {
    // We can't easily create a real liquidation scenario without a lot of setup,
    // but we can check access controls and state validation if we had a position.
    // For now, we'll check that unauthorized users cannot call sensitive functions.

    it("should prevent unauthorized users from calling executePendingInvestment", async function () {
      // Random position ID
      const fakeId = ethers.keccak256(ethers.toUtf8Bytes("fake-position"));
      
      // Since the user wallet has no funds to pay gas, this will fail with UNSUPPORTED_OPERATION
      // We need to use staticCall to test the revert without sending a transaction
      await expect(
        proxy.connect(user).executePendingInvestment.staticCall(fakeId)
      ).to.be.revertedWithCustomError(proxy, "NotOperator"); 
    });

    it("should prevent unauthorized users from calling liquidateSwapAndReturn", async function () {
        const fakeId = 12345;
        const fakeDest = "0x01";
        const fakeAssetHubId = ethers.keccak256(ethers.toUtf8Bytes("fake"));

        // Use staticCall to test the revert without sending a transaction
        await expect(
            proxy.connect(user).liquidateSwapAndReturn.staticCall(
                fakeId,
                BASE_TOKEN,
                fakeDest,
                0,
                0,
                0,
                fakeAssetHubId
            )
        ).to.be.revertedWithCustomError(proxy, "NotOperator");
    });
  });
});
