import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ['ssh2', 'node-ssh'],
};

export default nextConfig;
