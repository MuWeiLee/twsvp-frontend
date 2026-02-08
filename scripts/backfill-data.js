import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const runNodeScript = (relativePath, label) =>
  new Promise((resolve, reject) => {
    const fullPath = path.join(repoRoot, relativePath);
    const child = spawn(process.execPath, [fullPath], {
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${label} failed with exit code ${code}`));
    });
  });

const run = async () => {
  await runNodeScript("scripts/sync-stocks.js", "sync-stocks");
  await runNodeScript("scripts/sync-stock-prices.js", "sync-stock-prices");
  console.log("Backfill complete.");
};

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
