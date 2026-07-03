import { useState, useEffect, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// TypeScript Interfaces
// ---------------------------------------------------------------------------

export type SimulatorIncidentType = "flood" | "fire" | "storm" | "looting" | "violence" | "accident" | "general";

export interface SimulatorLocation {
  id: string; // Identificador único para manejar la concurrencia
  nombre: string;
  lat: number;
  lng: number;
}

export interface SimulatorIncident {
  id: string;
  type: SimulatorIncidentType;
  locationId: string;
  locationName: string;
  lat: number;
  lng: number;
  timestamp: Date;
  status: "active" | "resolved";
}

interface SimulatorOptions {
  intervalMs?: number;    // Frecuencia de generación en ms
  maxActive?: number;     // Límite máximo de incidentes activos concurrentes
  autoResolveMs?: number; // Tiempo de vida antes de auto-resolverse
}

// ---------------------------------------------------------------------------
// Constants & Mock Data
// ---------------------------------------------------------------------------

const INCIDENT_TYPES: SimulatorIncidentType[] = [
  "flood", "fire", "storm", "looting", "violence", "accident", "general"
];

const LOCATIONS_POOL: SimulatorLocation[] = [
  { id: "loc_1", lat: -26.8305, lng: -65.2038, nombre: "Plaza Independencia - Centro Histórico" },
  { id: "loc_2", lat: -26.8214, lng: -65.2028, nombre: "Plaza Urquiza - Barrio Norte" },
  { id: "loc_3", lat: -26.8398, lng: -65.2088, nombre: "Plaza San Martín - Barrio Sur" },
  { id: "loc_4", lat: -26.8288, lng: -65.1912, nombre: "Parque 9 de Julio - Av. Soldati" },
  { id: "loc_5", lat: -26.8159, lng: -65.2153, nombre: "Plazoleta Mitre - Av. Belgrano y Mitre" },
  { id: "loc_6", lat: -26.8188, lng: -65.2346, nombre: "Av. Ejército del Norte y Mendoza" },
  { id: "loc_7", lat: -26.8261, lng: -65.2239, nombre: "Parque Avellaneda - Av. Mate de Luna" },
  { id: "loc_8", lat: -26.8366, lng: -65.1954, nombre: "Terminal de Ómnibus - Av. Brígido Terán" },
  { id: "loc_9", lat: -26.8001, lng: -65.2014, nombre: "Av. Fco. de Aguirre y Juan B. Justo" },
  { id: "loc_10", lat: -26.8453, lng: -65.2198, nombre: "Av. Roca y Lincoln - Zona Sur" }
];

// ---------------------------------------------------------------------------
// Custom Hook
// ---------------------------------------------------------------------------

/**
 * Hook para simular la aparición de incidentes en tiempo real.
 * Garantiza que no existan incidentes concurrentes en la misma ubicación.
 */
export function useIncidentSimulator({ 
  intervalMs = 5000, 
  maxActive = 10,
  autoResolveMs = 60 * 60 * 1000 // 60 minutos por defecto
}: SimulatorOptions = {}) {
  // Estado para renderizar los incidentes activos en la UI
  const [activeIncidents, setActiveIncidents] = useState<SimulatorIncident[]>([]);

  // REF: Guardamos las ubicaciones ocupadas de forma sincrónica.
  // Evitamos depender del estado (async) dentro del closure del timer para la regla de concurrencia.
  const occupiedLocationsRef = useRef<Set<string>>(new Set());

  // ── Función para resolver un incidente ────────────────────────────────────
  const resolveIncident = useCallback((incidentId: string) => {
    setActiveIncidents((prev) => {
      const incidentToResolve = prev.find(inc => inc.id === incidentId);
      if (incidentToResolve) {
        // Al resolverlo, liberamos inmediatamente la ubicación
        occupiedLocationsRef.current.delete(incidentToResolve.locationId);
      }
      return prev.filter(inc => inc.id !== incidentId);
    });
  }, []);

  // ── Loop Principal de Simulación ──────────────────────────────────────────
  useEffect(() => {
    const generateIncident = () => {
      setActiveIncidents((currentActive) => {
        // Límite de incidentes activos
        if (currentActive.length >= maxActive) {
          return currentActive;
        }

        // Filtramos solo las ubicaciones que están "libres" (Regla Crítica de Bloqueo)
        const availableLocations = LOCATIONS_POOL.filter(
          (loc) => !occupiedLocationsRef.current.has(loc.id)
        );

        // Si todas las ubicaciones están ocupadas, cancelamos el ciclo
        if (availableLocations.length === 0) {
          return currentActive;
        }

        // Seleccionamos ubicación aleatoria disponible
        const randomLocIndex = Math.floor(Math.random() * availableLocations.length);
        const selectedLocation = availableLocations[randomLocIndex];

        // Seleccionamos un tipo de incidente aleatorio
        const randomTypeIndex = Math.floor(Math.random() * INCIDENT_TYPES.length);
        const selectedType = INCIDENT_TYPES[randomTypeIndex];

        // Construimos el objeto
        const newIncident: SimulatorIncident = {
          id: `inc_${crypto.randomUUID()}`,
          type: selectedType,
          locationId: selectedLocation.id,
          locationName: selectedLocation.nombre,
          lat: selectedLocation.lat,
          lng: selectedLocation.lng,
          timestamp: new Date(),
          status: "active",
        };

        // Marcamos la ubicación como ocupada de inmediato en el Ref
        occupiedLocationsRef.current.add(selectedLocation.id);

        return [...currentActive, newIncident];
      });
    };

    // Iniciamos el timer
    const intervalId = setInterval(generateIncident, intervalMs);

    // Cleanup: limpiamos el timer cuando el hook se desmonta
    return () => clearInterval(intervalId);
  }, [intervalMs, maxActive]);

  // ── Auto-resolve loop para limpiar incidentes viejos ──────────────────────
  useEffect(() => {
    if (!autoResolveMs) return;

    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setActiveIncidents((currentActive) => {
        const remaining = currentActive.filter((inc) => {
          const age = now - inc.timestamp.getTime();
          if (age > autoResolveMs) {
            // Liberamos la ubicación sincrónicamente si expira
            occupiedLocationsRef.current.delete(inc.locationId);
            return false;
          }
          return true;
        });
        return remaining;
      });
    }, Math.min(10000, autoResolveMs / 2)); // Revisamos cada 10s o menos

    return () => clearInterval(cleanupInterval);
  }, [autoResolveMs]);

  return {
    activeIncidents,
    resolveIncident,
  };
}

// Re-export the location pool so non-hook consumers (e.g. the citizen
// report form) can derive a randomized bounding-box location without
// pulling in the React state machine from this module.
export const TUCUMAN_LOCATIONS_POOL: SimulatorLocation[] = LOCATIONS_POOL
