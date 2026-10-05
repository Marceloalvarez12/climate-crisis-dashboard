/**
 * lib/agents/geo.ts
 *
 * Utilidades geográficas compartidas por los conectores de APIs reales
 * (USGS, NASA EONET) para filtrar eventos a la región de Tucumán/Argentina.
 */

import { CONFIG } from "@/lib/config"

/** Distancia entre dos puntos en km (Haversine). */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Distancia en km desde el centro operativo del dashboard (San Miguel de Tucumán). */
export function distanceFromTucuman(lat: number, lng: number): number {
  return distanceKm(lat, lng, CONFIG.INCIDENTS.DEFAULT_COORDS.lat, CONFIG.INCIDENTS.DEFAULT_COORDS.lng)
}

export interface LatLngBox {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

export function insideBox(lat: number, lng: number, box: LatLngBox): boolean {
  return lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng
}
