/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@convex-dev/auth", "is-network-error"],
  experimental: {
    esmExternals: "loose",
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud",
              "img-src 'self' data: blob:",
            ].join("; "),
          },
          // ── HTTPS enforcement ──────────────────────────────────────
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // ── Prevent clickjacking ───────────────────────────────────
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // ── Prevent MIME-type sniffing ─────────────────────────────
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // ── Control referrer information ───────────────────────────
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // ── Restrict browser features ─────────────────────────────
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
