import { z } from "zod"

export const IncidentCreateSchema = z.object({
  tipo: z.enum(["flood", "fire", "storm", "looting", "violence", "accident", "general"]),
  severidad: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  ubicacion: z.string().min(2).max(200),
  latitud: z.number().min(-90).max(90).default(-26.8241),
  longitud: z.number().min(-180).max(180).default(-65.2226),
  personas_afectadas: z.number().int().min(0).default(0),
  fuente: z.enum(["social", "sensor", "camera", "citizen"]).default("citizen"),
  fuente_detalles: z.record(z.unknown()).optional(),
  estado: z.enum(["activo", "atendido"]).default("activo"),
})

export const IncidentPatchSchema = z.object({
  id: z.string().min(1),
  estado: z.enum(["activo", "atendido"]).optional(),
  severidad: z.enum(["critical", "high", "medium", "low"]).optional(),
  personas_afectadas: z.number().int().min(0).optional(),
})

export const ResourcePatchSchema = z.object({
  id: z.string().min(1),
  estado: z.enum(["available", "dispatched", "busy"]).optional(),
  incidente_id: z.string().nullable().optional(),
})

export const SocialMentionSchema = z.object({
  postId:    z.string().min(1).max(200).optional(),
  platform:  z.enum(["facebook", "instagram", "twitter", "tiktok"]),
  author:    z.string().min(1).max(120),
  authorUrl: z.string().url().max(500).optional(),
  text:      z.string().min(1).max(2200),
  imageUrl:  z.string().url().max(1000).optional(),
  location:  z.string().max(200).optional(),
  lat:       z.number().min(-90).max(90).optional(),
  lng:       z.number().min(-180).max(180).optional(),
  postedAt:  z.string().datetime().optional(),
  simulated: z.boolean().optional(),
}).refine((m) => (m.lat === undefined) === (m.lng === undefined), {
  message: "lat y lng deben enviarse juntos",
  path: ["lat"],
})

export type SocialMentionInput = z.infer<typeof SocialMentionSchema>

export const AgentLogSchema = z.object({
  scan_id: z.string().optional(),
  platform: z.string().max(50).optional(),
  posts_collected: z.number().int().min(0).optional(),
  incidents_found: z.number().int().min(0).optional(),
  status: z.enum(["success", "error", "timeout"]).default("success"),
  details: z.record(z.unknown()).optional(),
})
