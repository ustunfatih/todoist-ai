import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Lazy singleton — only created on first use so the build succeeds without env vars
let _client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_ANON_KEY
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set to use Supabase features.')
    }
    _client = createClient(url, key)
  }
  return _client
}

/** Legacy named export kept for compatibility with existing imports. */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return getSupabaseClient()[prop as keyof SupabaseClient]
  },
})
