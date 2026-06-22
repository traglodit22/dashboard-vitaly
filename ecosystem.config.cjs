const path = require("path");

const appDir = __dirname;

/** @type {import('pm2').StartOptions[]} */
const apps = [
  {
    name: "dashboard",
    cwd: path.join(appDir, ".next/standalone"),
    script: "server.js",
    env: {
      NODE_ENV: "production",
      PORT: "3000",
      HOSTNAME: "127.0.0.1",
    },
    env_file: path.join(appDir, ".env"),
    max_memory_restart: "512M",
  },
  {
    name: "telegram-bot",
    cwd: appDir,
    script: "node_modules/.bin/tsx",
    args: "bot/index.ts",
    env: {
      NODE_ENV: "production",
    },
    env_file: path.join(appDir, ".env"),
    max_memory_restart: "256M",
  },
];

module.exports = { apps };
