import type { NextConfig } from "next";

// Money Magnet (Bronson's dialer) is its own Vercel project with basePath /money-bronson.
// These rewrites serve it at koconsultings.com/money-bronson (pages, API and its /_next assets).
const MONEY_MAGNET = "https://the-money-magnet.vercel.app";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/money-bronson", destination: `${MONEY_MAGNET}/money-bronson` },
      { source: "/money-bronson/:path+", destination: `${MONEY_MAGNET}/money-bronson/:path+` },
    ];
  },
};

export default nextConfig;
