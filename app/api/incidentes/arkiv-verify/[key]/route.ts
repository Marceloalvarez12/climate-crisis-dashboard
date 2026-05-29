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

    if (entity) {
      const payload = entity.toJson()
      let linkedEntityData = null
      let relationType: 'detection_to_dispatch' | 'dispatch_to_detection' | null = null
      let linkedKey = ""

      try {
        // Caso A: La llave consultada es un Despacho y tiene enlazada la Detección original
        if (payload && payload.action === 'dispatch' && payload.detectionKey) {
          linkedKey = payload.detectionKey
          relationType = 'dispatch_to_detection'
        } 
        // Caso B: La llave consultada es una Detección. Buscamos en Supabase si fue atendido y tiene despacho.
        else {
          const { data: dbIncident } = await supabase
            .from('incidentes')
            .select('*')
            .or(`fuente_detalles->>detection_arkiv_key.eq.${key},fuente_detalles->ai_analysis->>arkiv_entity_key.eq.${key}`)
            .maybeSingle()

          if (dbIncident && dbIncident.fuente_detalles?.arkiv_entity_key && dbIncident.fuente_detalles?.arkiv_entity_key !== key) {
            linkedKey = dbIncident.fuente_detalles.arkiv_entity_key as string
            relationType = 'detection_to_dispatch'
          }
        }

        // Si encontramos una clave vinculada, la consultamos en la blockchain con fallback a base de datos
        if (linkedKey && linkedKey.startsWith('0x') && linkedKey.length === 66) {
          let fetchedLinked = false

          if (!linkedKey.includes('Simulated') && !linkedKey.includes('0xSimulated')) {
            try {
              const linkedEntity = await client.getEntity(linkedKey as `0x${string}`)
              if (linkedEntity) {
                linkedEntityData = {
                  key: linkedKey,
                  creator: linkedEntity.creator,
                  expiresAtBlock: linkedEntity.expiresAtBlock?.toString() || null,
                  payload: linkedEntity.toJson(),
                }
                fetchedLinked = true
              }
            } catch (linkErr) {
              console.warn('[Arkiv Verify] Linked key not found on-chain, trying database fallback:', linkErr)
            }
          }

          if (!fetchedLinked) {
            // Fallback a base de datos local para la entidad vinculada (por si es simulada)
            const { data: dbIncident } = await supabase
              .from('incidentes')
              .select('*')
              .or(`fuente_detalles->>arkiv_entity_key.eq.${linkedKey},fuente_detalles->ai_analysis->>arkiv_entity_key.eq.${linkedKey},fuente_detalles->>detection_arkiv_key.eq.${linkedKey}`)
              .maybeSingle()

            if (dbIncident) {
              const isLinkedDetection = relationType === 'dispatch_to_detection'
              const simulatedDetectionPayload = {
                agent: "Gemini 2.0 Flash (Simulado)",
                task: "Real-time Climate Crisis Monitoring",
                location: dbIncident.ubicacion,
                type: dbIncident.tipo,
                severity: dbIncident.severidad,
                summary: dbIncident.fuente_detalles?.content || "Detección automática de la IA",
                confidence: (dbIncident.fuente_detalles?.ai_analysis as any)?.confidence || 90,
                scannedAt: dbIncident.created_at,
                simulated: true
              }
              
              const simulatedDispatchPayload = {
                action: 'dispatch',
                incidentId: dbIncident.id,
                detectionKey: linkedKey,
                tipo: dbIncident.tipo,
                severidad: dbIncident.severidad,
                ubicacion: dbIncident.ubicacion,
                afectados: dbIncident.personas_afectadas,
                operator: '0xSimulatedOperatorAccount0000000000000000',
                dispatchedAt: dbIncident.fuente_detalles?.dispatched_at || dbIncident.updated_at,
                simulated: true
              }

              linkedEntityData = {
                key: linkedKey,
                creator: isLinkedDetection ? '0xSimulatedAIAgent0000000000000000000000' : '0xSimulatedOperatorAccount0000000000000000',
                expiresAtBlock: '999999 (Simulación)',
                payload: isLinkedDetection ? simulatedDetectionPayload : simulatedDispatchPayload
              }
            }
          }
        }
      } catch (linkError) {
        console.warn('[Arkiv Verify] Error al resolver entidad vinculada:', linkError)
      }

      return NextResponse.json({
        success: true,
        key,
        creator: entity.creator,
        expiresAtBlock: entity.expiresAtBlock?.toString() || null,
        payload,
        linkedEntity: linkedEntityData,
        relation: relationType,
        isSimulated: false
      })
    }

    // Intentar recuperar del simulador local (Supabase)
    const { data: incident, error: findError } = await supabase
      .from('incidentes')
      .select('*')
      .or(`fuente_detalles->>arkiv_entity_key.eq.${key},fuente_detalles->ai_analysis->>arkiv_entity_key.eq.${key},fuente_detalles->>detection_arkiv_key.eq.${key}`)
      .maybeSingle()

    if (incident) {
      const detectionKey = (incident.fuente_detalles?.ai_analysis as any)?.arkiv_entity_key || incident.fuente_detalles?.detection_arkiv_key || `0xSimulatedDetectionKey-${incident.id}`
      const dispatchKey = incident.fuente_detalles?.arkiv_entity_key || `0xSimulatedDispatchKey-${incident.id}`
      
      const isQueryingDetection = key === detectionKey || (incident.fuente_detalles?.ai_analysis as any)?.arkiv_entity_key === key
      
      const simulatedDetectionPayload = {
        agent: "Gemini 2.0 Flash (Simulado)",
        task: "Real-time Climate Crisis Monitoring",
        location: incident.ubicacion,
        type: incident.tipo,
        severity: incident.severidad,
        summary: incident.fuente_detalles?.content || "Detección automática de la IA",
        confidence: (incident.fuente_detalles?.ai_analysis as any)?.confidence || 90,
        scannedAt: incident.created_at,
        simulated: true
      }

      const simulatedDispatchPayload = {
        action: 'dispatch',
        incidentId: incident.id,
        detectionKey: detectionKey,
        tipo: incident.tipo,
        severidad: incident.severidad,
        ubicacion: incident.ubicacion,
        afectados: incident.personas_afectadas,
        operator: '0xSimulatedOperatorAccount0000000000000000',
        dispatchedAt: incident.fuente_detalles?.dispatched_at || incident.updated_at,
        simulated: true
      }

      const activePayload = isQueryingDetection ? simulatedDetectionPayload : simulatedDispatchPayload
      let linkedEntityData = null
      let relationType: 'detection_to_dispatch' | 'dispatch_to_detection' | null = null

      if (incident.estado === 'atendido') {
        relationType = isQueryingDetection ? 'detection_to_dispatch' : 'dispatch_to_detection'
        
        // Determinar si la entidad enlazada se puede obtener de la blockchain
        const linkedKey = isQueryingDetection ? dispatchKey : detectionKey
        let fetchedLinked = false

        if (linkedKey && linkedKey.startsWith('0x') && linkedKey.length === 66 && !linkedKey.includes('Simulated') && !linkedKey.includes('0xSimulated')) {
          try {
            const linkedEntity = await client.getEntity(linkedKey as `0x${string}`)
            if (linkedEntity) {
              linkedEntityData = {
                key: linkedKey,
                creator: linkedEntity.creator,
                expiresAtBlock: linkedEntity.expiresAtBlock?.toString() || null,
                payload: linkedEntity.toJson(),
              }
              fetchedLinked = true
            }
          } catch (linkErr) {
            console.warn('[Arkiv Verify] Error fetching linked entity in fallback:', linkErr)
          }
        }

        if (!fetchedLinked) {
          linkedEntityData = {
            key: linkedKey,
            creator: isQueryingDetection ? '0xSimulatedOperatorAccount0000000000000000' : '0xSimulatedAIAgent0000000000000000000000',
            expiresAtBlock: '999999 (Simulación)',
            payload: isQueryingDetection ? simulatedDispatchPayload : simulatedDetectionPayload
          }
        }
      }

      return NextResponse.json({
        success: true,
        key,
        creator: isQueryingDetection ? '0xSimulatedAIAgent0000000000000000000000' : '0xSimulatedOperatorAccount0000000000000000',
        expiresAtBlock: '999999 (Simulación)',
        payload: activePayload,
        linkedEntity: linkedEntityData,
        relation: relationType,
        isSimulated: true
      })
    }

    return NextResponse.json({ success: false, error: 'Entidad no encontrada en la blockchain ni en la base de datos local' }, { status: 404 })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido al verificar on-chain'
    console.error('[Arkiv Verify] Error:', errorMessage)
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}
