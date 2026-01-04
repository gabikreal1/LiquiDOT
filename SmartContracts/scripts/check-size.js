const fs = require('fs');
const path = require('path');

async function main() {
    const artifactPath = path.join(__dirname, '../artifacts-evm/contracts/V1(Current)/XCMProxy.sol/XCMProxy.json');
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const bytecode = artifact.deployedBytecode;
    const size = (bytecode.length - 2) / 2;
    console.log(`XCMProxy size: ${size} bytes`);
    if (size > 24576) {
        console.log(`WARNING: Contract size exceeds Spurious Dragon limit (24576 bytes) by ${size - 24576} bytes`);
    } else {
        console.log(`SUCCESS: Contract size is within limit (${24576 - size} bytes remaining)`);
    }
}

main();