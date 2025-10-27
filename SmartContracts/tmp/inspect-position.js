const hre = require("hardhat");

async function main() {
  const proxyAddress = process.env.XCMPROXY_CONTRACT || process.env.XCMPROXY_ADDRESS || "0xf935e063b2108cc064bB356107ac01Dc90f96652";
  const XCMProxy = await hre.ethers.getContractFactory("contracts/V1(Current)/XCMProxy.sol:XCMProxy");
  const proxy = XCMProxy.attach(proxyAddress);
  const position = await proxy.positions(1);
  console.log("position", position);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
