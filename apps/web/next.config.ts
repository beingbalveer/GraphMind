import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@graphmind/shared", "@xyflow/react"],
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
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8300";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;

