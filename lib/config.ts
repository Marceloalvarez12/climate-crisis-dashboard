export const CONFIG = {
  INCIDENTS: {
    MAX_ACTIVE: 11,
    MAX_HISTORY: 100,
    AI_DECAY_SECONDS: 3600,
    DISPATCH_LEASE_SECONDS: 604800,
    DEFAULT_COORDS: { lat: -26.8241, lng: -65.2226 },
  },
  AI: {
    MIN_CONFIDENCE_TO_PERSIST: 60,
    MODEL: "gemini-2.0-flash",
    BATCH_SIZE: 5,
  },
  ARKIV: {
    CHAIN: "braga",
    EXPLORER_URL: "https://explorer.braga.hoodi.arkiv.network/entity",
    SIMULATED_KEY_PREFIX: "0xSimulated",
  },
  STELLAR: {
    NETWORK: process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet",
    HORIZON_URL: process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org",
    SOROBAN_RPC_URL: process.env.NEXT_PUBLIC_STELLAR_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org",
    EXPLORER_URL: "https://stellar.expert/explorer/testnet",
    VERIFIER_CONTRACT_ID: process.env.NEXT_PUBLIC_STELLAR_VERIFIER_CONTRACT_ID || "CAMZ5UVX7HY5XP53VUXS64QXXHXCTBMYFU7QMGWMCDDQRYJQBFBVLJGD",
    SIMULATED_KEY_PREFIX: "SIMULATED",
  },
  SOCIAL: {
    TRIGGER_HASHTAG: process.env.NEXT_PUBLIC_TRIGGER_HASHTAG || "#AlertaTucuman",
    MAX_POST_LENGTH: 2200,
    CORROBORATION_CONFIDENCE_BOOST: 5,
    SIMULATED_HASHTAG_PROBABILITY: 0.65,
  },
  EXTERNAL: {
    TIMEOUT_MS: 12_000,
    USGS: {
      // Feed mensual M4.5+ — el diario casi nunca cubre el interior argentino
      FEED_URL:       "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson",
      MIN_MAGNITUDE:  4.5,
      RADIUS_KM:      800,
    },
    EONET: {
      FEED_URL: "https://eonet.gsfc.nasa.gov/api/v3/events",
      // Bounding box de Argentina continental
      BBOX: { minLat: -55.5, maxLat: -21.5, minLng: -73.8, maxLng: -53.0 },
    },
  },
  SEARCH_KEYWORDS: [
    "inundacion", "inundación", "desborde", "crecida", "canal",
    "incendio", "fuego", "quema", "humo", "bomberos",
    "tormenta", "granizo", "tornado", "viento", "lluvia torrencial",
    "sismo", "temblor", "terremoto",
    "emergencia", "evacuacion", "evacuación", "alerta", "defensa civil",
    "rescate", "víctimas", "heridos",
    "AlertaTucuman", "TucumanAlerta", "TucumanEmergencia",
  ],
} as const

export type Config = typeof CONFIG
