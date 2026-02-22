const { ApiPromise, WsProvider, Keyring } = require("@polkadot/api");
const { hexToU8a, u8aToHex } = require("@polkadot/util");
require("dotenv").config();

const MOON_PK = process.env.MOON_PK;

async function main() {
  if (!MOON_PK) throw new Error("MOON_PK not set");

  console.log("Connecting to Moonbeam...");
  const api = await ApiPromise.create({
    provider: new WsProvider("wss://wss.api.moonbeam.network"),
    signedExtensions: {
      CheckMetadataHash: {
        extrinsic: { mode: "u8" },
        payload: { metadataHash: "Option<H256>" },
      },
    },
  });

  // Moonbeam natively supports ethereum accounts for substrate extrinsics
  const keyring = new Keyring({ type: "ethereum" });
  const signer = keyring.addFromSeed(hexToU8a("0x" + MOON_PK));
  console.log("Signer:", signer.address);

  // Beneficiary on Asset Hub: EVM address padded with 0xEE = AccountId32
  const evmBytes = hexToU8a(signer.address);
  const accountId32 = new Uint8Array(32);
  accountId32.set(evmBytes, 0);
  accountId32.fill(0xEE, 20);
  console.log("Beneficiary AccountId32:", u8aToHex(accountId32));

  // From AssetsTrapped event at AH block 12488297:
  // Trapped: 29,512,619,638 DOT (V5), origin: Parachain(2004)
  const trappedAmount = "29512619638";

  // XCM to execute on Asset Hub: ClaimAsset + BuyExecution + DepositAsset
  const dest = { V4: { parents: 1, interior: { X1: [{ Parachain: 1000 }] } } };

  const message = {
    V5: [
      {
        ClaimAsset: {
          assets: [{
            id: { parents: 1, interior: "Here" },
            fun: { Fungible: trappedAmount },
          }],
          ticket: { parents: 0, interior: "Here" },
        },
      },
      {
        BuyExecution: {
          fees: {
            id: { parents: 1, interior: "Here" },
            fun: { Fungible: "500000000" }, // 0.05 DOT fees
          },
          weightLimit: "Unlimited",
        },
      },
      {
        DepositAsset: {
          assets: { Wild: "All" },
          beneficiary: {
            parents: 0,
            interior: {
              X1: [{
                AccountId32: {
                  network: null,
                  id: u8aToHex(accountId32),
                },
              }],
            },
          },
        },
      },
    ],
  };

  console.log("\nSending polkadotXcm.send from Moonbeam to Asset Hub...");
  console.log("Dest:", JSON.stringify(dest));
  console.log("Claiming:", trappedAmount, "DOT");

  const tx = api.tx.polkadotXcm.send(dest, message);
  console.log("Call data:", tx.method.toHex().substring(0, 80) + "...");

  // Submit
  try {
    const result = await new Promise((resolve, reject) => {
      tx.signAndSend(signer, ({ status, events, dispatchError }) => {
        console.log("  Status:", status.type);
        if (status.isInBlock || status.isFinalized) {
          const blockHash = status.isInBlock ? status.asInBlock : status.asFinalized;
          console.log("  Block:", blockHash.toHex());

          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              console.log("  ERROR:", `${decoded.section}.${decoded.name}: ${decoded.docs.join(" ")}`);
            } else {
              console.log("  ERROR:", dispatchError.toString());
            }
            resolve(false);
          } else {
            for (const { event } of events) {
              if (event.section !== "system" || event.method === "ExtrinsicFailed" || event.method === "ExtrinsicSuccess") {
                console.log(`  Event: ${event.section}.${event.method}`);
              }
            }
            resolve(true);
          }
        }
      }).catch(reject);
    });

    console.log("\nResult:", result ? "SUCCESS (XCM sent)" : "FAILED");
    if (result) {
      console.log("XCM sent to Asset Hub. Wait ~30s then check Asset Hub balance.");
    }
  } catch (e) {
    console.log("Failed:", e.message?.substring(0, 300));
  }

  await api.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
