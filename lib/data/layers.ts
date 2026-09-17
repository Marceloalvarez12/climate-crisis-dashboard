/**
 * Tipos compartidos por las capas live (USGS, Open-Meteo).
 */

export interface CameraSource {
  id: string
  kind: "surveillance" | "speed_camera"
  coordinates: { lat: number; lng: number }
  name: string
  operator: string | null
  direction: string | null
  url: string | null
}

export interface Earthquake {
  id: string
  magnitude: number
  place: string
  coordinates: { lat: number; lng: number; depthKm: number }
  occurredAt: Date
  url: string
}

export interface WeatherSnapshot {
  fetchedAt: Date
  location: { lat: number; lng: number; label: string }
  temperatureC: number
  windSpeedKmh: number
  windDirectionDeg: number
  precipitationMm: number
  weatherCode: number
}
