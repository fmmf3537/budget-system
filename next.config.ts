import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: '/home/ubuntu/budget-system',
  },
  allowedDevOrigins: ['118.24.143.172', '118.24.143.172:3000'],
};

export default nextConfig;
