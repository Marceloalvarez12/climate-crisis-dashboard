"use client"

import { useEffect, useState } from "react"
import { Crosshair, Satellite, MapPin, Camera } from "lucide-react"
import type { ZntinelViewer } from "@/lib/map/create-cesium-viewer"
import { getVisualMode, type VisualMode } from "@/lib/map/visual-modes"

interface GlobeHudProps {
  viewer: ZntinelViewer | null
  visualMode: VisualMode
}

interface CameraReadout {
  lngDeg: number
  latDeg: number
  heightM: number
  pitchDeg: number
  headingDeg: number
}

function formatCoord(deg: number, isLat: boolean): string {
  const abs = Math.abs(deg)
  const dir = isLat ? (deg >= 0 ? "N" : "S") : deg >= 0 ? "E" : "W"
  const d = Math.floor(abs)
  const mFloat = (abs - d) * 60
  const m = Math.floor(mFloat)
  const s = ((mFloat - m) * 60).toFixed(1)
  return `${d}°${m.toString().padStart(2, "0")}'${s.padStart(4, "0")}"${dir}`
}

export function GlobeHud({ viewer, visualMode }: GlobeHudProps) {
  const [camera, setCamera] = useState<CameraReadout | null>(null)
  const [cursor, setCursor] = useState<{ lngDeg: number; latDeg: number } | null>(null)

  useEffect(() => {
    if (!viewer) return

    let raf = 0
    const Cesium = (viewer.scene.camera as unknown as {
      constructor: { prototype: { positionCartographic: unknown } }
    }).constructor
    void Cesium

    const tick = () => {
      const cam = viewer.scene.camera
      const carto = cam.positionCartographic as {
        longitude: number
        latitude: number
        height: number
      }
      const CesiumNS = (cam as unknown as { constructor: CesiumNSLike }).constructor
      setCamera({
        lngDeg: CesiumNS.Math.toDegrees(carto.longitude),
        latDeg: CesiumNS.Math.toDegrees(carto.latitude),
        heightM: carto.height,
        pitchDeg: CesiumNS.Math.toDegrees(cam.pitch),
        headingDeg: CesiumNS.Math.toDegrees(cam.heading),
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [viewer])

  useEffect(() => {
    if (!viewer) return
    const canvas = viewer.scene.canvas

    const handler = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const ray = viewer.camera.getPickRay({ x, y } as never)
      if (!ray) {
        setCursor(null)
        return
      }
      const target = (
        viewer as unknown as {
          scene: { globe: { pick: (r: unknown, m: unknown) => unknown } }
        }
      ).scene.globe.pick(ray, viewer.scene)
      if (!target) {
        setCursor(null)
        return
      }
      const CesiumNS = (viewer.scene.camera as unknown as { constructor: CesiumNSLike })
        .constructor
      const carto = CesiumNS.Cartographic.fromCartesian(target)
      setCursor({
        lngDeg: CesiumNS.Math.toDegrees(carto.longitude),
        latDeg: CesiumNS.Math.toDegrees(carto.latitude),
      })
    }
    const leave = () => setCursor(null)
    canvas.addEventListener("mousemove", handler)
    canvas.addEventListener("mouseleave", leave)
    return () => {
      canvas.removeEventListener("mousemove", handler)
      canvas.removeEventListener("mouseleave", leave)
    }
  }, [viewer])

  const mode = getVisualMode(visualMode)

  return (
    <>
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-col gap-1.5">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded border border-border bg-card/85 px-2 py-1 backdrop-blur-sm">
          <Satellite className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-medium text-foreground">{mode.label}</span>
          <span className="text-[9px] text-muted-foreground">{mode.description}</span>
        </div>
        {camera && (
          <div className="flex items-center gap-1.5 rounded border border-border bg-card/85 px-2 py-1 font-mono text-[10px] text-foreground backdrop-blur-sm">
            <Camera className="h-3 w-3 text-muted-foreground" />
            <span>{formatCoord(camera.latDeg, true)}</span>
            <span className="text-muted-foreground">·</span>
            <span>{formatCoord(camera.lngDeg, false)}</span>
            <span className="text-muted-foreground">·</span>
            <span>{(camera.heightM / 1000).toFixed(2)} km</span>
            <span className="text-muted-foreground">·</span>
            <span>pitch {camera.pitchDeg.toFixed(0)}°</span>
          </div>
        )}
      </div>

      {cursor && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded border border-border bg-card/85 px-2.5 py-1 backdrop-blur-sm">
          <div className="flex items-center gap-1.5 font-mono text-[10px]">
            <Crosshair className="h-3 w-3 text-primary" />
            <MapPin className="h-3 w-3 text-muted-foreground" />
            <span className="text-foreground">{cursor.latDeg.toFixed(4)}°</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-foreground">{cursor.lngDeg.toFixed(4)}°</span>
          </div>
        </div>
      )}
    </>
  )
}

interface CesiumNSLike {
  Math: { toDegrees: (rad: number) => number }
  Cartographic: {
    fromCartesian: (c: unknown) => { longitude: number; latitude: number }
  }
}
