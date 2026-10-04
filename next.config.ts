import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vendor workbook uploads go through a server action; allow files up to the 10 MB import limit.
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
};

export default nextConfig;
