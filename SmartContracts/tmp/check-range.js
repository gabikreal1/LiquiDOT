const hre = require("hardhat");

async function main() {
  const proxyAddress = process.env.XCMPROXY_CONTRACT || process.env.XCMPROXY_ADDRESS || "0xf935e063b2108cc064bB356107ac01Dc90f96652";
  const poolAddress = process.env.POOL_ADDRESS || "0x85a000207D69042E8B075fCe43B6F28dfCE228b2";
  const XCMProxy = await hre.ethers.getContractFactory("contracts/V1(Current)/XCMProxy.sol:XCMProxy");
  const proxy = XCMProxy.attach(proxyAddress);
  const result = await proxy.calculateTickRange(poolAddress, -50, 50);
  console.log("tickLower", result[0].toString(), "tickUpper", result[1].toString());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
