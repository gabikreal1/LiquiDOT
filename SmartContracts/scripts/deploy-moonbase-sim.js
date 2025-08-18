const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying Moonbase simulation: Mock tokens + XCMProxy...");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Deploy mock tokens
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const dot = await MockERC20.deploy("Mock DOT", "mDOT", 10, ethers.parseUnits("1000000", 10), deployer.address);
  await dot.waitForDeployment();
  const usdc = await MockERC20.deploy("Mock USDC", "mUSDC", 6, ethers.parseUnits("1000000", 6), deployer.address);
  await usdc.waitForDeployment();
  const usdt = await MockERC20.deploy("Mock USDT", "mUSDT", 6, ethers.parseUnits("1000000", 6), deployer.address);
  await usdt.waitForDeployment();

  console.log("DOT:", await dot.getAddress());
  console.log("USDC:", await usdc.getAddress());
  console.log("USDT:", await usdt.getAddress());

  // Deploy XCMProxy
  const XCMProxy = await ethers.getContractFactory("XCMProxy");
  const proxy = await XCMProxy.deploy(deployer.address);
  await proxy.waitForDeployment();
  console.log("XCMProxy:", await proxy.getAddress());

  // Configure supported tokens
  await (await proxy.addSupportedToken(await dot.getAddress())).wait();
  await (await proxy.addSupportedToken(await usdc.getAddress())).wait();
  await (await proxy.addSupportedToken(await usdt.getAddress())).wait();

  // Save deployment info
  const fs = require("fs");
  const out = {
    network: network.name,
    chainId: network.config.chainId,
    deployer: deployer.address,
    DOT: await dot.getAddress(),
    USDC: await usdc.getAddress(),
    USDT: await usdt.getAddress(),
    XCMProxy: await proxy.getAddress(),
    timestamp: new Date().toISOString()
  };
  fs.mkdirSync("deployments", { recursive: true });
  fs.writeFileSync(`deployments/moonbase-sim-${network.name}.json`, JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


