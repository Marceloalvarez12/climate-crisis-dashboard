import * as fs from "fs"
import * as path from "path"

const snarkjs = require("snarkjs")

export interface ZkZoneInput {
  lat: number
  lng: number
  zoneHash: number
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

export interface ZkProof {
  pi_a: string[]
  pi_b: string[][]
  pi_c: string[]
  protocol: string
  curve: string
}

export interface ZkPublicSignals {
  zoneHash: string
  minLat: string
  maxLat: string
  minLng: string
  maxLng: string
  lat: string
  lng: string
}

export interface ZkProofResult {
  proof: ZkProof
  publicSignals: string[]
  input: Record<string, string>
}

const COORD_SCALE = 1_000_000
const LAT_OFFSET = 90
const LNG_OFFSET = 180

function realToZkCoord(value: number, offset: number): number {
  return Math.round((value + offset) * COORD_SCALE)
}

function zkProofPaths(): { wasm: string; zkey: string } {
  const cwd = process.cwd()
  return {
    wasm: path.join(/*turbopackIgnore: true*/ cwd, "zk", "build", "zone_membership_js", "zone_membership.wasm"),
    zkey: path.join(/*turbopackIgnore: true*/ cwd, "zk", "build", "zone_membership_final.zkey"),
  }
}

const VK_PATH = path.join(/*turbopackIgnore: true*/ process.cwd(), "zk", "build", "verification_key.json")

export class ZkService {
  static encodeCoord(lat: number, lng: number): { lat: number; lng: number } {
    return {
      lat: realToZkCoord(lat, LAT_OFFSET),
      lng: realToZkCoord(lng, LNG_OFFSET),
    }
  }

  static buildInput(params: ZkZoneInput): Record<string, string> {
    const encoded = this.encodeCoord(params.lat, params.lng)
    return {
      lat: String(encoded.lat),
      lng: String(encoded.lng),
      minLat: String(Math.round((params.minLat + LAT_OFFSET) * COORD_SCALE)),
      maxLat: String(Math.round((params.maxLat + LAT_OFFSET) * COORD_SCALE)),
      minLng: String(Math.round((params.minLng + LNG_OFFSET) * COORD_SCALE)),
      maxLng: String(Math.round((params.maxLng + LNG_OFFSET) * COORD_SCALE)),
      zoneHash: String(params.zoneHash),
    }
  }

  static async generateProof(params: ZkZoneInput): Promise<ZkProofResult> {
    const input = this.buildInput(params)
    const { wasm, zkey } = zkProofPaths()

    if (!fs.existsSync(wasm)) {
      throw new Error(`ZK wasm not found: ${wasm}`)
    }
    if (!fs.existsSync(zkey)) {
      throw new Error(`ZK zkey not found: ${zkey}`)
    }

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasm, zkey)

    return { proof, publicSignals, input }
  }

  static async verifyProofLocal(proof: ZkProof, publicSignals: string[]): Promise<boolean> {
    if (!fs.existsSync(VK_PATH)) {
      throw new Error(`ZK verification key not found: ${VK_PATH}`)
    }

    const vKey = JSON.parse(fs.readFileSync(VK_PATH, "utf-8"))
    return snarkjs.groth16.verify(vKey, publicSignals, proof)
  }

  static proofToContractArgs(proof: ZkProof, publicSignals: string[]): { proofArg: string; pubSignalsArg: string } {
    const toHex = (n: string, len: number) => BigInt(n).toString(16).padStart(len * 2, "0")

    const a = toHex(proof.pi_a[0], 32) + toHex(proof.pi_a[1], 32)

    const x_c0 = proof.pi_b[0][0]
    const x_c1 = proof.pi_b[0][1]
    const y_c0 = proof.pi_b[1][0]
    const y_c1 = proof.pi_b[1][1]
    const b = toHex(x_c1, 32) + toHex(x_c0, 32) + toHex(y_c1, 32) + toHex(y_c0, 32)

    const c = toHex(proof.pi_c[0], 32) + toHex(proof.pi_c[1], 32)

    const proofArg = JSON.stringify({ a, b, c })
    const pubSignalsArg = JSON.stringify(publicSignals)

    return { proofArg, pubSignalsArg }
  }
}
