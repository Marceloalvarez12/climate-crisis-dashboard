import { NextResponse } from 'next/server'
import { createPublicClient, http } from '@arkiv-network/sdk'
import { braga } from '@arkiv-network/sdk/chains'

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

    // Obtener la entidad desde la red de Arkiv (Braga Testnet)
    const entity = await client.getEntity(key as `0x${string}`)

    if (!entity) {
      return NextResponse.json({ error: 'Entidad no encontrada en la blockchain' }, { status: 404 })
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
