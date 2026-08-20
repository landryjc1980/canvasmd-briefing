/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
