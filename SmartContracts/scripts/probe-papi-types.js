const descriptor = require("@polkadot-api/descriptors");
const { createClient } = require("polkadot-api");
const { getWsProvider } = require("polkadot-api/ws-provider/node");

async function main() {
    console.log("Probing '@polkadot-api/descriptors'...");

    console.log("Root Keys:", Object.keys(descriptor));

    if (descriptor.dotah) {
        console.log("\nFound 'dotah':", typeof descriptor.dotah);
        if (typeof descriptor.dotah === 'object') {
            console.log("dotah Keys:", Object.keys(descriptor.dotah));
        }
    }

    // Check if XcmVersionedXcm can be destructured directly
    if (descriptor.XcmVersionedXcm) {
        console.log("✅ XcmVersionedXcm FOUND at root!");
        console.log("Has .enc?", typeof descriptor.XcmVersionedXcm.enc);
    }

    // Try via API client
    try {
        const client = createClient(getWsProvider("wss://polkadot-asset-hub-rpc.polkadot.io"));
        const api = client.getTypedApi(descriptor.dotah);

        console.log("\nTyped API initialized.");
        // Try looking for types/codecs in API if not in descriptors
    } catch (e) {
        console.error("API Error:", e.message);
    }

    process.exit(0);
}

main().catch(console.error);
