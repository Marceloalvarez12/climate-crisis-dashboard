import { z } from "zod"

// Public audit fields can be missing in older entities. Validate their types
// before rendering them and preserve unknown fields for the raw JSON viewer.
export const ArkivAuditPayloadSchema = z.object({
  action: z.string().catch(""), agent: z.string().catch(""),
  scannedAt: z.string().catch(""), dispatchedAt: z.string().catch(""), timestamp: z.string().catch(""),
  location: z.string().catch(""), ubicacion: z.string().catch(""),
  summary: z.string().catch(""), reasoning: z.string().catch(""),
  type: z.string().catch(""), tipo: z.string().catch(""),
  severity: z.string().catch(""), severidad: z.string().catch(""), operator: z.string().catch(""),
  confidence: z.number().optional().catch(undefined),
  afectados: z.number().optional().catch(undefined),
  personas_afectadas: z.number().optional().catch(undefined),
  affectedPeople: z.number().optional().catch(undefined),
  suggestedActions: z.union([z.string(), z.array(z.string())]).optional().catch(undefined),
}).passthrough()

export type ArkivAuditPayload = z.infer<typeof ArkivAuditPayloadSchema>
