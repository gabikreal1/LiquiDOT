const { ApiPromise, WsProvider } = require("@polkadot/api");

async function main() {
  const api = await ApiPromise.create({
    provider: new WsProvider("wss://polkadot-asset-hub-rpc.polkadot.io"),
  });

  const blockNum = 12488297;
  const hash = await api.rpc.chain.getBlockHash(blockNum);
  const events = await api.query.system.events.at(hash);

  console.log(`Block ${blockNum}: ${events.length} events\n`);

  for (const { event, phase } of events) {
    const isRelevant =
      event.section === "polkadotXcm" ||
      event.section === "messageQueue" ||
      event.section === "balances" ||
      event.section === "xcmpQueue" ||
      event.section === "foreignAssets";

    if (isRelevant) {
      console.log(`${event.section}.${event.method} [phase: ${phase.toString()}]`);
      try {
        const data = event.data.toJSON();
        console.log(JSON.stringify(data, null, 2));
      } catch {
        console.log(event.data.toString());
      }
      console.log("");
    }
  }

  await api.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
