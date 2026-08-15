import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Vitals and dose marks are written from the phone; keep payloads small.
    serverActions: { bodySizeLimit: "1mb" },
  },
};

export default nextConfig;
