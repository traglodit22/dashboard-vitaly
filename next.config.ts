import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Жёстко фиксируем корень проекта — иначе Turbopack цепляет
  // посторонний /Users/art/package-lock.json как workspace root.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
