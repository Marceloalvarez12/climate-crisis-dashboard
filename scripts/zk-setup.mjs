import { randomBytes } from "node:crypto"
import { existsSync, mkdirSync, mkdtempSync, copyFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import process from "node:process"
import console from "node:console"
import { createRequire } from "node:module"
import { spawnSync } from "node:child_process"
import * as snarkjs from "snarkjs"
import { root, build, rustKey, artifacts, digest, renderRustKey } from "./zk-artifacts.mjs"

const require = createRequire(import.meta.url)

async function setup() {
  if (artifacts.slice(0, 3).some((file) => existsSync(path.join(root, file)))) {
    throw new Error("Ya existen artefactos ZK. No se reemplazan automáticamente: cambiar la clave invalida pruebas y requiere actualizar Soroban.")
  }
  const work = mkdtempSync(path.join(root, "zk/.setup-"))
  const result = spawnSync(process.execPath, [path.join(root, "scripts/zk-compile.mjs"), work], { cwd: root, stdio: "inherit" })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error("Falló la compilación del circuito")

  const file = (name) => path.join(work, name)
  console.log("Generando setup Groth16 local de un participante (entropía del sistema operativo).")
  const curve = await snarkjs.curves.getCurveFromName("bn128")
  await snarkjs.powersOfTau.newAccumulator(curve, 10, file("pot_initial.ptau"))
  await snarkjs.powersOfTau.contribute(file("pot_initial.ptau"), file("pot_contributed.ptau"), "Zntinel local phase 1", randomBytes(64).toString("hex"))
  await snarkjs.powersOfTau.preparePhase2(file("pot_contributed.ptau"), file("pot_final.ptau"))
  if (!await snarkjs.powersOfTau.verify(file("pot_final.ptau"))) throw new Error("Powers of Tau inválido")
  await snarkjs.zKey.newZKey(file("zone_membership.r1cs"), file("pot_final.ptau"), file("initial.zkey"))
  await snarkjs.zKey.contribute(file("initial.zkey"), file("final.zkey"), "Zntinel local phase 2", randomBytes(64).toString("hex"))
  if (!await snarkjs.zKey.verifyFromR1cs(file("zone_membership.r1cs"), file("pot_final.ptau"), file("final.zkey"))) throw new Error("Zkey inválida")
  const vk = await snarkjs.zKey.exportVerificationKey(file("final.zkey"))
  mkdirSync(path.join(build, "zone_membership_js"), { recursive: true })
  copyFileSync(file("zone_membership_js/zone_membership.wasm"), path.join(build, "zone_membership_js/zone_membership.wasm"))
  copyFileSync(file("final.zkey"), path.join(build, "zone_membership_final.zkey"))
  writeFileSync(path.join(build, "verification_key.json"), JSON.stringify(vk, null, 2) + "\n")
  writeFileSync(path.join(root, rustKey), renderRustKey(vk))
  writeFileSync(path.join(build, "manifest.json"), JSON.stringify({
    protocol: "groth16", curve: "bn128", setup: "single-party-local",
    generatedAt: new Date().toISOString(),
    tools: { circom2: require("circom2/package.json").version, circomlib: require("circomlib/package.json").version },
    publicSignals: ["out", "minLat", "maxLat", "minLng", "maxLng", "zoneHash"],
    sha256: Object.fromEntries(artifacts.map((name) => [name, digest(name)])),
  }, null, 2) + "\n")
  console.log(`Artefactos listos en ${build}. Transcript público conservado en ${work}.`)
  console.log("La entropía no se guarda. Para producción, coordinar una ceremonia con participantes independientes; no regenerar claves en CI.")
  await curve.terminate()
}

try {
  await setup()
  // snarkjs creates worker pools; exit once all awaited writes are complete.
  process.exit(0)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
