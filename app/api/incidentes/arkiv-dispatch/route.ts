import { NextResponse } from 'next/server'
import { createWalletClient, http } from '@arkiv-network/sdk'
import { braga } from '@arkiv-network/sdk/chains'
import { privateKeyToAccount } from '@arkiv-network/sdk/accounts'
import { jsonToPayload } from '@arkiv-network/sdk/utils'
import type { EmergencyIncident, ArkivDispatchResponse } from '@/lib/types'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request): Promise<Response> {
  try {
    const incidente: EmergencyIncident & { arkivKey?: string } = await request.json()

    let entityKey = ""
    let isSimulated = false
    let isLeaseExtended = false

    if (!process.env.ARKIV_PRIVATE_KEY || process.env.ARKIV_PRIVATE_KEY === '0xREEMPLAZAR_CON_TU_PRIVATE_KEY_AQUI') {
      entityKey = `0x${Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join("")}`
      isSimulated = true
      isLeaseExtended = !!incidente.arkivKey
      console.warn(`[Arkiv Dispatch] (Simulated Mode) ARKIV_PRIVATE_KEY not set. Generating simulated entityKey: ${entityKey}`)
    } else {
      const account = privateKeyToAccount(process.env.ARKIV_PRIVATE_KEY as `0x${string}`)

      const walletClient = createWalletClient({
        chain: braga,
        transport: http(),
        account,
      })

      // Si hay una detección previa con key real de Arkiv, extendemos su lease en la blockchain a 7 días (604800s)
      if (incidente.arkivKey && incidente.arkivKey.startsWith('0x') && incidente.arkivKey.length === 66 && !incidente.arkivKey.includes('Simulated') && !incidente.arkivKey.includes('0xSimulated')) {
        try {
          console.log(`[Arkiv Dispatch] Intentando extender lease de entidad previa: ${incidente.arkivKey}`)
          await walletClient.extendEntity({
            entityKey: incidente.arkivKey as `0x${string}`,
            expiresIn: 604800, // Extender a 7 días
          })
          isLeaseExtended = true
          console.log(`[Arkiv Dispatch] Lease de entidad extendida con éxito: ${incidente.arkivKey}`)
        } catch (extendError) {
          console.warn(`[Arkiv Dispatch] No se pudo extender el lease de la entidad on-chain (puede ser simulada o haber expirado):`, extendError)
        }
      }

      // Creamos la nueva entidad de despacho que representa la validación y el envío de recursos
      const dispatchPayload = {
        action: 'dispatch',
        incidentId: incidente.id,
        detectionKey: incidente.arkivKey || null,
        tipo: incidente.tipo,
        severidad: incidente.severidad,
        ubicacion: incidente.ubicacion,
        afectados: incidente.afectados,
        operator: account.address,
        dispatchedAt: new Date().toISOString(),
      }

      const attributes = [
        { key: 'project', value: 'climate-crisis-dashboard' },
        { key: 'tipo', value: incidente.tipo || 'general' },
        { key: 'severidad', value: incidente.severidad || 'medium' },
        { key: 'ubicacion', value: incidente.ubicacion || 'unknown' },
        { key: 'status', value: 'dispatched' },
        { key: 'track', value: 'arkiv' },
      ]

      if (incidente.arkivKey) {
        attributes.push({ key: 'detectionKey', value: incidente.arkivKey })
      }

      const onChainResult = await walletClient.createEntity({
        payload: jsonToPayload(dispatchPayload),
        contentType: 'application/json',
        attributes,
        expiresIn: 604800, // 7 días
      })
      entityKey = onChainResult.entityKey
    }

    // Fetch existing incident to preserve and merge details
    const { data: existing, error: fetchError } = await supabase
      .from('incidentes')
      .select('*')
      .eq('id', incidente.id)
      .single()

    if (fetchError) {
      console.warn(`[Arkiv Dispatch] Incidente no encontrado para actualizar, procediendo a crear uno.`)
    }

    const currentDetails = existing?.fuente_detalles || {}
    const updatedDetails = {
      ...currentDetails,
      arkiv_entity_key: entityKey, // La clave de despacho
      detection_arkiv_key: incidente.arkivKey || currentDetails.arkiv_entity_key || null, // La clave de detección original
      dispatched_at: new Date().toISOString(),
      lease_extended: isLeaseExtended,
      platform: isSimulated ? 'Climate Crisis Dashboard Operator (Simulado)' : 'Climate Crisis Dashboard Operator',
    }

    const { data: dbIncident, error: updateError } = await supabase
      .from('incidentes')
      .upsert({
        id: incidente.id,
        tipo: incidente.tipo || existing?.tipo || 'general',
        severidad: incidente.severidad || existing?.severidad || 'medium',
        ubicacion: incidente.ubicacion || existing?.ubicacion || 'unknown',
        latitud: existing?.latitud ?? -26.8241,
        longitud: existing?.longitud ?? -65.2226,
        personas_afectadas: incidente.afectados || existing?.personas_afectadas || 0,
        fuente: existing?.fuente || 'social',
        fuente_detalles: updatedDetails,
        estado: 'atendido',
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (updateError) {
      throw new Error(`Fallo al guardar incidente en Supabase: ${updateError.message}`)
    }

    const response: ArkivDispatchResponse = {
      success: true,
      entityKey,
    }

    return NextResponse.json(response)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Fallo al registrar on-chain'
    console.error('[Arkiv Dispatch] Error:', errorMessage)

    const response: ArkivDispatchResponse = {
      success: false,
      error: errorMessage,
    }

    return NextResponse.json(response, { status: 500 })
  }
}
