const { blake2AsHex, blake2AsU8a } = require("@polkadot/util-crypto");
const { u8aToHex } = require("@polkadot/util");

const paraId = 2004;
const prefix = "sibl";

// 1. Calculate Sovereign Account (AccountId32)
const prefixBytes = Buffer.from(prefix);
const paraIdBytes = Buffer.alloc(4);
paraIdBytes.writeUInt32LE(paraId);
const data = Buffer.concat([prefixBytes, paraIdBytes]);
const sovereignHash = blake2AsU8a(data, 256);
const sovereignHex = u8aToHex(sovereignHash);

console.log("Sovereign Account (32 bytes):", sovereignHex);

// 2. Calculate EVM Mapped Address (Hashed)
// Default mapping: First 20 bytes of Blake2_256(AccountId32)
const evmHash = blake2AsU8a(sovereignHash, 256);
const evmAddress = u8aToHex(evmHash.slice(0, 20));

console.log("EVM Mapped Address (20 bytes):", evmAddress);
