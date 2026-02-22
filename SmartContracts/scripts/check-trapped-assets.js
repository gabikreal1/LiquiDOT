const { ApiPromise, WsProvider } = require("@polkadot/api");

async function main() {
  console.log("Connecting to Asset Hub...");
  const api = await ApiPromise.create({
    provider: new WsProvider("wss://polkadot-asset-hub-rpc.polkadot.io"),
  });

  // 1. Check all trapped asset entries
  console.log("\n=== Asset Traps ===");
  const allTraps = await api.query.polkadotXcm.assetTraps.entries();
  console.log(`Total trapped asset hashes: ${allTraps.length}`);
  for (const [key, count] of allTraps) {
    console.log(`  Hash: ${key.args[0].toHex()}, Count: ${count.toNumber()}`);
  }

  // 2. Look for recent AssetsTrapped events in the last ~100 blocks
  const currentBlock = (await api.rpc.chain.getHeader()).number.toNumber();
  console.log(`\nCurrent block: ${currentBlock}`);
  console.log("Scanning last 100 blocks for AssetsTrapped events...\n");

  for (let blockNum = currentBlock; blockNum > currentBlock - 100; blockNum--) {
    const hash = await api.rpc.chain.getBlockHash(blockNum);
    const events = await api.query.system.events.at(hash);

    for (const { event } of events) {
      if (event.section === "polkadotXcm" && event.method === "AssetsTrapped") {
        console.log(`Block ${blockNum}: AssetsTrapped`);
        console.log("  Hash:", event.data[0].toHex());
        console.log("  Origin:", JSON.stringify(event.data[1].toJSON(), null, 2));
        console.log("  Assets:", JSON.stringify(event.data[2].toJSON(), null, 2));
      }

      // Also check for any XCM-related events
      if (event.section === "messageQueue" && event.method === "Processed") {
        // XCM message was processed
      }
    }
  }

  // 3. Also check if there are any xcmpQueue events indicating failure
  console.log("Scanning last 100 blocks for XCM failure events...\n");
  for (let blockNum = currentBlock; blockNum > currentBlock - 100; blockNum--) {
    const hash = await api.rpc.chain.getBlockHash(blockNum);
    const events = await api.query.system.events.at(hash);

    for (const { event } of events) {
      if (
        (event.section === "polkadotXcm" && event.method !== "VersionNotifyStarted" && event.method !== "SupportedVersionChanged") ||
        (event.section === "messageQueue" && event.method === "ProcessingFailed") ||
        (event.section === "xcmpQueue")
      ) {
        console.log(`Block ${blockNum}: ${event.section}.${event.method}`);
        try {
          console.log("  Data:", JSON.stringify(event.data.toJSON(), null, 2));
        } catch {
          console.log("  Data:", event.data.toString());
        }
      }
    }
  }

  await api.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
