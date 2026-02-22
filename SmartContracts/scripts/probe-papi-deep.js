const { XcmVersionedXcm } = require("@polkadot-api/descriptors");

async function main() {
    console.log("Deep Probe of XcmVersionedXcm...");

    const msg = XcmVersionedXcm.V4([]);
    console.log("V4 Msg:", msg);

    try {
        const enc = XcmVersionedXcm.enc(msg);
        console.log("Encoded Type:", typeof enc);
        console.log("Encoded Keys:", Object.keys(enc));

        if (enc instanceof Uint8Array) {
            console.log("Is Uint8Array (Success!)");
        } else {
            console.log("Is NOT Uint8Array. Inspecting...");
            console.log("Constructor:", enc.constructor.name);
            console.log("Prototype:", Object.getPrototypeOf(enc));

            // Check for toHex/asBytes methods
            if (typeof enc.toHex === 'function') console.log("Has .toHex()");
            if (typeof enc.asBytes === 'function') console.log("Has .asBytes()");
            if (typeof enc.enc === 'function') console.log("Has .enc()");

            // Maybe it's an Iterator or strange structure?
            console.log("JSON:", JSON.stringify(enc));
        }
    } catch (e) {
        console.log("Enc Error:", e.message);
    }
}

main().catch(console.error);
