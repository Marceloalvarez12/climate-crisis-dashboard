/**
 * Copia SOLO Workers / Widgets / ThirdParty de Cesium a public/cesium.
 * Assets (texturas, modelos, drone paths ~40MB) NO se copian — no los usamos.
 * CESIUM_BASE_URL='/cesium/' sirve los workers, los widgets y los shaders
 * mínimos. El bundle del viewer (cesium.js) viene del node_modules via webpack.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const src = path.join(root, "node_modules", "cesium", "Build", "Cesium")
const dest = path.join(root, "public", "cesium")

// Workers (decoders, terrain, etc) + Widgets UI + ThirdParty shaders.
// NO copiamos Assets/ — son 40MB de texturas/modelos que no usamos.
const DIRS = ["Workers", "ThirdParty", "Widgets"]

if (!fs.existsSync(src)) {
  console.warn("[copy-cesium] skip — node_modules/cesium/Build/Cesium no existe")
  process.exit(0)
}

fs.mkdirSync(dest, { recursive: true })

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true })
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, entry.name)
    const d = path.join(to, entry.name)
    if (entry.isDirectory()) copyDir(s, d)
    else fs.copyFileSync(s, d)
  }
}

let totalBytes = 0
function copyDirSized(from, to) {
  fs.mkdirSync(to, { recursive: true })
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, entry.name)
    const d = path.join(to, entry.name)
    if (entry.isDirectory()) copyDirSized(s, d)
    else {
      fs.copyFileSync(s, d)
      try { totalBytes += fs.statSync(s).size } catch {}
    }
  }
}

for (const dir of DIRS) {
  const from = path.join(src, dir)
  if (!fs.existsSync(from)) {
    console.warn(`[copy-cesium] missing ${dir}`)
    continue
  }
  copyDirSized(from, path.join(dest, dir))
}

const css = path.join(src, "Widgets", "widgets.css")
if (fs.existsSync(css)) {
  fs.copyFileSync(css, path.join(dest, "Widgets", "widgets.css"))
}

const mb = (totalBytes / 1024 / 1024).toFixed(1)
console.log(`[copy-cesium] public/cesium listo — ${mb} MB (Assets omitidos)`)
