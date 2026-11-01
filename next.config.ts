import type { NextConfig } from "next";

// Cache Components is off: almost every screen is private to a signed-in user and
// renders per request, so the static-shell rules would add work without speeding anything up.
const nextConfig: NextConfig = {
  // Company subdomains in local development (simreipm.localhost:3000) need the dev server's scripts too.
  allowedDevOrigins: ["*.localhost"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
