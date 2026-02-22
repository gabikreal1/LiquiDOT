const { ApiPromise, WsProvider } = require("@polkadot/api");

async function main() {
    console.log("Connecting to Asset Hub...");
    const provider = new WsProvider("wss://polkadot-asset-hub-rpc.polkadot.io");
    const api = await ApiPromise.create({ provider });

    console.log("Runtime Version:", api.runtimeVersion.specVersion.toString());
    console.log("Metadata Version:", api.runtimeMetadata.version);

    // Check available XCM versions in the enum
    try {
        const xcmType = api.createType("XcmVersionedXcm");
        console.log("\nXcmVersionedXcm structure (empty default):");
        console.log(JSON.stringify(xcmType.toHuman(), null, 2));

        console.log("\nDefKeys:", xcmType.defKeys);
    } catch (e) {
        console.log("Error creating defined type:", e);
    }

    // Try Validation of V4 Structure
    console.log("\nTesting V4 Construction...");
    try {
        const testV4 = api.createType("XcmVersionedXcm", {
            V4: [
                {
                    WithdrawAsset: [
                        {
                            id: { parents: 1, interior: "Here" },
                            fun: { Fungible: 100 }
                        }
                    ]
                }
            ]
        });
        console.log("✅ V4 Constructible!");
        console.log("Hex:", testV4.toHex());
    } catch (e) {
        console.log("❌ V4 Construction Failed:", e.message);
    }

    // Check V3 just in case
    console.log("\nTesting V3 Construction...");
    try {
        const testV3 = api.createType("XcmVersionedXcm", {
            V3: [
                {
                    WithdrawAsset: [
                        {
                            id: { Concrete: { parents: 1, interior: "Here" } },
                            fun: { Fungible: 100 }
                        }
                    ]
                }
            ]
        });
        console.log("✅ V3 Constructible!");
        console.log("Hex:", testV3.toHex());
    } catch (e) {
        console.log("❌ V3 Construction Failed:", e.message);
    }

    // Probing Interior Structure for Destination (Validation)
    // Checking if X1 expects Array or Object
    console.log("\nTesting Destination Interior (V3 vs V4 X1)...");
    try {
        // Attempt V3 style interior: X1: { Parachain: 2004 }
        const v3Dest = api.createType("XcmV3MultiLocation", {
            parents: 1,
            interior: { X1: { Parachain: 2004 } }
        });
        console.log("V3 Dest (Object X1): OK");
    } catch (e) { console.log("V3 Dest (Object X1): Failed", e.message); }

    try {
        // Attempt V4 style interior: X1: [{ Parachain: 2004 }] (Array?)
        // Note: V4 usually simplifies but Polkadot-JS mapping might vary.
        const v4Dest = api.createType("StagingXcmV4Location", {
            parents: 1,
            interior: { X1: [{ Parachain: 2004 }] }
        });
        console.log("V4 Dest (Array X1): OK");
    } catch (e) {
        // Try Object
        try {
            const v4DestObj = api.createType("StagingXcmV4Location", {
                parents: 1,
                interior: { X1: { Parachain: 2004 } }
            });
            console.log("V4 Dest (Object X1): OK");
        } catch (e2) {
            console.log("V4 Dest Failed:", e.message);
        }
    }

    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
