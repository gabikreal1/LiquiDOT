const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("XCM Adapter Contracts (unit)", function () {
  it("AssetHubXcmSender: forwards sendXcm() to target", async function () {
    const [deployer] = await ethers.getSigners();

    const Mock = await ethers.getContractFactory(
      "contracts/test/MockAssetHubXcm.sol:MockAssetHubXcm"
    );

    const mock = await Mock.deploy();
    await mock.waitForDeployment();

    const Sender = await ethers.getContractFactory(
      "contracts/V1(Current)/xcm/AssetHubXcmSender.sol:AssetHubXcmSender"
    );

    const sender = await Sender.deploy(await mock.getAddress());
    await sender.waitForDeployment();

    const destination = "0x010203";
    const message = "0xaabbccdd";

    await expect(sender.connect(deployer).sendXcm(destination, message))
      .to.emit(mock, "Sent")
      .withArgs(destination, message);
  });

  it("MoonbeamXTokensSender: requires 32-byte amount", async function () {
    const Sender = await ethers.getContractFactory(
      "contracts/V1(Current)/xcm/MoonbeamXTokensSender.sol:MoonbeamXTokensSender"
    );

    const MockXTokens = await ethers.getContractFactory(
      "contracts/test/MockXTokens.sol:MockXTokens"
    );

    const mock = await MockXTokens.deploy();
    await mock.waitForDeployment();

    const token = ethers.Wallet.createRandom().address;
    const destWeight = 123n;

    const sender = await Sender.deploy(await mock.getAddress(), token, destWeight);
    await sender.waitForDeployment();

    await expect(sender.sendXcm("0x01", "0x1234")).to.be.revertedWith("amount must be 32 bytes");
  });

  it("MoonbeamXTokensSender: decodes amount and forwards to XTokens", async function () {
    const Sender = await ethers.getContractFactory(
      "contracts/V1(Current)/xcm/MoonbeamXTokensSender.sol:MoonbeamXTokensSender"
    );

    const MockXTokens = await ethers.getContractFactory(
      "contracts/test/MockXTokens.sol:MockXTokens"
    );

    const mock = await MockXTokens.deploy();
    await mock.waitForDeployment();

    const token = ethers.Wallet.createRandom().address;
    const destWeight = 456n;

    const sender = await Sender.deploy(await mock.getAddress(), token, destWeight);
    await sender.waitForDeployment();

    const destination = "0x0a0b0c";
    const amount = 1000n;
    const msgBytes = ethers.zeroPadValue(ethers.toBeHex(amount), 32);

    await expect(sender.sendXcm(destination, msgBytes))
      .to.emit(mock, "Transfer")
      .withArgs(token, amount, destination, destWeight);
  });
});
