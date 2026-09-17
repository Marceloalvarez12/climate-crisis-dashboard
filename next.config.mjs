/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Cesium se carga en cliente vía dynamic import ssr:false.
  // Evitar que Turbopack procese la librería (~3MB de workers/widgets)
  serverExternalPackages: ["cesium"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.openstreetmap.org https://*.tile.opentopomap.org https://tiles.stadiamaps.com https://*.basemaps.cartocdn.com https://*.cartocdn.com https://server.arcgisonline.com https://services.arcgisonline.com https://*.googleapis.com https://*.gstatic.com https://images.unsplash.com",
              "font-src 'self' https://*.gstatic.com",
              "connect-src 'self' blob: https://*.supabase.co https://*.googleapis.com https://*.arcgisonline.com https://server.arcgisonline.com https://services.arcgisonline.com https://*.cesium.com https://earthquake.usgs.gov https://api.open-meteo.com https://overpass-api.de https://overpass.kumi.systems https://nominatim.openstreetmap.org https://unpkg.com https://*.cartocdn.com https://*.basemaps.cartocdn.com",
              "worker-src 'self' blob:",
              "frame-src 'self'",
              "media-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
    ]
  },
}

export default nextConfig
