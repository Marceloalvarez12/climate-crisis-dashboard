import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { Buffer } from "node:buffer"
import { URL } from "node:url"
import { test } from "node:test"
import ts from "typescript"

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`
const load = path => import(moduleUrl(readFileSync(new URL(path, import.meta.url), "utf8")))
const { dispatchSelectedResources } = await load("../lib/resource-dispatch.ts")
const { withTimeout } = await load("../lib/services/with-timeout.ts")
const { buildDispatchPayload } = await load("../lib/dispatch-payload.ts")
const { publicStellarAudit } = await load("../lib/public-audit.ts")

test("incident is updated only after all resources succeed", async () => {
  const calls = []
  await dispatchSelectedResources("incident", ["one", "two"], {
    dispatch: async (_, id) => { calls.push(id) },
    markAttended: async () => { assert.deepEqual(calls, ["one", "two"]); calls.push("attended") },
  })
  assert.equal(calls.at(-1), "attended")
})

test("partial dispatch reports the failure and never marks the incident attended", async () => {
  let marked = false
  await assert.rejects(dispatchSelectedResources("incident", ["one", "two"], {
    dispatch: async (_, id) => { if (id === "two") throw new Error("conflict") },
    markAttended: async () => { marked = true },
  }), /1 recursos despachados; 1 fallaron/)
  assert.equal(marked, false)
})

test("empty and duplicate selections cannot dispatch; incident update failures stay visible", async () => {
  const dependencies = { dispatch: async () => { throw new Error("must not dispatch") }, markAttended: async () => {} }
  await assert.rejects(dispatchSelectedResources(undefined, ["one"], dependencies), /incidente válido/)
  await assert.rejects(dispatchSelectedResources("incident", [], dependencies), /Seleccioná recursos/)
  await assert.rejects(dispatchSelectedResources("incident", ["one", "one"], dependencies), /duplicados/)
  await assert.rejects(dispatchSelectedResources("incident", ["one"], {
    dispatch: async () => {}, markAttended: async () => { throw new Error("database unavailable") },
  }), /recursos fueron despachados, pero/)
})

test("blockchain timeouts reject rather than returning a successful placeholder", async () => {
  await assert.rejects(withTimeout(new Promise(() => {}), 5, "Arkiv"), /espera agotado/)
  assert.equal(await withTimeout(Promise.resolve("confirmed"), 100, "Arkiv"), "confirmed")
  await assert.rejects(withTimeout(Promise.reject(new Error("provider failed")), 100, "Arkiv"), /provider failed/)
})

test("public blockchain payload excludes citizen address and synthetic detection keys", () => {
  const incident = { id: "id", fuente: "citizen", ubicacion: "Dirección privada 123", tipo: "incendio", severidad: "high", personas_afectadas: 3, fuente_detalles: { detection_arkiv_key: "0xSimulated" } }
  const payload = buildDispatchPayload(incident, "operator", "timestamp")
  assert.equal(JSON.stringify(payload).includes(incident.ubicacion), false)
  assert.equal(payload.detectionKey, null)
  incident.fuente = "social"
  incident.fuente_detalles.detection_arkiv_key = `0x${"a".repeat(64)}`
  assert.equal(buildDispatchPayload(incident, "operator", "timestamp").ubicacion, incident.ubicacion)
  assert.equal(buildDispatchPayload(incident, "operator", "timestamp").detectionKey, incident.fuente_detalles.detection_arkiv_key)
})

test("public audit needs explicit verification and a confirmed transaction", () => {
  const txHash = "a".repeat(64)
  const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${txHash}`
  assert.equal(publicStellarAudit({}).verified, false)
  assert.equal(publicStellarAudit({ verified: true }).onChain, false)
  assert.equal(publicStellarAudit({ verified: true, onChain: true }).onChain, false)
  assert.equal(publicStellarAudit({ verified: true, onChain: true, txHash, isSimulated: true }).onChain, false)
  assert.equal(publicStellarAudit({ verified: true, onChain: true, txHash, explorerUrl }).explorerUrl, explorerUrl)
  assert.equal(publicStellarAudit({ verified: true, onChain: true, txHash, explorerUrl: "javascript:alert(1)" }).explorerUrl, undefined)
  assert.equal(publicStellarAudit({ verified: true, onChain: true, txHash, explorerUrl: explorerUrl.replace(txHash, "b".repeat(64)) }).explorerUrl, undefined)
})

test("real resource lifecycle makes one server update and propagates dispatch failures", async () => {
  const apiUrl = moduleUrl(`export const calls = []; export async function fetchRecursos() { return [{id: 'one', estado: 'available'}] } export async function patchRecurso(id, update) { if (id === 'failed') throw new Error('conflict'); calls.push({id, update}) }`)
  const source = readFileSync(new URL("../hooks/use-resource-lifecycle.ts", import.meta.url), "utf8").replace('"@/lib/api"', JSON.stringify(apiUrl))
  const { dispatchResourceWithLifecycle } = await import(moduleUrl(source))
  const { calls } = await import(apiUrl)
  const result = await dispatchResourceWithLifecycle("incident")
  result.cleanup()
  assert.deepEqual(calls, [{ id: "one", update: { estado: "dispatched", incidente_id: "incident" } }])
  await assert.rejects(dispatchResourceWithLifecycle("incident", "failed"), /conflict/)
  await assert.rejects(dispatchResourceWithLifecycle(), /incidente/)
  assert.equal(calls.length, 1)
})
