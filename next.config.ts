import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Projektordner explizit als Turbopack-Root festlegen. Ohne diese Angabe
  // rät Next.js den Root anhand gefundener Lockfiles und wählt bei einer
  // fremden package-lock.json im übergeordneten Verzeichnis den falschen.
  turbopack: { root: path.join(__dirname) },
  serverExternalPackages: ["@prisma/client", "prisma"],
  images: { unoptimized: true },
};

export default nextConfig;
