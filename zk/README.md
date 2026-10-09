# Artefactos de ubicación ZK

El servidor necesita estos archivos versionados, fuera de `public/`:

- `build/zone_membership_js/zone_membership.wasm`
- `build/zone_membership_final.zkey`
- `build/verification_key.json`
- `build/manifest.json` (SHA-256 y procedencia)

Tras `npm ci`, ejecutar `npm run zk:check`. Genera y verifica pruebas reales
para un punto interior y los límites, rechaza señales/pruebas alteradas,
ubicaciones fuera del rectángulo y valores que desbordan los comparadores.
Las seis señales públicas son `out`, `minLat`, `maxLat`, `minLng`, `maxLng`,
`zoneHash`; `lat` y `lng` son privadas en el circuito. El servidor recibe y
almacena las coordenadas exactas: esta prueba no las oculta al operador.
La zona habilitada es el rectángulo -27…-26.5 / -65.5…-65, no toda la provincia.

## Generación inicial

`npm run zk:setup` compila Circom con versiones fijadas de `circom2` y
`circomlib`, genera un Powers of Tau BN254 (potencia 10), aporta entropía
criptográfica del sistema operativo en ambas fases, verifica el transcript
y la zkey, y exporta la clave local y los bytes para Soroban.
La entropía no se imprime ni se escribe a disco. Los transcripts públicos y
R1CS se conservan en `zk/.setup-*/`, excluidos de Git.

Los artefactos incluidos usan un **setup local de un participante**. Su
seguridad depende de que ese participante elimine el material secreto de
la ceremonia. Para producción con confianza distribuida, coordinar una
ceremonia con participantes independientes según la documentación de
[snarkjs](https://github.com/iden3/snarkjs). Esta generación no acredita una
ceremonia multiparte ni una auditoría externa.

El comando rechaza reemplazar artefactos existentes. Una rotación requiere
preservar las claves anteriores para verificar reportes históricos,
generar un conjunto nuevo coordinadamente y actualizar Soroban. No generar
claves nuevas en cada build o en CI: las pruebas anteriores dejarían de
verificar con la clave nueva.

## Despliegue Next.js

`npm run build` verifica primero los hashes y la coincidencia de la clave
Rust con la local. `next.config.mjs` incluye los artefactos en las funciones
ZK y la clave en las rutas Stellar mediante `outputFileTracingIncludes`.
Publicar los binarios junto con los cambios de código; no hace falta
instalar Circom ni ejecutar una ceremonia en el hosting. Si falta un
archivo o cambia el circuito, el prebuild falla. En ejecución se mantiene
el rechazo de reportes cuando faltan los artefactos.

## Stellar/Soroban

`contracts/zone_verifier/src/verification_key.rs` se genera desde la misma
clave que usa snarkjs. El contrato ya publicado contiene otra clave y
necesita recompilarse y desplegarse para aceptar estas pruebas. Un cambio
en el código Rust no actualiza el contrato publicado.

Hasta completar esa actualización se usa verificación local. Para activar
la verificación on-chain, configurar `STELLAR_SECRET_KEY`, el identificador
del contrato y `STELLAR_ZK_VK_SHA256` con el hash de
`zk/build/verification_key.json` presente en `manifest.json`, después de
confirmar que el contrato usa esa misma clave. Ningún secreto Stellar se
requiere para las comprobaciones locales.
