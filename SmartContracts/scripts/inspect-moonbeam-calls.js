const { ApiPromise, WsProvider } = require("@polkadot/api");
const { ethers } = require("ethers");

async function main() {
    console.log("=== Inspecting Moonbeam Runtime Calls for EVM ===\n");
    const wsProvider = new WsProvider("wss://wss.api.moonbeam.network");
    const api = await ApiPromise.create({ provider: wsProvider });

    console.log("Runtime Version:", api.runtimeVersion.specName.toString(), api.runtimeVersion.specVersion.toString());

    // Look for EVM-related modules
    const modules = Object.keys(api.tx);
    console.log("\nModules:", modules.filter(m => m.toLowerCase().includes("evm") || m.toLowerCase().includes("eth")));

    if (api.tx.ethereum) {
        console.log("\napi.tx.ethereum methods:", Object.keys(api.tx.ethereum));
        // Check transact signature
        console.log("ethereum.transact meta:", api.tx.ethereum.transact.meta.toString());
    }

    // We want to simulate what 'Transact' XCM instruction would execute.
    // It usually executes a Dispatchable.
    // To call a smart contract, we usually need 'ethereum.transact' 
    // BUT 'ethereum.transact' usually takes a full EIP-1559 transaction struct including signature? 
    // If so, XCM Transact cannot easily forge a signature.

    // Maybe 'evm.call'? Moonbeam had a 'evm' pallet before.
    if (api.tx.evm) {
        console.log("\napi.tx.evm methods:", Object.keys(api.tx.evm));
        if (api.tx.evm.call) {
            console.log("evm.call meta:", JSON.stringify(api.tx.evm.call.meta.toJSON(), null, 2));
        }
    }

    // Try to construct a call
    // If 'ethereum.transact' takes 'TransactionV2', we might need to look for a way to call without signature (as Root/Sovereign).
    // Or maybe Moonbeam supports 'utility.dispatch_as'?

    // Let's create the inner EVM call data first
    const proxyInterface = new ethers.Interface(["function receiveAssets(bytes32,address,address,uint256,bytes)"]);
    const dummyData = proxyInterface.encodeFunctionData("receiveAssets", [
        ethers.ZeroHash, ethers.ZeroAddress, ethers.ZeroAddress, 0, "0x"
    ]);

    console.log("\nDummy EVM Calldata:", dummyData);

    await api.disconnect();
}

main().catch(console.error);
