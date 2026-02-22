const Papi = require("polkadot-api");
const Descriptors = require("@polkadot-api/descriptors");

async function main() {
    console.log("Probing PAPI Exports...");

    console.log("Polkadot-API:", Object.keys(Papi));
    if (Papi.getCodec) console.log("=> Found getCodec in Polkadot-API!");
    if (Papi.Codec) console.log("=> Found Codec in Polkadot-API!");
    if (Papi.Encoder) console.log("=> Found Encoder in Polkadot-API!");

    console.log("Descriptors:", Object.keys(Descriptors));
    if (Descriptors.getCodec) console.log("=> Found getCodec in Descriptors!");

    if (Descriptors.dotah) {
        console.log("dotah Keys:", Object.keys(Descriptors.dotah));
        // Check contents of dotah object
        // It might have codecs or definitions
    }

    // Check XcmVersionedXcm directly again to confirm its unexpected behavior
    if (Descriptors.XcmVersionedXcm) {
        console.log("XcmVersionedXcm Keys:", Object.keys(Descriptors.XcmVersionedXcm));
        // Check if it has any codec related props
    }
}

main().catch(console.error);
