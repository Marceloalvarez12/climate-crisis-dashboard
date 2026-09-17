"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import type { Incident } from "@/lib/types"
import type { Earthquake, WeatherSnapshot } from "@/lib/data/layers"
import { severityHex } from "@/components/dashboard/crisis-map/incident-helpers"
import { createZntinelViewer, type CesiumModule, type ZntinelViewer } from "@/lib/map/create-cesium-viewer"
import { incidentBillboardCanvas, pulseRadiusMeters } from "@/lib/map/cesium-markers"
import { earthquakeCanvas, weatherCanvas } from "@/lib/map/layer-markers"
import { ID_EQ, ID_INC, ID_WX_TUCUMAN, incidentIdFromEntity } from "@/lib/map/layer-ids"
import { TUCUMAN_CENTER } from "@/lib/map/tucuman"
import { getVisualMode, type VisualMode } from "@/lib/map/visual-modes"

export interface CesiumGlobeHandle {
  getViewer: () => ZntinelViewer | null
}

interface CesiumGlobeProps {
  incidents: Incident[]
  earthquakes: Earthquake[]
  weather: WeatherSnapshot | null
  showEarthquakes: boolean
  showWeather: boolean
  visualMode: VisualMode
  selectedId: string | null
  onSelect: (incident: Incident) => void
  onInitError?: () => void
  onViewerReady?: (viewer: ZntinelViewer) => void
}

