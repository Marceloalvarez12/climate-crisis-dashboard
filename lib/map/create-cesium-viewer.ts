import { TUCUMAN_CENTER } from "@/lib/map/tucuman"

export type CesiumModule = typeof import("cesium")
export type ZntinelViewer = import("cesium").Viewer

function setBaseUrl() {
  ;(globalThis as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = "/cesium/"
}

export async function createZntinelViewer(container: HTMLElement): Promise<{
  viewer: ZntinelViewer
  Cesium: CesiumModule
}> {
  setBaseUrl()
  const Cesium = await import("cesium")

  const ionToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN
  if (ionToken) {
    Cesium.Ion.defaultAccessToken = ionToken
  }

  const imagery = new Cesium.UrlTemplateImageryProvider({
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maximumLevel: 19,
    credit: new Cesium.Credit("Powered by Esri — Esri, Maxar, Earthstar Geographics", false),
  })

  let terrainProvider: import("cesium").TerrainProvider = new Cesium.EllipsoidTerrainProvider()
  if (ionToken) {
    try {
      terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(1)
    } catch (err) {
      console.warn("[cesium] Ion terrain unavailable, using ellipsoid", err)
    }
  }

  const viewer = new Cesium.Viewer(container, {
    animation: false,
    timeline: false,
    fullscreenButton: false,
    vrButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    navigationHelpButton: false,
    baseLayerPicker: false,
    baseLayer: new Cesium.ImageryLayer(imagery),
    terrainProvider,
    shouldAnimate: true,
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,
    msaaSamples: 4,
  })

  viewer.scene.globe.enableLighting = true
  viewer.scene.globe.depthTestAgainstTerrain = Boolean(ionToken)
  viewer.scene.fog.enabled = true
  if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true
  viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#0a0c10")
  viewer.scene.screenSpaceCameraController.minimumZoomDistance = 120
  viewer.scene.screenSpaceCameraController.maximumZoomDistance = 4_000_000

  const credit = viewer.cesiumWidget.creditContainer as HTMLElement
  credit.style.display = "none"

  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(
      TUCUMAN_CENTER.lng,
      TUCUMAN_CENTER.lat,
      TUCUMAN_CENTER.overviewHeightM,
    ),
    orientation: {
      heading: 0,
      pitch: Cesium.Math.toRadians(-55),
      roll: 0,
    },
  })

  viewer.scene.requestRender()
  return { viewer, Cesium }
}
