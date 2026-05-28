"use client"

import { useState, useEffect } from "react"
import { AlertTriangle, X, Siren, MapPin, Users, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Incident } from "@/lib/types"

// The hardcoded incident that this alert represents
const ALERT_INCIDENT: Incident = {
  id: "live-alert-san-pablo",
  type: "flood",
  severity: "critical",
  location: "Barrio San Pablo - Canal Norte",
  coordinates: { lat: -26.8400, lng: -65.2500 },
  affectedPeople: 720,
  timestamp: new Date(),
  source: "social",
  sourceDetails: {
    platform: "X (Twitter)",
    username: "@rescate_tucuman",
    content: "ACTUALIZACION: Canal San Pablo completamente desbordado en altura de calle Honduras. Evacuacion de 180 familias en curso. Bomberos Voluntarios y Defensa Civil trabajando. Corte total de Av. Ejercito del Norte. Eviten la zona. #AlertaTucuman",
    imageUrl: "https://images.unsplash.com/photo-1446824505046-e43605ffb17f?w=600&h=400&fit=crop",
  },
}

interface LiveAlertProps {
  onDismiss?: () => void
  onDeployEmergency?: (incident: Incident) => void
}

export function LiveAlert({ onDismiss, onDeployEmergency }: LiveAlertProps) {
  const [secondsAgo, setSecondsAgo] = useState(0)

  // Seconds counter — starts as soon as this component is mounted (parent controls visibility)
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsAgo(prev => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleDismiss = () => {
    onDismiss?.()
  }

  return (
    <div 
      className={cn(
        "fixed inset-0 z-[10000] flex items-center justify-center p-4",
        "bg-black/80 backdrop-blur-sm",
        "animate-in fade-in duration-300"
      )}
    >
      {/* Pulsing background effect */}
      <div className="absolute inset-0 bg-red-500/10 animate-pulse" />
      
      {/* Alert Card */}
      <div 
        className={cn(
          "relative w-full max-w-lg",
          "bg-gradient-to-b from-red-950 to-background",
          "border-2 border-red-500 rounded-xl shadow-2xl shadow-red-500/20",
          "animate-in zoom-in-95 duration-300"
        )}
      >
        {/* Flashing top bar */}
        <div className="absolute -top-1 left-0 right-0 h-1 bg-red-500 animate-pulse rounded-t-xl" />
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-red-500/30">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Siren className="h-8 w-8 text-red-500 animate-pulse" />
              <div className="absolute inset-0 h-8 w-8 bg-red-500 rounded-full animate-ping opacity-30" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-red-400 flex items-center gap-2">
                ALERTA EN TIEMPO REAL
                <span className="inline-flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              </h2>
              <p className="text-xs text-red-300/70">Incidente detectado hace {secondsAgo}s</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
            onClick={handleDismiss}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Alert Type */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <AlertTriangle className="h-10 w-10 text-red-500 shrink-0" />
            <div>
              <h3 className="font-bold text-foreground">DESBORDE DE CANAL NORTE</h3>
              <p className="text-sm text-muted-foreground">
                Nivel de agua critico detectado. Evacuacion inmediata requerida.
              </p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
              <MapPin className="h-5 w-5 text-red-400 mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground">Ubicacion</p>
              <p className="text-xs font-semibold">San Pablo</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
              <Users className="h-5 w-5 text-orange-400 mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground">En Riesgo</p>
              <p className="text-xs font-semibold">~720 personas</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
              <Clock className="h-5 w-5 text-yellow-400 mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground">Tiempo Est.</p>
              <p className="text-xs font-semibold">15 min</p>
            </div>
          </div>

          {/* Source */}
          <div className="p-2 rounded bg-muted/30 border border-border/50">
            <p className="text-[10px] text-muted-foreground">
              <span className="text-purple-400 font-medium">Fuente:</span> Sensor FL-CN-001 + Camara CAM-SP-012 + 12 reportes en X
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              <span className="text-purple-400 font-medium">Confianza IA:</span> 97%
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button 
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold"
              onClick={() => {
                onDeployEmergency?.(ALERT_INCIDENT)
              }}
            >
              <Siren className="h-4 w-4 mr-2" />
              DESPLEGAR EMERGENCIA
            </Button>
            <Button 
              variant="outline" 
              className="border-red-500/50 text-red-400 hover:bg-red-500/10"
              onClick={handleDismiss}
            >
              Ver en Mapa
            </Button>
          </div>
        </div>

        {/* Bottom flashing bar */}
        <div className="absolute -bottom-1 left-0 right-0 h-1 bg-red-500 animate-pulse rounded-b-xl" />
      </div>
    </div>
  )
}

// Hook to manually trigger the alert (for demo purposes)
export function useLiveAlert() {
  const [showAlert, setShowAlert] = useState(false)

  const triggerAlert = () => {
    setShowAlert(true)
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 200])
    }
  }

  const dismissAlert = () => {
    setShowAlert(false)
  }

  return { showAlert, triggerAlert, dismissAlert }
}
