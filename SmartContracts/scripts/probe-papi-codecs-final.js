const { dotah } = require("@polkadot-api/descriptors");
const { getTypedCodecs } = require("polkadot-api");

async function main() {
    console.log("Getting Typed Codecs...");
    const codecs = await getTypedCodecs(dotah); // It's async? Browser agent said await.

    // console.log("Codecs keys:", Object.keys(codecs));
    // console.log("TX keys:", Object.keys(codecs.tx));
    // console.log("PolkadotXcm keys:", Object.keys(codecs.tx.PolkadotXcm));

    try {
        const sendArgs = codecs.tx.PolkadotXcm.send.args;
        console.log("Send Args inner keys:", Object.keys(sendArgs.inner));

        const messageCodec = sendArgs.inner.message;
        console.log("Message Codec Type:", messageCodec.constructor.name);

        if (typeof messageCodec.enc === 'function') {
            console.log("✅ Found .enc on PolkadotXcm.send.message!");
        } else {
            console.log("❌ No .enc on PolkadotXcm.send.message");
        }

    } catch (e) {
        console.log("Error accessing send args:", e.message);
    }

    try {
        const executeArgs = codecs.tx.PolkadotXcm.execute.args;
        console.log("Execute Args inner keys:", Object.keys(executeArgs.inner));

        const messageCodec = executeArgs.inner.message;

        if (typeof messageCodec.enc === 'function') {
            console.log("✅ Found .enc on PolkadotXcm.execute.message!");
        }
    } catch (e) {
        console.log("Error accessing execute args:", e.message);
    }
}

main().catch(console.error);
