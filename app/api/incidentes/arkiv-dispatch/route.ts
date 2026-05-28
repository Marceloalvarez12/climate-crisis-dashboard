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

    if (!process.env.ARKIV_PRIVATE_KEY || process.env.ARKIV_PRIVATE_KEY === '0xREEMPLAZAR_CON_TU_PRIVATE_KEY_AQUI') {
      throw new Error('ARKIV_PRIVATE_KEY no configurada en .env.local')
    }

    const account = privateKeyToAccount(process.env.ARKIV_PRIVATE_KEY as `0x${string}`)

    const walletClient = createWalletClient({
      chain: braga,
      transport: http(),
      account,
    })

    const { entityKey } = await walletClient.createEntity({
      payload: jsonToPayload(incidente),
      contentType: 'application/json',
      attributes: [
        { key: 'tipo', value: incidente.tipo || 'general' },
        { key: 'severidad', value: incidente.severidad || 'medium' },
        { key: 'ubicacion', value: incidente.ubicacion || 'unknown' },
        { key: 'status', value: 'dispatched' },
        { key: 'track', value: 'arkiv' },
      ],
      expiresIn: 604800,
    })

    const { data: dbIncident, error: insertError } = await supabase
      .from('incidentes')
      .insert({
        id: incidente.id,
        tipo: incidente.tipo,
        severidad: incidente.severidad,
        ubicacion: incidente.ubicacion,
        latitud: -26.8241,
        longitud: -65.2226,
        personas_afectadas: incidente.afectados,
        fuente: 'social',
        fuente_detalles: {
          arkiv_entity_key: entityKey,
          dispatched_at: incidente.timestamp,
          platform: 'Zntinel Operator',
        },
        estado: 'activo',
        arkiv_key: entityKey,
        created_at: incidente.timestamp,
        updated_at: incidente.timestamp,
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Fallo al guardar incidente en Supabase: ${insertError.message}`)
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
