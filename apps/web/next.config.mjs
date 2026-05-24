/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The engine is consumed straight from TypeScript source in the workspace.
  transpilePackages: ["@chroma/engine", "@chroma/agent"],
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
