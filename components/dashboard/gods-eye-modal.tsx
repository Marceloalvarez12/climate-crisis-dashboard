"use client"

import { useState, useRef } from "react"
import dynamic from "next/dynamic"
import { X, Globe2, Eye, Cloud, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useEarthquakes, useWeather } from "@/hooks/use-live-layers"
import type { VisualMode } from "@/lib/map/visual-modes"
import { VISUAL_MODES } from "@/lib/map/visual-modes"
import type { Incident } from "@/lib/types"

const CesiumGlobe = dynamic(
  () => import("./crisis-map/cesium-globe").then((m) => m.CesiumGlobe),
  { ssr: false },
)

const GlobeHud = dynamic(
  () => import("./crisis-map/globe-hud").then((m) => m.GlobeHud),
  { ssr: false },
)

interface GodsEyeModalProps {
  incidents: Incident[]
  open: boolean
  onClose: () => void
  onSelectIncident: (incident: Incident) => void
}

export function GodsEyeModal({ incidents, open, onClose, onSelectIncident }: GodsEyeModalProps) {
  const [visualMode, setVisualMode] = useState<VisualMode>("satellite")
  const [showEarthquakes, setShowEarthquakes] = useState(true)
  const [showWeather, setShowWeather] = useState(true)
  const [cesiumViewer, setCesiumViewer] = useState<import("cesium").Viewer | null>(null)

  const { earthquakes } = useEarthquakes(showEarthquakes)
  const { weather } = useWeather(showWeather, -26.8241, -65.2226, "San Miguel de Tucumán")

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#0a0c10]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card/80 px-3 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Globe2 className="h-4 w-4 text-primary" />
          <h2 className="text-xs font-semibold">God&apos;s Eye View — Tucumán</h2>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Visual mode */}
          <div className="flex gap-1">
            {VISUAL_MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => {
                  setVisualMode(mode.id)
                  if (cesiumViewer && !cesiumViewer.isDestroyed()) {
                    // @ts-expect-error — Cesium es global tras carga dinámica
                    const Cesium = window.Cesium
                    if (!Cesium) return
                    cesiumViewer.imageryLayers.removeAll()
                    const provider = new Cesium.UrlTemplateImageryProvider({
                      url: mode.url,
                      maximumLevel: 19,
                      credit: new Cesium.Credit(mode.credit),
                    })
                    cesiumViewer.imageryLayers.addImageryProvider(provider)
                  }
                }}
                className={cn(
                  "rounded px-2 py-1 text-[10px] font-medium transition-colors",
                  visualMode === mode.id
                    ? "bg-primary/20 text-primary"
                    : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <Button
            variant={showEarthquakes ? "default" : "outline"}
            size="sm"
            className="h-6 gap-1 px-2 text-[10px]"
            onClick={() => setShowEarthquakes((s) => !s)}
          >
            <Activity className="h-3 w-3" />
            Sismos
          </Button>
          <Button
            variant={showWeather ? "default" : "outline"}
            size="sm"
            className="h-6 gap-1 px-2 text-[10px]"
            onClick={() => setShowWeather((s) => !s)}
          >
            <Cloud className="h-3 w-3" />
            Clima
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Cesium */}
      <div className="relative flex-1">
        <CesiumGlobe
          incidents={incidents}
          earthquakes={showEarthquakes ? earthquakes : []}
          weather={weather}
          showEarthquakes={showEarthquakes}
          showWeather={showWeather}
          visualMode={visualMode}
          selectedId={null}
          onSelect={onSelectIncident}
          onViewerReady={(viewer) => setCesiumViewer(viewer)}
        />
        <GlobeHud visualMode={visualMode} viewer={cesiumViewer ?? null} />
      </div>
    </div>
  )
}
