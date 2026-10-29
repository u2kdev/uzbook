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
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "t.me" },
      { protocol: "https", hostname: "*.telegram.org" },
    ],
  },
  experimental: {
    serverActions: {
      // Gallery uploads accept an "after" and a "before" photo (5 MB each).
      bodySizeLimit: "12mb",
    },
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://unpkg.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.telegram.org",
      "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org",
      "form-action 'self' https://checkout.paycom.uz https://my.click.uz",
      "base-uri 'self'",
      "object-src 'none'",
    ].join("; ");

    return [
      {
        source: "/b/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        source: "/pay/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: csp,
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
