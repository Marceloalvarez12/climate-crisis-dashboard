import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { Buffer } from "node:buffer"
import { URL } from "node:url"
import { test } from "node:test"
import ts from "typescript"

// Load the actual TypeScript modules without adding a test runner dependency.
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`
const configUrl = moduleUrl(readFileSync(new URL("../lib/config.ts", import.meta.url), "utf8"))
const source = readFileSync(new URL("../lib/rate-limit.ts", import.meta.url), "utf8").replace('"@/lib/config"', JSON.stringify(configUrl))
const { createRateLimiter, RateLimitUnavailableError } = await import(moduleUrl(source))

test("local quota resets at the exact boundary and blocked calls do not extend it", async () => {
  let time = 1000
  const check = createRateLimiter({ now: () => time })
  for (let i = 0; i < 3; i++) assert.equal((await check("report:one", 3, 600000)).allowed, true)
  const blocked = await check("report:one", 3, 600000)
  assert.equal(blocked.allowed, false)
  assert.equal(blocked.remaining, 0)
  time = blocked.resetAt - 1
  assert.equal((await check("report:one", 3, 600000)).allowed, false)
  time = blocked.resetAt
  assert.equal((await check("report:one", 3, 600000)).allowed, true)
  assert.equal((await check("report:two", 3, 600000)).allowed, true)
})

test("separate instances use the same Redis key and share the quota", async () => {
  const counters = new Map()
  const requests = []
  const fakeRedis = async (url, options) => {
    const command = JSON.parse(options.body)
    requests.push({ url, options, command })
    const key = command[3]
    const count = (counters.get(key) ?? 0) + 1
    counters.set(key, count)
    return globalThis.Response.json({ result: [count, command[4]] })
  }
  const options = { redisUrl: "https://redis.example.test", redisToken: "test-token", fetch: fakeRedis, now: () => 1000 }
  const first = createRateLimiter(options)
  const second = createRateLimiter(options)
  const results = await Promise.all([first("report:192.0.2.1", 3, 600000), second("report:192.0.2.1", 3, 600000), first("report:192.0.2.1", 3, 600000), second("report:192.0.2.1", 3, 600000)])
  assert.equal(results.filter(r => r.allowed).length, 3)
  assert.ok(results.every(r => r.backend === "redis" && r.resetAt === 601000))
  const { command, options: request } = requests[0]
  assert.equal(command[0], "EVAL")
  assert.equal(command[2], 1)
  assert.match(command[1], /INCR/)
  assert.match(command[1], /PEXPIRE/)
  assert.match(command[1], /ttl < 0/)
  assert.equal(request.headers.Authorization, "Bearer test-token")
  assert.equal(request.cache, "no-store")
  assert.ok(request.signal instanceof globalThis.AbortSignal)
  assert.equal(command[3].includes("192.0.2.1"), false)
  assert.equal((await second("api:192.0.2.1", 200, 60000)).allowed, true)
})

test("Redis outages and malformed responses fail closed without leaking upstream details", async () => {
  const responses = [
    async () => { throw new Error("private-token upstream failure") },
    async () => new globalThis.Response("unavailable", { status: 503 }),
    async () => globalThis.Response.json({ error: "private-token WRONGPASS" }),
    async () => globalThis.Response.json({ result: [1, -1] }),
    async () => globalThis.Response.json({ result: [1, 60001] }),
    async () => globalThis.Response.json({ result: ["1", 1000] }),
    async () => globalThis.Response.json({ result: [0, 1000] }),
  ]
  for (const request of responses) {
    const check = createRateLimiter({ redisUrl: "https://redis.example.test", redisToken: "secret", fetch: request })
    await assert.rejects(() => check("api:one"), error => error instanceof RateLimitUnavailableError && error.message === "RATE_LIMIT_UNAVAILABLE")
  }
})

test("partial or mandatory Redis configuration cannot fall back to memory", async () => {
  for (const options of [{ redisUrl: "https://redis.example.test" }, { redisToken: "secret" }, { requireDistributed: true }, { redisUrl: "http://redis.example.test", redisToken: "secret" }]) {
    await assert.rejects(() => createRateLimiter(options)("api:one"), RateLimitUnavailableError)
  }
})

test("invalid quotas are rejected", async () => {
  const check = createRateLimiter()
  for (const args of [["", 3, 1000], ["one", 0, 1000], ["one", 1.5, 1000], ["one", 3, 0]]) {
    await assert.rejects(() => check(...args), /Parámetros/)
  }
})
