/**
 * Clear Deployment Checkpoint
 * 
 * Removes the algebra-deployment-state.json checkpoint file
 * so you can start a fresh deployment from scratch.
 * 
 * Usage:
 *   node scripts/clear-deployment-checkpoint.js
 */

const fs = require("fs");
const path = require("path");

const checkpointFile = path.join(__dirname, "../deployments/algebra-deployment-state.json");

if (fs.existsSync(checkpointFile)) {
  fs.unlinkSync(checkpointFile);
  console.log("✅ Deployment checkpoint cleared!");
  console.log(`   Removed: ${checkpointFile}`);
  console.log("\nYou can now run a fresh deployment.");
} else {
  console.log("ℹ️  No checkpoint file found. Nothing to clear.");
}
