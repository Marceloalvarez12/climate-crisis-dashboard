import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import process from "node:process"
import console from "node:console"
import * as snarkjs from "snarkjs"
import { root, build, artifacts, digest, rustKey, renderRustKey } from "./zk-artifacts.mjs"

async function check() {
  const manifest = JSON.parse(readFileSync(path.join(build, "manifest.json"), "utf8"))
  for (const file of artifacts) assert.equal(digest(file), manifest.sha256[file], `Artefacto alterado o desactualizado: ${file}`)
  const vk = JSON.parse(readFileSync(path.join(build, "verification_key.json"), "utf8"))
  assert.equal(vk.protocol, "groth16")
  assert.equal(vk.nPublic, 6)
  assert.equal(readFileSync(path.join(root, rustKey), "utf8").replace(/\r\n/g, "\n"), renderRustKey(vk), "La clave Soroban debe coincidir con la local")
  console.log("Integridad de los artefactos ZK y clave Soroban: OK")
  if (process.argv.includes("--integrity-only")) return

  const wasm = path.join(build, "zone_membership_js/zone_membership.wasm")
  const zkey = path.join(build, "zone_membership_final.zkey")
  const input = { lat: "63200000", lng: "114800000", minLat: "63000000", maxLat: "63500000", minLng: "114500000", maxLng: "115000000", zoneHash: "12345" }
  const signals = [input.zoneHash, input.minLat, input.maxLat, input.minLng, input.maxLng, input.zoneHash]
  for (const position of [input, { ...input, lat: input.minLat, lng: input.minLng }, { ...input, lat: input.maxLat, lng: input.maxLng }]) {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(position, wasm, zkey)
    assert.deepEqual(publicSignals, signals, "Las señales públicas no deben incluir coordenadas privadas")
    assert.equal(await snarkjs.groth16.verify(vk, publicSignals, proof), true)
    const tampered = [...publicSignals]
    tampered[5] = "99999"
    assert.equal(await snarkjs.groth16.verify(vk, tampered, proof), false, "Debe rechazar una zona alterada")
    const badProof = { ...proof, pi_c: ["0", "0", "1"] }
    assert.equal(await snarkjs.groth16.verify(vk, publicSignals, badProof), false, "Debe rechazar una prueba alterada")
  }
  const field = 21888242871839275222246405745257275088548364400416034343698204186575808495617n
  for (const changes of [
    { lat: "62999999" }, { lat: "63500001" }, { lng: "114499999" }, { lng: "115000001" },
    { lat: (field - 1n).toString() }, { lng: "4294967296" }, { minLat: (field - 1n).toString() },
  ]) {
    await assert.rejects(() => snarkjs.wtns.calculate({ ...input, ...changes }, wasm, { type: "mem" }), /Assert Failed|Error in template/, "Debe rechazar ubicaciones fuera de zona y desbordamientos")
  }
  console.log("Pruebas reales: interior, límites, señales/prueba alteradas y 7 ubicaciones inválidas: OK")
}

try {
  await check()
  process.exit(0)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
