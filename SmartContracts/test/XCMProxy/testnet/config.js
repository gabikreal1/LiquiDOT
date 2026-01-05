const fs = require("fs");
const path = require("path");

const DEFAULT_BOOTSTRAP_PATH = path.join(__dirname, "../../../deployments/moonbase_bootstrap.json");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function readJson(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");
      return JSON.parse(raw);
    }
  } catch (error) {
    console.warn(`⚠️  Failed to read ${filePath}: ${error.message}`);
  }
  return {};
}

function normalizeAddress(value) {
  if (!value || typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed === ZERO_ADDRESS) {
    return undefined;
  }
  return trimmed;
}

function parseAddressList(raw) {
  if (!raw) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw.filter(Boolean).map((item) => item.trim());
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function getMoonbaseTestConfig() {
  const bootstrapPath = process.env.MOONBASE_BOOTSTRAP_FILE || DEFAULT_BOOTSTRAP_PATH;
  console.log("Reading bootstrap from:", bootstrapPath);
  const fileConfig = readJson(bootstrapPath);
  console.log("File config address:", fileConfig.xcmProxy ? fileConfig.xcmProxy.address : "undefined");

  // Prioritize file config over env vars for easier redeployment
  const proxyAddress =
    normalizeAddress(fileConfig?.xcmProxy?.address) ||
    normalizeAddress(process.env.XCMPROXY_CONTRACT) ||
    normalizeAddress(process.env.XCMPROXY_ADDRESS);

  if (!proxyAddress) {
    throw new Error(
      "XCMPROXY_CONTRACT not set and bootstrap file missing xcmProxy.address. Run scripts/bootstrap-moonbase-infra.js or export addresses manually."
    );
  }

  const supportedTokens = parseAddressList(process.env.MOONBASE_SUPPORTED_TOKENS) || [];
  if (supportedTokens.length === 0 && Array.isArray(fileConfig?.supportedTokens)) {
    fileConfig.supportedTokens.forEach((addr) => {
      if (normalizeAddress(addr)) {
        supportedTokens.push(addr);
      }
    });
  }

  const baseToken =
    normalizeAddress(process.env.MOONBASE_BASE_TOKEN) ||
    normalizeAddress(fileConfig?.baseToken?.address) ||
    supportedTokens[0];

  const quoteToken =
    normalizeAddress(process.env.MOONBASE_QUOTE_TOKEN) ||
    normalizeAddress(fileConfig?.quoteToken?.address) ||
    supportedTokens[1];

  const poolAddress =
    normalizeAddress(process.env.MOONBASE_REAL_POOL) ||
    normalizeAddress(fileConfig?.pool?.address);

  if (!process.env.MOONBASE_BOOTSTRAP_FILE && fs.existsSync(bootstrapPath)) {
    process.env.MOONBASE_BOOTSTRAP_FILE = bootstrapPath;
  }
  if (!process.env.MOONBASE_BASE_TOKEN && baseToken) {
    process.env.MOONBASE_BASE_TOKEN = baseToken;
  }
  if (!process.env.MOONBASE_REAL_POOL && poolAddress) {
    process.env.MOONBASE_REAL_POOL = poolAddress;
  }
  if (!process.env.MOONBASE_SUPPORTED_TOKENS && supportedTokens.length > 0) {
    process.env.MOONBASE_SUPPORTED_TOKENS = supportedTokens.join(",");
  }

  return {
    bootstrapPath,
    proxyAddress,
    supportedTokens,
    baseToken,
    quoteToken,
    poolAddress,
    network: fileConfig?.network,
    raw: fileConfig,
  };
}

module.exports = {
  getMoonbaseTestConfig,
};
