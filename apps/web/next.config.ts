import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@graphmind/shared"],
  reactStrictMode: true,
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

