// Lectura de config_sistema (tabla del schema PMV) con fallback tolerante:
// si la tabla no existe o faltan credenciales, devuelve null y el caller
// usa su default. Cache corto para no pegarle a la DB por cada ingest.
const CACHE_TTL_MS = 10_000
const cache = new Map<string, { value: unknown; at: number }>()

export async function getSystemConfig<T>(clave: string): Promise<T | null> {
  const hit = cache.get(clave)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T
  try {
    const { supabase } = await import("@/lib/supabase")
    const { data, error } = await supabase
      .from("config_sistema").select("valor").eq("clave", clave).single()
    if (error || !data) return null
    const value = data.valor as T
    cache.set(clave, { value, at: Date.now() })
    return value
  } catch {
    return null
  }
}

export async function getConfigNumber(clave: string, fallback: number): Promise<number> {
  const valor = await getSystemConfig<{ value?: number }>(clave)
  return typeof valor?.value === "number" ? valor.value : fallback
}
