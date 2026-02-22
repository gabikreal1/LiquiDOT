const { ApiPromise, WsProvider } = require("@polkadot/api");

async function main() {
  console.log("Connecting to Asset Hub...");
  const api = await ApiPromise.create({
    provider: new WsProvider("wss://polkadot-asset-hub-rpc.polkadot.io"),
  });

  const currentBlock = (await api.rpc.chain.getHeader()).number.toNumber();
  console.log(`Current block: ${currentBlock}`);

  // Scan last 500 blocks (~100 min) for XCM-related events
  const scanBlocks = 500;
  console.log(`Scanning last ${scanBlocks} blocks for XCM events from Moonbeam (paraId 2004)...\n`);

  let found = false;
  for (let blockNum = currentBlock; blockNum > currentBlock - scanBlocks; blockNum--) {
    const hash = await api.rpc.chain.getBlockHash(blockNum);
    const events = await api.query.system.events.at(hash);

    for (const { event } of events) {
      // Look for AssetsTrapped, Attempted, or messageQueue events
      const isXcm = event.section === "polkadotXcm";
      const isMsgQ = event.section === "messageQueue";
      const isBalance = event.section === "balances" && event.method === "Minted";

      if (isXcm && (event.method === "AssetsTrapped" || event.method === "Attempted")) {
        found = true;
        console.log(`Block ${blockNum}: ${event.section}.${event.method}`);
        try {
          const data = event.data.toJSON();
          console.log("  Data:", JSON.stringify(data, null, 2).substring(0, 500));
        } catch { console.log("  Data:", event.data.toString().substring(0, 500)); }
        console.log("");
      }

      if (isMsgQ && event.method === "Processed") {
        const data = event.data.toJSON();
        // Check if origin involves parachain 2004 (Moonbeam)
        const dataStr = JSON.stringify(data);
        if (dataStr.includes("2004")) {
          found = true;
          console.log(`Block ${blockNum}: messageQueue.Processed (Moonbeam)`);
          console.log("  Data:", dataStr.substring(0, 500));
          console.log("");
        }
      }

      if (isMsgQ && event.method === "ProcessingFailed") {
        found = true;
        console.log(`Block ${blockNum}: messageQueue.ProcessingFailed`);
        try {
          console.log("  Data:", JSON.stringify(event.data.toJSON(), null, 2).substring(0, 500));
        } catch { console.log("  Data:", event.data.toString().substring(0, 500)); }
        console.log("");
      }
    }

    // Progress
    if ((currentBlock - blockNum) % 100 === 0 && blockNum < currentBlock) {
      console.log(`  ...scanned ${currentBlock - blockNum} blocks...`);
    }
  }

  if (!found) {
    console.log("No XCM events from Moonbeam found in the last", scanBlocks, "blocks.");
    console.log("The XCM may not have arrived yet, or arrived earlier.");
  }

  // Also check the signer's full account info via Substrate
  const signerH160 = "0x741Ae17d47D479E878ADFB3c78b02DB583c63d58";
  // Compute the Substrate AccountId32 from EVM H160 (truncated hash)
  const { decodeAddress, encodeAddress } = require("@polkadot/util-crypto");
  const { u8aToHex, hexToU8a } = require("@polkadot/util");

  // On Asset Hub, EVM addresses map to AccountId32 by padding with 0xEE
  const evmBytes = hexToU8a(signerH160);
  const padded = new Uint8Array(32);
  padded.set(evmBytes, 0);
  padded.fill(0xEE, 20); // pad remaining 12 bytes with 0xEE
  const substrateAddr = encodeAddress(padded, 0); // SS58 format
  console.log("\nEVM address:", signerH160);
  console.log("Substrate AccountId32 (padded):", u8aToHex(padded));
  console.log("SS58 address:", substrateAddr);

  const accountInfo = await api.query.system.account(padded);
  console.log("Account info:", JSON.stringify(accountInfo.toJSON(), null, 2));

  await api.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
