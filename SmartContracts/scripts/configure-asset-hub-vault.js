const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

function readJsonMaybe(filePath) {
  if (!filePath) return undefined;
  const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  if (!fs.existsSync(abs)) throw new Error(`JSON file not found: ${abs}`);
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function ensureHexBytes(value, name) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]*$/.test(value)) {
    throw new Error(`${name} must be 0x-prefixed hex string`);
  }
  return value;
}

function toBool(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") return defaultValue;
  const v = String(value).toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function parseJSONEnv(name) {
  const raw = process.env[name];
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`Env ${name} is not valid JSON: ${e.message}`);
  }
}

async function tx(label, promise) {
  const txRes = await promise;
  const receipt = await txRes.wait();
  console.log(`   ✅ ${label} | tx: ${receipt.hash}`);
  return receipt;
}

async function main() {
  const network = await ethers.provider.getNetwork();
  const [signer] = await ethers.getSigners();

  // Config sources: JSON file (arg or VAULT_CONFIG_JSON) and/or env fallbacks
  const jsonArgPath = process.argv[2];
  const jsonFromArg = readJsonMaybe(jsonArgPath);
  const jsonFromEnv = readJsonMaybe(process.env.VAULT_CONFIG_JSON);
  const cfgJson = jsonFromArg || jsonFromEnv || {};

  const VAULT_ADDR = cfgJson.vaultAddress || process.env.VAULT_ADDR;
  if (!VAULT_ADDR) throw new Error("VAULT_ADDR (or vaultAddress in JSON) is required");

  const ADMIN = cfgJson.admin || process.env.ADMIN;
  const OPERATOR = cfgJson.operator || process.env.OPERATOR;
  const EMERGENCY = cfgJson.emergency || process.env.EMERGENCY;

  const XCM_PRECOMPILE = cfgJson.xcmPrecompile || process.env.XCM_PRECOMPILE;
  const FREEZE_XCM_PRECOMPILE = cfgJson.freezeXcmPrecompile !== undefined
    ? !!cfgJson.freezeXcmPrecompile
    : toBool(process.env.FREEZE_XCM_PRECOMPILE, false);

  const DEST_DEFAULT = cfgJson.defaultDestination || process.env.DEST_DEFAULT;
  const DEST_CHAINS = cfgJson.chainDestinations || parseJSONEnv("DEST_CHAINS");

  const CHAIN_CONFIGS = cfgJson.chainConfigs || parseJSONEnv("CHAIN_CONFIGS");

  const ALLOWED_DESTS = cfgJson.allowedDestinations || parseJSONEnv("ALLOWED_DESTS");

  const PAUSE_STATE = cfgJson.pauseState || process.env.PAUSE_STATE; // "pause" | "unpause"

  const DRY_RUN = toBool(process.env.DRY_RUN, false);

  console.log(`\n⚙️  Configuring AssetHubVault on ${network.name} (chainId=${network.chainId})`);
  console.log(`👤 Operator: ${signer.address}`);
  console.log(`🏦 Vault: ${VAULT_ADDR}`);

  const vault = await ethers.getContractAt("AssetHubVault", VAULT_ADDR);

  // Admin/Operator/Emergency
  const currentAdmin = await vault.admin();
  const currentOperator = await vault.operator();
  const currentEmergency = await vault.emergency();

  if (ADMIN && ADMIN !== currentAdmin) {
    console.log(` - transferAdmin -> ${ADMIN}`);
    if (!DRY_RUN) await tx("transferAdmin", vault.transferAdmin(ADMIN));
  } else if (ADMIN) {
    console.log(`   ℹ️  admin already ${ADMIN}`);
  }

  if (OPERATOR && OPERATOR !== currentOperator) {
    console.log(` - setOperator -> ${OPERATOR}`);
    if (!DRY_RUN) await tx("setOperator", vault.setOperator(OPERATOR));
  } else if (OPERATOR) {
    console.log(`   ℹ️  operator already ${OPERATOR}`);
  }

  if (EMERGENCY && EMERGENCY !== currentEmergency) {
    console.log(` - setEmergency -> ${EMERGENCY}`);
    if (!DRY_RUN) await tx("setEmergency", vault.setEmergency(EMERGENCY));
  } else if (EMERGENCY) {
    console.log(`   ℹ️  emergency already ${EMERGENCY}`);
  }

  // XCM precompile set/freeze
  if (XCM_PRECOMPILE) {
    const currentPrecompile = await vault.XCM_PRECOMPILE();
    if (currentPrecompile.toLowerCase() !== XCM_PRECOMPILE.toLowerCase()) {
      console.log(` - setXcmPrecompile -> ${XCM_PRECOMPILE}`);
      if (!DRY_RUN) await tx("setXcmPrecompile", vault.setXcmPrecompile(XCM_PRECOMPILE));
    } else {
      console.log(`   ℹ️  XCM_PRECOMPILE already ${XCM_PRECOMPILE}`);
    }
  }

  if (FREEZE_XCM_PRECOMPILE) {
    const frozen = await vault.xcmPrecompileFrozen();
    if (!frozen) {
      console.log(` - freezeXcmPrecompile`);
      if (!DRY_RUN) await tx("freezeXcmPrecompile", vault.freezeXcmPrecompile());
    } else {
      console.log(`   ℹ️  xcm precompile already frozen`);
    }
  }

  // Destinations
  if (DEST_DEFAULT) {
    ensureHexBytes(DEST_DEFAULT, "DEST_DEFAULT");
    console.log(` - setDestinationMultiLocation (default)`);
    if (!DRY_RUN) await tx("setDestinationMultiLocation", vault.setDestinationMultiLocation(DEST_DEFAULT));
  }

  if (DEST_CHAINS && typeof DEST_CHAINS === "object") {
    for (const [chainIdStr, hexVal] of Object.entries(DEST_CHAINS)) {
      ensureHexBytes(hexVal, `DEST_CHAINS[${chainIdStr}]`);
      const chainId = Number(chainIdStr);
      console.log(` - setDestinationForChain(${chainId})`);
      if (!DRY_RUN) await tx(
        `setDestinationForChain(${chainId})`,
        vault.setDestinationForChain(chainId, hexVal)
      );
    }
  }

  // Chain configs
  if (CHAIN_CONFIGS && typeof CHAIN_CONFIGS === "object") {
    for (const [chainIdStr, cfg] of Object.entries(CHAIN_CONFIGS)) {
      const chainId = Number(chainIdStr);
      const parachainId = Number(cfg.parachainId);
      const networkByte = Number(cfg.network);
      console.log(` - setChainConfig(${chainId}) -> paraId=${parachainId}, net=${networkByte}`);
      if (!DRY_RUN) await tx(
        `setChainConfig(${chainId})`,
        vault.setChainConfig(chainId, parachainId, networkByte)
      );
    }
  }

  // Allowed destinations
  if (Array.isArray(ALLOWED_DESTS)) {
    for (const addr of ALLOWED_DESTS) {
      console.log(` - setAllowedDestination(${addr}, true)`);
      if (!DRY_RUN) await tx(
        `setAllowedDestination(${addr})`,
        vault.setAllowedDestination(addr, true)
      );
    }
  } else if (ALLOWED_DESTS && typeof ALLOWED_DESTS === "object") {
    for (const [addr, allowed] of Object.entries(ALLOWED_DESTS)) {
      const isAllowed = !!allowed;
      console.log(` - setAllowedDestination(${addr}, ${isAllowed})`);
      if (!DRY_RUN) await tx(
        `setAllowedDestination(${addr})`,
        vault.setAllowedDestination(addr, isAllowed)
      );
    }
  }

  // Pause state
  if (PAUSE_STATE) {
    const paused = await vault.paused();
    if (PAUSE_STATE === "pause" && !paused) {
      console.log(` - pause()`);
      if (!DRY_RUN) await tx("pause", vault.pause());
    } else if (PAUSE_STATE === "unpause" && paused) {
      console.log(` - unpause()`);
      if (!DRY_RUN) await tx("unpause", vault.unpause());
    } else {
      console.log(`   ℹ️  pause state already '${paused ? "pause" : "unpause"}'`);
    }
  }

  console.log(`\n✅ Configuration completed`);
}

main().catch((e) => { console.error(e); process.exit(1); });

