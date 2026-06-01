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
