import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist", "@google-cloud/storage"],
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
