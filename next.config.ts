import type { NextConfig } from "next";

// Origins the browser may contact. The Supabase project origin is added from the public
// environment variable so self-hosted or custom Supabase domains keep working.
function supabaseOrigin(): string | null {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function contentSecurityPolicy(): string {
  const isDevelopment = process.env.NODE_ENV === "development";
  const supabase = supabaseOrigin();
  const supabaseHttp = supabase ? [supabase] : [];
  const supabaseWs = supabase ? [supabase.replace(/^http/, "ws")] : [];
  const directives: Array<[string, string[]]> = [
    ["default-src", ["'self'"]],
    ["script-src", ["'self'", "'unsafe-inline'", ...(isDevelopment ? ["'unsafe-eval'"] : [])]],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", "blob:", "https://*.supabase.co", ...supabaseHttp]],
    ["font-src", ["'self'", "data:"]],
    [
      "connect-src",
      ["'self'", "https://*.supabase.co", "wss://*.supabase.co", ...supabaseHttp, ...supabaseWs],
    ],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
  ];
  return directives
    .map(([name, sources]) => [name, ...Array.from(new Set(sources))].join(" "))
    .join("; ");
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera is allowed for the profile photo capture; everything else is disabled.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async rewrites() {
    // Browsers request /favicon.ico by default. The app icon is served as /icon.svg.
    return {
      afterFiles: [{ source: "/favicon.ico", destination: "/icon.svg" }],
    };
  },
};

export default nextConfig;
