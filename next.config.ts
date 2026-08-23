import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/**
 * Content Security Policy.
 *
 * Next.js inlines a bootstrap script and Tailwind emits inline styles, so
 * 'unsafe-inline' is required for script-src and style-src until a nonce-based
 * setup is in place. Everything else is locked down.
 *
 * `frame-ancestors 'none'` is the one that matters most here: the dashboard has
 * approve and reject buttons, and without it those are clickjackable.
 */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Two years, subdomains included. Only meaningful over HTTPS, which the
  // production deployment is.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // API responses are per-caller and must never be cached by a shared
        // proxy. A cached decision served to the wrong tenant is a data leak.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "Vary", value: "Authorization, Cookie" },
        ],
      },
    ];
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
