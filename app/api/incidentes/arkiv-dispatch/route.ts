import { NextResponse } from 'next/server'
import { createWalletClient, http } from '@arkiv-network/sdk'
import { braga } from '@arkiv-network/sdk/chains'
import { privateKeyToAccount } from '@arkiv-network/sdk/accounts'
import { jsonToPayload } from '@arkiv-network/sdk/utils'
import type { EmergencyIncident, ArkivDispatchResponse } from '@/lib/types'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request): Promise<Response> {
  try {
    const incidente: EmergencyIncident = await request.json()

    let entityKey = ""
    let isSimulated = false

    if (!process.env.ARKIV_PRIVATE_KEY || process.env.ARKIV_PRIVATE_KEY === '0xREEMPLAZAR_CON_TU_PRIVATE_KEY_AQUI') {
      entityKey = `0x${Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join("")}`
      isSimulated = true
      console.warn(`[Arkiv Dispatch] (Simulated Mode) ARKIV_PRIVATE_KEY not set. Generating simulated entityKey: ${entityKey}`)
    } else {
      const account = privateKeyToAccount(process.env.ARKIV_PRIVATE_KEY as `0x${string}`)

      const walletClient = createWalletClient({
        chain: braga,
        transport: http(),
        account,
      })

      const onChainResult = await walletClient.createEntity({
        payload: jsonToPayload(incidente),
        contentType: 'application/json',
        attributes: [
          { key: 'project', value: 'climate-crisis-dashboard' },
          { key: 'tipo', value: incidente.tipo || 'general' },
          { key: 'severidad', value: incidente.severidad || 'medium' },
          { key: 'ubicacion', value: incidente.ubicacion || 'unknown' },
          { key: 'status', value: 'dispatched' },
          { key: 'track', value: 'arkiv' },
        ],
        expiresIn: 604800,
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
      arkiv_entity_key: entityKey,
      dispatched_at: new Date().toISOString(),
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
