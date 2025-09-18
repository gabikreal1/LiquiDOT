const { ethers } = require("hardhat");

async function tx(label, promise) {
  const res = await promise;
  const receipt = await res.wait();
  console.log(`   ✅ ${label} | tx: ${receipt.hash}`);
  return receipt;
}

async function main() {
  const network = await ethers.provider.getNetwork();
  console.log(`Wiring Vault to Proxy on ${network.name}`);

  const VAULT_ADDR = process.env.VAULT_ADDR;
  const XCM_PROXY_ADDR = process.env.XCM_PROXY_ADDR;
  const XCM_PRECOMPILE = process.env.XCM_PRECOMPILE; // AssetHub side

  if (!VAULT_ADDR || !XCM_PROXY_ADDR) throw new Error("set VAULT_ADDR and XCM_PROXY_ADDR envs");

  const vault = await ethers.getContractAt("AssetHubVault", VAULT_ADDR);

  if (XCM_PRECOMPILE) {
    console.log(` - setXcmPrecompile(${XCM_PRECOMPILE})`);
    await tx("setXcmPrecompile", vault.setXcmPrecompile(XCM_PRECOMPILE));
  }

  console.log(` - setDestinationFor default (Moonbase) via previously encoded bytes (DEST_DEFAULT env)`);
  const DEST_DEFAULT = process.env.DEST_DEFAULT;
  if (DEST_DEFAULT) {
    await tx("setDestinationMultiLocation", vault.setDestinationMultiLocation(DEST_DEFAULT));
  }

  console.log(` - setAllowedDestination(${XCM_PROXY_ADDR}, true)`);
  await tx("setAllowedDestination", vault.setAllowedDestination(XCM_PROXY_ADDR, true));

  console.log("\n✅ Vault wired to Proxy");
}

main().catch((e) => { console.error(e); process.exit(1); });
