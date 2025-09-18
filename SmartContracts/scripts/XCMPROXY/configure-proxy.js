const { ethers } = require("hardhat");

async function tx(label, promise) {
  const res = await promise;
  const receipt = await res.wait();
  console.log(`   ✅ ${label} | tx: ${receipt.hash}`);
  return receipt;
}

async function main() {
  const network = await ethers.provider.getNetwork();
  console.log(`Configuring XCMProxy on ${network.name}`);

  const XCM_PROXY_ADDR = process.env.XCM_PROXY_ADDR;
  if (!XCM_PROXY_ADDR) throw new Error("set XCM_PROXY_ADDR env");

  const ASSET_HUB_PARAID = Number(process.env.ASSET_HUB_PARAID || 1000);
  const XTOKENS_PRECOMPILE = process.env.XTOKENS_PRECOMPILE || "0x0000000000000000000000000000000000000804";

  const proxy = await ethers.getContractAt("XCMProxy", XCM_PROXY_ADDR);

  console.log(` - setAssetHubParaId(${ASSET_HUB_PARAID})`);
  await tx("setAssetHubParaId", proxy.setAssetHubParaId(ASSET_HUB_PARAID));

  console.log(` - setXTokensPrecompile(${XTOKENS_PRECOMPILE})`);
  await tx("setXTokensPrecompile", proxy.setXTokensPrecompile(XTOKENS_PRECOMPILE));

  console.log("\n✅ XCMProxy configured");
}

main().catch((e) => { console.error(e); process.exit(1); });

