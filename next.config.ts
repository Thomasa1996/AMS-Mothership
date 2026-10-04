import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vendor workbook uploads go through a server action; allow files up to the 10 MB import limit.
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
  // Warehouses moved from its own top tab to Sales; keep old links working.
  async redirects() {
    return [{ source: "/warehouse/:path*", destination: "/sales/warehouses/:path*", permanent: true }];
  },
};

export default nextConfig;
