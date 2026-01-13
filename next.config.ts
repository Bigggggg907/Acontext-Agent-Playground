import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use the default caching behavior. The experimental `cacheComponents`
  // mode is disabled to avoid conflicts with dynamic server-side auth
  // (e.g. Supabase `createClient()` in route segments like `/protected`).
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "acontext.io",
      },
    ],
  },
};

export default nextConfig;
