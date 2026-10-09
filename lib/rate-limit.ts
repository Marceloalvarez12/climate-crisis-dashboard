import { CONFIG } from "@/lib/config"

const limits = CONFIG.RATE_LIMIT

export interface RateLimitResult {
  allowed: boolean
  resetAt: number
  remaining: number
  backend: "memory" | "redis"
}

export class RateLimitUnavailableError extends Error {
  constructor() {
    super("RATE_LIMIT_UNAVAILABLE")
    this.name = "RateLimitUnavailableError"
  }
}

interface RateLimiterOptions {
  redisUrl?: string
  redisToken?: string
  requireDistributed?: boolean
  prefix?: string
  fetch?: typeof fetch
  now?: () => number
}

// INCR and expiry must execute together, even when several instances race.
const COUNTER_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if count == 1 or ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {count, ttl}
`

export function createRateLimiter(options: RateLimiterOptions = {}) {
  const counts = new Map<string, { count: number; resetAt: number }>()
  const now = options.now ?? Date.now
  const request = options.fetch ?? fetch
  let lastCleanup = now()

  return async function check(identifier: string, maxRequests: number = limits.MAX_REQUESTS, windowMs: number = limits.WINDOW_MS): Promise<RateLimitResult> {
    if (!identifier || !Number.isSafeInteger(maxRequests) || maxRequests < 1 || !Number.isSafeInteger(windowMs) || windowMs < 1) throw new Error("Parámetros de rate limit inválidos")
    const time = now()
    if (options.redisUrl || options.redisToken || options.requireDistributed) {
      // Do not replace the shared quota with a fresh local counter on outages.
      if (!options.redisUrl || !options.redisToken) throw new RateLimitUnavailableError()
      try {
        const url = new URL(options.redisUrl)
        if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new RateLimitUnavailableError()
        const hashed = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identifier))
        const keyHash = Array.from(new Uint8Array(hashed), b => b.toString(16).padStart(2, "0")).join("")
        const key = `${options.prefix ?? "zntinel"}:rate-limit:${maxRequests}:${windowMs}:${keyHash}`
        const response = await request(url.toString(), {
          method: "POST",
          headers: { Authorization: `Bearer ${options.redisToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(["EVAL", COUNTER_SCRIPT, 1, key, windowMs]),
          cache: "no-store",
          signal: AbortSignal.timeout(limits.REDIS_TIMEOUT_MS),
        })
        if (!response.ok) throw new RateLimitUnavailableError()
        const body: unknown = await response.json()
        const result = body && typeof body === "object" && "result" in body ? body.result : null
        if (!Array.isArray(result) || result.length !== 2 || !Number.isSafeInteger(result[0]) || result[0] < 1 || !Number.isSafeInteger(result[1]) || result[1] < 0 || result[1] > windowMs) throw new RateLimitUnavailableError()
        return { allowed: result[0] <= maxRequests, resetAt: now() + result[1], remaining: Math.max(0, maxRequests - result[0]), backend: "redis" }
      } catch {
        throw new RateLimitUnavailableError()
      }
    }
    if (time - lastCleanup >= limits.CLEANUP_INTERVAL_MS || counts.size >= limits.MAX_LOCAL_IDENTIFIERS) {
      lastCleanup = time
      for (const [key, value] of counts) if (time >= value.resetAt) counts.delete(key)
    }
    const localKey = `${maxRequests}:${windowMs}:${identifier}`
    const existing = counts.get(localKey)
    if (!existing || time >= existing.resetAt) {
      if (!existing && counts.size >= limits.MAX_LOCAL_IDENTIFIERS) throw new RateLimitUnavailableError()
      const resetAt = time + windowMs
      counts.set(localKey, { count: 1, resetAt })
      return { allowed: true, resetAt, remaining: maxRequests - 1, backend: "memory" }
    }
    existing.count = Math.min(existing.count + 1, maxRequests + 1)
    return { allowed: existing.count <= maxRequests, resetAt: existing.resetAt, remaining: Math.max(0, maxRequests - existing.count), backend: "memory" }
  }
}

export const checkRateLimit = createRateLimiter({
  redisUrl: process.env.UPSTASH_REDIS_REST_URL,
  redisToken: process.env.UPSTASH_REDIS_REST_TOKEN,
  prefix: process.env.RATE_LIMIT_PREFIX,
  requireDistributed: process.env.RATE_LIMIT_REQUIRE_DISTRIBUTED === "true",
})
