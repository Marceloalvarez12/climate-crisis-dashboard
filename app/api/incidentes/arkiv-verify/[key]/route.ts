import { NextResponse } from 'next/server'
import { createPublicClient, http } from '@arkiv-network/sdk'
import { braga } from '@arkiv-network/sdk/chains'
import { supabase } from '@/lib/supabase'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
): Promise<Response> {
  try {
    const resolvedParams = await params
    const key = resolvedParams.key

    if (!key || !key.startsWith('0x')) {
      return NextResponse.json({ success: false, error: 'Llave de entidad inválida' }, { status: 400 })
    }

    if (key.length !== 66) {
      if (key.length === 42) {
        return NextResponse.json({
          success: false,
          error: 'Has ingresado una dirección de billetera (42 caracteres). Debes ingresar una llave de entidad (Entity Key) válida de 32 bytes (66 caracteres empezando con "0x").'
        }, { status: 400 })
      }
      return NextResponse.json({
        success: false,
        error: `Longitud de llave inválida: ${key.length} caracteres. Debe ser una llave de entidad de 66 caracteres (32 bytes empezando con "0x").`
      }, { status: 400 })
    }

    const client = createPublicClient({
      chain: braga,
      transport: http(),
    })

    let entity = null
    try {
      // Obtener la entidad desde la red de Arkiv (Braga Testnet)
      entity = await client.getEntity(key as `0x${string}`)
    } catch (e) {
      console.warn('[Arkiv Verify] Key not found on-chain, trying database fallback if key is simulated:', e)
    }

    if (!entity) {
      // Intentar recuperar del simulador local (Supabase)
      const { data: incident, error: findError } = await supabase
        .from('incidentes')
        .select('*')
        .or(`fuente_detalles->>arkiv_entity_key.eq.${key},fuente_detalles->ai_analysis->>arkiv_entity_key.eq.${key}`)
        .maybeSingle()

      if (incident) {
        // Encontrado en base de datos local - retornar mock de simulación
        const isAiKey = (incident.fuente_detalles?.ai_analysis as any)?.arkiv_entity_key === key
        const simulatedPayload = isAiKey ? {
          agent: "Gemini 2.0 Flash (Simulado)",
          task: "Real-time Climate Crisis Monitoring",
          location: incident.ubicacion,
          type: incident.tipo,
          severity: incident.severidad,
          summary: incident.fuente_detalles?.content || "Detección automática de la IA",
          confidence: (incident.fuente_detalles?.ai_analysis as any)?.confidence || 90,
          scannedAt: incident.created_at,
          simulated: true
        } : {
          id: incident.id,
          tipo: incident.tipo,
          severidad: incident.severidad,
          ubicacion: incident.ubicacion,
          afectados: incident.personas_afectadas,
          timestamp: incident.fuente_detalles?.dispatched_at || incident.updated_at,
          simulated: true
        }

        return NextResponse.json({
          success: true,
          key,
          creator: '0xSimulatedOperatorAccount0000000000000000',
          expiresAtBlock: '999999 (Simulación)',
          payload: simulatedPayload,
          isSimulated: true
        })
      }

      return NextResponse.json({ success: false, error: 'Entidad no encontrada en la blockchain ni en la base de datos local' }, { status: 404 })
    }

    // Retornar los detalles decodificados
    return NextResponse.json({
      success: true,
      key,
      creator: entity.creator,
      expiresAtBlock: entity.expiresAtBlock?.toString() || null,
      payload: entity.toJson(),
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido al verificar on-chain'
    console.error('[Arkiv Verify] Error:', errorMessage)
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}
