const DAILY_LIMIT = 5
const WINDOW_MS = 24 * 60 * 60 * 1000

const hits = new Map<string, number[]>()

export function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  if (process.env.NODE_ENV !== "production") {
    return { allowed: true, remaining: DAILY_LIMIT }
  }

  const now = Date.now()
  const timestamps = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS)

  if (timestamps.length >= DAILY_LIMIT) {
    hits.set(key, timestamps)
    return { allowed: false, remaining: 0 }
  }

  timestamps.push(now)
  hits.set(key, timestamps)
  return { allowed: true, remaining: DAILY_LIMIT - timestamps.length }
}
