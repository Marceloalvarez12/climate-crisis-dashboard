import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { createRequire } from "node:module"
import { root, circuit } from "./zk-artifacts.mjs"

const require = createRequire(import.meta.url)
const { CircomRunner, bindings } = require("circom2")
// WASI paths use forward slashes, including on Windows. circom2's CLI uses
// path.relative(), which emits backslashes and cannot write its output there.
const output = path.relative(root, process.argv[2]).replace(/\\/g, "/")
if (!output.startsWith("zk/.setup-") || output.includes("..")) throw new Error("Directorio de compilación inválido")
const runner = new CircomRunner({
  args: [circuit, "--r1cs", "--wasm", "--sym", "-l", "node_modules", "-o", output],
  env: process.env,
  preopens: { ".": "." },
  bindings: { ...bindings, fs, exit: (code) => process.exit(code) },
})
await runner.execute(fs.readFileSync(require.resolve("circom2/circom.wasm")))
