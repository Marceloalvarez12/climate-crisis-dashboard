const RATE_LIMIT_WINDOW_MS = 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 200
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

const requestCounts = new Map<string, { count: number; resetAt: number }>()

let lastCleanup = Date.now()

function lazyCleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return

  lastCleanup = now
  for (const [key, value] of requestCounts.entries()) {
    if (now > value.resetAt) {
      requestCounts.delete(key)
    }
  }
}

export function checkRateLimit(identifier: string): { allowed: boolean; resetAt: number } {
  lazyCleanup()

  const now = Date.now()
  const existing = requestCounts.get(identifier)

  if (!existing || now > existing.resetAt) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS
    requestCounts.set(identifier, { count: 1, resetAt })
    return { allowed: true, resetAt }
  }

  existing.count += 1

  if (existing.count > MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, resetAt: existing.resetAt }
  }

  return { allowed: true, resetAt: existing.resetAt }
}
