const RATE_LIMIT_WINDOW_MS = 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 200

const requestCounts = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(identifier: string): { allowed: boolean; resetAt: number } {
  const now = Date.now()
  const existing = requestCounts.get(identifier)

  if (!existing || now > existing.resetAt) {
    requestCounts.set(identifier, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    })
    return { allowed: true, resetAt: now + RATE_LIMIT_WINDOW_MS }
  }

  existing.count += 1

  if (existing.count > MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, resetAt: existing.resetAt }
  }

  return { allowed: true, resetAt: existing.resetAt }
}

export function cleanupExpiredLimits() {
  const now = Date.now()
  for (const [key, value] of requestCounts.entries()) {
    if (now > value.resetAt) {
      requestCounts.delete(key)
    }
  }
}

setInterval(cleanupExpiredLimits, 5 * 60 * 1000)
