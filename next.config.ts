import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker builds set NEXT_OUTPUT_STANDALONE=1. Local `npm start` keeps the
  // regular output, so it does not print the "next start" standalone warning.
  output: process.env.NEXT_OUTPUT_STANDALONE === "1" ? "standalone" : undefined,
  // PGlite ships wasm + fs assets; keep it external to the server bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingIncludes: {
    // Next does not always see files that PGlite loads at runtime via fs.
    // Without these the standalone server crashes with "pglite.wasm not found".
    "/*": ["./node_modules/@electric-sql/pglite/dist/**/*"],
  },
  outputFileTracingExcludes: {
    // Never bake a local database or secrets into the standalone bundle.
    "/*": ["./.data/**/*", "./.env", "./.env.*"],
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  experimental: {
    serverActions: {
      // Gallery uploads accept an "after" and a "before" photo (5 MB each).
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
