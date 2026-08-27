import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure Turbopack uses this directory as the workspace root so env loads from web/.env.local
  turbopack: {
    // Use the directory of this next.config.ts as the root
    root: __dirname,
  },
  eslint: {
    // Ignore ESLint errors during builds (CI/production).
    // This unblocks builds while we iteratively fix lint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Type errors fail the build (re-enabled after fixing legacy errors)
    ignoreBuildErrors: false,
  },
  // Disable typed routes to avoid symlink issues with OneDrive
  typedRoutes: false,
  // No rewrites for favicon — Next will serve from app/icon.* automatically
};

export default nextConfig;
