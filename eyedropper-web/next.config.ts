import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp loads its libvips shared library (libvips-cpp.so) via a runtime
  // dlopen that @vercel/nft cannot trace statically, so the .so is left out
  // of the serverless bundle and fails to load on Vercel. Force-include the
  // sharp packages for the routes that use it.
  outputFileTracingIncludes: {
    "/api/suggest": ["./node_modules/@img/**/*", "./node_modules/sharp/**/*"],
    "/api/export": ["./node_modules/@img/**/*", "./node_modules/sharp/**/*"],
  },
};

export default nextConfig;
