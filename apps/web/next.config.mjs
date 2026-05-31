/** @type {import('next').NextConfig} */

// Static export (GitHub Pages / any static host) is opt-in via STATIC_EXPORT=1.
// Server builds (`pnpm dev`, self-hosting with the /api/agent route) are the
// default and behave exactly as before.
const isStaticExport = process.env.STATIC_EXPORT === "1";

// GitHub *project* pages are served from a subpath, e.g.
// https://<user>.github.io/cook-look/ — so assets and links need that prefix.
// Override with BASE_PATH="" for a user/org page or a custom domain.
const basePath = isStaticExport
  ? process.env.BASE_PATH ?? "/cook-look"
  : "";

const nextConfig = {
  reactStrictMode: true,
  // The engine is consumed straight from TypeScript source in the workspace.
  transpilePackages: ["@chroma/engine", "@chroma/agent"],
  ...(isStaticExport
    ? {
        output: "export",
        basePath,
        assetPrefix: basePath || undefined,
        // No server means no on-demand image optimization.
        images: { unoptimized: true },
        // Emit folder-style URLs so paths resolve cleanly on static hosts.
        trailingSlash: true,
      }
    : {}),
  webpack: (config) => {
    // The engine uses Node-ESM-style ".js" import specifiers that resolve to
    // ".ts" source. Teach webpack the same mapping tsc/vitest already use.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
