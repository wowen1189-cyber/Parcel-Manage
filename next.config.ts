import type { NextConfig } from "next";

// Cache Components is off: almost every screen is private to a signed-in user and
// renders per request, so the static-shell rules would add work without speeding anything up.
const nextConfig: NextConfig = {
  // Company subdomains in local development (simreipm.localhost:3000) need the dev server's scripts too.
  allowedDevOrigins: ["*.localhost"],
  // Browser security headers on every page: no framing (clickjacking), no MIME sniffing, HTTPS only,
  // and no camera/microphone/location access unless a page asks for it.
  headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
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
