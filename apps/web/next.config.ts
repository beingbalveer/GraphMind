import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@graphmind/shared", "@xyflow/react"],
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
  async redirects() {
    return [
      // Legacy /graph/{id} → /w/{id}
      {
        source: "/graph/:workspaceId",
        destination: "/w/:workspaceId",
        permanent: true,
      },
      // Legacy /workspace/{id} → /w/{id}
      {
        source: "/workspace/:workspaceId",
        destination: "/w/:workspaceId",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

