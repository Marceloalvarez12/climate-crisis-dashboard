import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (cached) return cached

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL in .env.local")
  }
  if (!supabaseServiceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local. Server-side operations require the service role key.")
  }

  cached = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
    },
  })
  return cached
}

// Lazy proxy: importing this module must not throw during build-time page-data
// collection when env vars are absent. The error only fires on actual use.
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getClient() as unknown as Record<PropertyKey, unknown>
    const value = client[prop]
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(client) : value
  },
})
