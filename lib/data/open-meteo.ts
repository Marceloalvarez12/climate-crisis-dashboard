/**
 * Open-Meteo — condiciones actuales. API keyless, CC BY 4.0.
 * Cacheado en memoria 10 min (los valores cambian lento).
 * https://open-meteo.com/en/docs
 */
import type { WeatherSnapshot } from "./layers"

interface OpenMeteoCurrent {
  temperature_2m: number
  wind_speed_10m: number
  wind_direction_10m: number
  precipitation: number
  weather_code: number
}

interface OpenMeteoResponse {
  current: OpenMeteoCurrent
}

const cache = new Map<string, { at: number; data: WeatherSnapshot }>()
const TTL_MS = 10 * 60 * 1000

export async function fetchWeather(
  lat: number,
  lng: number,
  label = `${lat.toFixed(2)},${lng.toFixed(2)}`,
): Promise<WeatherSnapshot | null> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data

  const url = new URL("https://api.open-meteo.com/v1/forecast")
  url.searchParams.set("latitude", String(lat))
  url.searchParams.set("longitude", String(lng))
  url.searchParams.set(
    "current",
    "temperature_2m,wind_speed_10m,wind_direction_10m,precipitation,weather_code",
  )
  url.searchParams.set("wind_speed_unit", "kmh")
  url.searchParams.set("timezone", "auto")

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
    const json = (await res.json()) as OpenMeteoResponse
    const data: WeatherSnapshot = {
      fetchedAt: new Date(),
      location: { lat, lng, label },
      temperatureC: json.current.temperature_2m,
      windSpeedKmh: json.current.wind_speed_10m,
      windDirectionDeg: json.current.wind_direction_10m,
      precipitationMm: json.current.precipitation,
      weatherCode: json.current.weather_code,
    }
    cache.set(key, { at: Date.now(), data })
    return data
  } catch (err) {
    console.warn("[open-meteo] fetch failed:", err instanceof Error ? err.message : String(err))
    return null
  }
}
