/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Apple App Site Association: lets briefing.canvasmd.io/r/<slug> open the CanvasMD app
  // when it is installed. Apple requires application/json, HTTPS and no redirect.
  async headers() {
    return [{
      source: "/.well-known/apple-app-site-association",
      headers: [{ key: "Content-Type", value: "application/json" }, { key: "Cache-Control", value: "public, max-age=3600" }],
    }];
  },
  experimental: {
    // The root layout inlines a self-hosted font by readFileSync(public/fonts/…). Static
    // pages read it at build; the force-dynamic /r/[slug] post pages read it at request time
    // inside the serverless function, so the font must be TRACED into that function's bundle.
    outputFileTracingIncludes: {
      "/r/[slug]": ["./public/fonts/**"],
    },
  },
};

module.exports = nextConfig;
