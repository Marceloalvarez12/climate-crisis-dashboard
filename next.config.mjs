/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["snarkjs"],
  outputFileTracingIncludes: {
    "/api/incidentes/zk-report": ["./zk/build/**/*"],
    "/api/incidentes/zk-verify": ["./zk/build/**/*"],
    "/api/stellar/*": ["./zk/build/verification_key.json"],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
