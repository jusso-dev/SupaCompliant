import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@supacompliant/shared",
    "@supacompliant/assessment-engine",
    "@supacompliant/control-library",
    "@supacompliant/framework-mappings",
    "@supacompliant/reporting",
    "@supacompliant/database",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
