const path = require("path");

const appDir = __dirname;

/** @type {import('pm2').StartOptions[]} */
module.exports = {
  apps: [
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
  ],
};