export const CesiumGlobe = forwardRef<CesiumGlobeHandle, CesiumGlobeProps>(function CesiumGlobe(
  {
    incidents,
    earthquakes,
    weather,
    showEarthquakes,
    showWeather,
    visualMode,
    selectedId,
    onSelect,
    onInitError,
    onViewerReady,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<ZntinelViewer | null>(null)
  const cesiumRef = useRef<CesiumModule | null>(null)
  const onSelectRef = useRef(onSelect)
  const onViewerReadyRef = useRef(onViewerReady)
  const incidentsRef = useRef(incidents)
  const lastVisualModeRef = useRef<VisualMode | null>(null)
  const [ready, setReady] = useState(false)

  useImperativeHandle(ref, () => ({ getViewer: () => viewerRef.current }), [])
  onSelectRef.current = onSelect
  onViewerReadyRef.current = onViewerReady
  incidentsRef.current = incidents

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let cancelled = false
    let handler: import("cesium").ScreenSpaceEventHandler | undefined
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = "/cesium/Widgets/widgets.css"
    document.head.appendChild(link)

    createZntinelViewer(el)
      .then(({ viewer, Cesium }) => {
        if (cancelled) {
          viewer.destroy()
          return
        }
        viewerRef.current = viewer
        cesiumRef.current = Cesium

        handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
        handler.setInputAction((click: { position: import("cesium").Cartesian2 }) => {
          const picked = viewer.scene.pick(click.position)
          if (!Cesium.defined(picked) || !picked.id) return
          const id = String(picked.id.id)
          if (id.startsWith("inc:")) {
            const realId = incidentIdFromEntity(id)
            const incident = incidentsRef.current.find((item) => item.id === realId)
            if (incident) onSelectRef.current(incident)
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

        onViewerReadyRef.current?.(viewer)
        setReady(true)
      })
      .catch((err) => {
        console.error("[CesiumGlobe] init failed", err)
        onInitError?.()
      })

    return () => {
      cancelled = true
      setReady(false)
      handler?.destroy()
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy()
      }
      viewerRef.current = null
      cesiumRef.current = null
      if (link.parentNode) link.parentNode.removeChild(link)
    }
  }, [onInitError])

  // ── Visual mode (switch imagery + scene settings) ──────────────────────
  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (!ready || !viewer || !Cesium) return
    if (lastVisualModeRef.current === visualMode) return
    lastVisualModeRef.current = visualMode

    const mode = getVisualMode(visualMode)
    const provider = new Cesium.UrlTemplateImageryProvider({
      url: mode.url,
      maximumLevel: 19,
      credit: new Cesium.Credit(mode.credit, false),
    })
    const layer = new Cesium.ImageryLayer(provider)

    const firstLayer = viewer.imageryLayers.get(0)
    if (firstLayer) viewer.imageryLayers.remove(firstLayer, false)
    viewer.imageryLayers.add(layer, 0)

    viewer.scene.globe.enableLighting = mode.lighting
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = mode.atmosphere
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString(mode.backgroundColor)
    viewer.scene.requestRender()
  }, [visualMode, ready])

  // ── Incidentes ─────────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (!ready || !viewer || !Cesium) return

    const incoming = new Set(incidents.map((item) => ID_INC(item.id)))
    const toRemove: string[] = []
    for (const entity of viewer.entities.values) {
      const id = String(entity.id)
      if (id.startsWith("inc:") && !incoming.has(id)) toRemove.push(id)
    }
    for (const id of toRemove) viewer.entities.removeById(id)

    for (const incident of incidents) {
      const entityId = ID_INC(incident.id)
      const color = Cesium.Color.fromCssColorString(severityHex(incident.severity))
      const position = Cesium.Cartesian3.fromDegrees(
        incident.coordinates.lng,
        incident.coordinates.lat,
        40,
      )
      const existing = viewer.entities.getById(entityId)
      if (existing) {
        existing.position = new Cesium.ConstantPositionProperty(position)
        continue
      }
      const radius = pulseRadiusMeters(incident.severity)
      viewer.entities.add({
        id: entityId,
        name: incident.location,
        position,
        billboard: {
          image: incidentBillboardCanvas(incident),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scale: 0.85,
        },
        ellipse: {
          semiMajorAxis: radius,
          semiMinorAxis: radius,
          material: color.withAlpha(0.22),
          outline: true,
          outlineColor: color.withAlpha(0.7),
          height: 0,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
        label: {
          text: incident.location.split(" - ")[0] ?? incident.location,
          font: "11px sans-serif",
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.TOP,
          pixelOffset: new Cesium.Cartesian2(0, 8),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString("#0a0c10").withAlpha(0.72),
          scaleByDistance: new Cesium.NearFarScalar(500, 1, 40_000, 0.35),
        },
      })
    }
    viewer.scene.requestRender()
  }, [incidents, ready])

  // ── Terremotos ─────────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (!ready || !viewer || !Cesium) return

    const incoming = new Set(earthquakes.map((item) => ID_EQ(item.id)))
    const toRemove: string[] = []
    for (const entity of viewer.entities.values) {
      const id = String(entity.id)
      if (id.startsWith("eq:") && !incoming.has(id)) toRemove.push(id)
    }
    for (const id of toRemove) viewer.entities.removeById(id)

    for (const eq of earthquakes) {
      const entityId = ID_EQ(eq.id)
      const position = Cesium.Cartesian3.fromDegrees(
        eq.coordinates.lng,
        eq.coordinates.lat,
        0,
      )
      const existing = viewer.entities.getById(entityId)
      if (existing) {
        existing.position = new Cesium.ConstantPositionProperty(position)
        existing.show = showEarthquakes
        continue
      }
      viewer.entities.add({
        id: entityId,
        name: `M${eq.magnitude.toFixed(1)} — ${eq.place}`,
        position,
        show: showEarthquakes,
        billboard: {
          image: earthquakeCanvas(eq.magnitude),
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scale: 0.8,
        },
        label: {
          text: `M${eq.magnitude.toFixed(1)}`,
          font: "10px sans-serif",
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.TOP,
          pixelOffset: new Cesium.Cartesian2(0, -22),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString("#7c2d12").withAlpha(0.85),
          translucencyByDistance: new Cesium.NearFarScalar(50_000, 1, 4_000_000, 0.4),
        },
      })
    }
    viewer.scene.requestRender()
  }, [earthquakes, showEarthquakes, ready])

  // ── Clima ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (!ready || !viewer || !Cesium) return

    const existing = viewer.entities.getById(ID_WX_TUCUMAN)
    if (!weather) {
      if (existing) existing.show = false
      viewer.scene.requestRender()
      return
    }
    const position = Cesium.Cartesian3.fromDegrees(
      weather.location.lng,
      weather.location.lat,
      220,
    )
    const image = weatherCanvas({
      tempC: weather.temperatureC,
      windKmh: weather.windSpeedKmh,
      precipMm: weather.precipitationMm,
    })
    if (existing) {
      existing.position = new Cesium.ConstantPositionProperty(position)
      if (existing.billboard) {
        existing.billboard.image = new Cesium.ConstantProperty(image)
      }
      existing.show = showWeather
      viewer.scene.requestRender()
      return
    }
    viewer.entities.add({
      id: ID_WX_TUCUMAN,
      name: `Clima: ${weather.temperatureC.toFixed(0)}°C, ${weather.windSpeedKmh.toFixed(0)} km/h`,
      position,
      show: showWeather,
      billboard: {
        image: new Cesium.ConstantProperty(image),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
        pixelOffset: new Cesium.Cartesian2(20, -120),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
    viewer.scene.requestRender()
  }, [weather, showWeather, ready])

  // ── Fly-to ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (!ready || !viewer || !Cesium || !selectedId) return
    const incident = incidentsRef.current.find((item) => item.id === selectedId)
    if (!incident) return

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        incident.coordinates.lng,
        incident.coordinates.lat,
        TUCUMAN_CENTER.focusHeightM,
      ),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-45),
        roll: 0,
      },
      duration: 1.35,
    })
  }, [selectedId, ready])

  return (
    <div className="relative h-full w-full bg-[#0a0c10]">
      <div ref={containerRef} className="h-full w-full" />
      {!ready && (
        <div className="absolute inset-0 z-[1] flex items-center justify-center bg-[#0a0c10]/80">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading 3D globe...</p>
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute bottom-2 left-2 z-10 rounded border border-border bg-card/90 px-2 py-1 text-[9px] text-muted-foreground">
        Tiles © Esri · Sismos USGS (PD) · Clima Open-Meteo (CC BY 4.0)
      </div>
    </div>
  )
})
