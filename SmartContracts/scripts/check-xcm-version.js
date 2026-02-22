/**
 * Check XCM version support on Moonbeam using @polkadot/api (more stable for queries)
 */
const { ApiPromise, WsProvider } = require("@polkadot/api");

async function main() {
    console.log("=== XCM Version Check ===\n");

    // Moonbeam
    console.log("Connecting to Moonbeam...");
    const mbApi = await ApiPromise.create({
        provider: new WsProvider("wss://wss.api.moonbeam.network"),
        noInitWarn: true
    });
    console.log("Moonbeam runtime:", mbApi.runtimeVersion.specName.toString(), "v" + mbApi.runtimeVersion.specVersion.toString());

    // Check SafeXcmVersion
    const mbSafe = await mbApi.query.polkadotXcm.safeXcmVersion();
    console.log("Moonbeam SafeXcmVersion:", mbSafe.toString());

    // Check SupportedVersion entries
    const mbEntries = await mbApi.query.polkadotXcm.supportedVersion.entries();
    console.log("\nMoonbeam SupportedVersion entries (" + mbEntries.length + "):");
    for (const [key, val] of mbEntries) {
        const args = key.args;
        console.log("  xcmVersion:", args[0].toString(),
            "location:", args[1].toString(),
            "→ supported:", val.toString());
    }

    // Asset Hub
    console.log("\nConnecting to Asset Hub...");
    const ahApi = await ApiPromise.create({
        provider: new WsProvider("wss://polkadot-asset-hub-rpc.polkadot.io"),
        noInitWarn: true
    });
    console.log("Asset Hub runtime:", ahApi.runtimeVersion.specName.toString(), "v" + ahApi.runtimeVersion.specVersion.toString());

    const ahSafe = await ahApi.query.polkadotXcm.safeXcmVersion();
    console.log("Asset Hub SafeXcmVersion:", ahSafe.toString());

    const ahEntries = await ahApi.query.polkadotXcm.supportedVersion.entries();
    console.log("\nAsset Hub SupportedVersion entries (" + ahEntries.length + "):");
    for (const [key, val] of ahEntries) {
        const args = key.args;
        const locStr = args[1].toString();
        // Only show Moonbeam-related entries (parachain 2004)
        if (locStr.includes("2004") || ahEntries.length < 20) {
            console.log("  xcmVersion:", args[0].toString(),
                "location:", locStr,
                "→ supported:", val.toString());
        }
    }

    // Also print count of entries with version 5
    let v5Count = 0;
    let v4Count = 0;
    for (const [key, val] of ahEntries) {
        if (val.toString() === "5") v5Count++;
        if (val.toString() === "4") v4Count++;
    }
    console.log("\nAsset Hub version stats: V5 peers:", v5Count, "V4 peers:", v4Count, "Total:", ahEntries.length);

    await mbApi.disconnect();
    await ahApi.disconnect();
    process.exit(0);
}

main().catch(console.error);
