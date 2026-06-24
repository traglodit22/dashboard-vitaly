const fs = require("fs");
const path = require("path");

const appDir = __dirname;

function loadEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const fileEnv = loadEnvFile(path.join(appDir, ".env"));

/** @type {import('pm2').StartOptions[]} */
module.exports = {
  apps: [
    {
      name: "dashboard",
      cwd: path.join(appDir, "runtime/current"),
      script: "server.js",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOSTNAME: "127.0.0.1",
        MIGRATIONS_DIR: path.join(appDir, "runtime/current/db/migrations"),
        UPLOAD_DIR: path.join(appDir, "uploads"),
        ...fileEnv,
      },
      max_memory_restart: "512M",
    },
  ],
};
