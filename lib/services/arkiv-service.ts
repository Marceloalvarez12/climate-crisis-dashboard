import { createWalletClient, createPublicClient, http } from "@arkiv-network/sdk"
import { braga } from "@arkiv-network/sdk/chains"
import { privateKeyToAccount } from "@arkiv-network/sdk/accounts"
import { jsonToPayload } from "@arkiv-network/sdk/utils"
import { CONFIG } from "@/lib/config"

export interface ArkivEntity {
  key: string
  creator: string
  expiresAtBlock: string | null
  payload: Record<string, unknown>
}

export interface DispatchPayload {
  action: "dispatch"
  incidentId: string
  detectionKey: string | null
  tipo: string
  severidad: string
  ubicacion: string
  afectados: number
  operator: string
  dispatchedAt: string
}

export class ArkivService {
  private static isSimulated(): boolean {
    return !process.env.ARKIV_PRIVATE_KEY ||
      process.env.ARKIV_PRIVATE_KEY === "0xREEMPLAZAR_CON_TU_PRIVATE_KEY_AQUI"
  }

  private static getWalletClient() {
    if (this.isSimulated()) return null
    const account = privateKeyToAccount(process.env.ARKIV_PRIVATE_KEY as `0x${string}`)
    return createWalletClient({ chain: braga, transport: http(), account })
  }

  private static getPublicClient() {
    return createPublicClient({ chain: braga, transport: http() })
  }

  static isConfigured(): boolean {
    return !this.isSimulated()
  }

  static isSimulatedKey(key: string): boolean {
    return key.includes(CONFIG.ARKIV.SIMULATED_KEY_PREFIX) ||
      key.includes("0xSimulated")
  }

  static isValidEntityKey(key: string): boolean {
    return /^0x[0-9a-fA-F]{64}$/.test(key)
  }

  static isWalletAddress(key: string): boolean {
    return key.startsWith("0x") && key.length === 42
  }

  static async extendLease(entityKey: string, seconds: number): Promise<boolean> {
    const client = this.getWalletClient()
    if (!client || this.isSimulatedKey(entityKey)) return false

    try {
      await client.extendEntity({
        entityKey: entityKey as `0x${string}`,
        expiresIn: seconds,
      })
      return true
    } catch (err) {
      console.warn("[Arkiv] Failed to extend lease:", err)
      return false
    }
  }

  static async createDispatchEntity(
    payload: DispatchPayload,
    attributes: Array<{ key: string; value: string }>
  ): Promise<{ entityKey?: string; isSimulated: boolean }> {
    if (this.isSimulated()) {
      return { isSimulated: true }
    }

    const client = this.getWalletClient()
    if (!client) throw new Error("Wallet client not available")

    const result = await client.createEntity({
      payload: jsonToPayload(payload),
      contentType: "application/json",
      attributes,
      expiresIn: CONFIG.INCIDENTS.DISPATCH_LEASE_SECONDS,
    })

    return { entityKey: result.entityKey, isSimulated: false }
  }

  static async getEntity(key: string): Promise<ArkivEntity | null> {
    if (this.isSimulatedKey(key)) return null

    try {
      const client = this.getPublicClient()
      const entity = await client.getEntity(key as `0x${string}`)
      return {
        key,
        creator: entity.creator ?? "",
        expiresAtBlock: entity.expiresAtBlock?.toString() || null,
        payload: entity.toJson(),
      }
    } catch {
      return null
    }
  }
}
