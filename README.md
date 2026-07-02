# Climate Crisis Dashboard — Tucumán

Dashboard inteligente de gestión de emergencias climáticas en tiempo real para **San Miguel de Tucumán**, Argentina.

Combina **inteligencia artificial**, **blockchain (Arkiv)** y **pruebas de conocimiento cero (Stellar/Soroban)** para demostrar cómo una ciudad puede recibir, validar, despachar y auditar emergencias sin depender únicamente de líneas 911 saturadas.

---

## 🎯 Propósito del proyecto

Durante una catástrofe climática las líneas de emergencia colapsan, los reportes falsos se multiplican y la ciudad pierde tiempo valioso validando información. Este sistema propone un centro de crisis digital que:

1. **Escucha** múltiples fuentes: redes sociales (simuladas), sensores, cámaras y **reportes ciudadanos**.
2. **Valida** con IA si un reporte describe una emergencia real, estimando severidad, ubicación y afectados.
3. **Despacha** recursos y audita cada acción en blockchain (Arkiv Braga Testnet).
4. **Permite reportes ciudadanos anónimos verificables** mediante ZK (Stellar Hacks), donde el vecino demuestra que está dentro de una zona de riesgo oficial sin revelar su ubicación exacta.
5. **Expone** toda la trazabilidad en portales públicos de auditoría.

---

## 🚀 Demo principal

La URL más importante para el hackathon es el dashboard con el panel de simulación:

```
http://localhost:3000?dev=true
```

El parámetro `?dev=true` activa el panel de simulación en la esquina inferior izquierda, desde donde podés:

- Inyectar reportes ciudadanos ZK manualmente.
- Iniciar/detener la simulación dinámica.
- Limpiar incidentes simulados.
- Despachar recursos y ver cómo se registran en Arkiv.

---

## 🏢 Arquitectura

| Capa | Tecnología | Rol |
|------|-----------|-----|
| Frontend & routing | Next.js 16 (App Router) + TypeScript | Dashboard, mapa, portales públicos |
| Estilos | Tailwind CSS v4 + Radix UI + shadcn/ui | UI oscura premium, responsiva |
| Mapas | Leaflet + React-Leaflet | Visualización georreferenciada de incidentes |
| Base de datos | Supabase (PostgreSQL + Realtime) | Persistencia, WebSockets, historial |
| Inteligencia artificial | Google Gemini 2.0 Flash — con OpenRouter como alternativa gratuita | Análisis de posts y reportes |
| Blockchain principal | Arkiv Network (Braga Testnet) | Auditoría inmutable de detecciones IA y despachos |
| Reporte ciudadano ZK | Circom 2.0 + snarkjs (Groth16) + Stellar/Soroban simulado | Privacidad verificable sin revelar ubicación exacta |

---

## 🔑 Flujos del sistema

### 1. Detección IA y despacho auditable (Arkiv)

```
Redes sociales / sensores / cámaras
        ↓
  SocialMediaAgent (IA)
        ↓
   Incidente en Supabase
        ↓
  Operador despacha recurso
        ↓
  Firma en Arkiv Braga Testnet
        ↓
  Portal /auditoria + seguimiento
```

- El agente de IA analiza posts y detecta emergencias.
- Cada incidente puede recibir un despacho de recursos.
- El despacho se firma en la blockchain de Arkiv, generando una entidad inmutable.
- El ciudadano y el operador pueden consultar la trazabilidad en `/auditoria`.

### 2. Reporte ciudadano anónimo verificable (Stellar ZK)

```
Ciudadano entra a /reportar
        ↓
  Ingresa tipo, severidad y datos aproximados
        ↓
  Navegador envía lat/lng reales al backend
        ↓
  Backend genera proof Circom/Groth16
        ↓
  Verifica localmente con snarkjs
        ↓
  Persiste incidente con fuente="citizen"
        ↓
  Ciudadano ve seguimiento en /seguimiento/[id]
```

- El ciudadano demuestra que está dentro de una zona de riesgo oficial.
- El proof es públicamente verificable; la ubicación exacta no se expone en la prueba.
- El sistema guarda la ubicación exacta sólo en la base de datos operativa para mostrar el punto en el mapa.
- Endpoints:
  - `POST /api/incidentes/zk-verify` — público, genera y verifica un proof sin persistir.
  - `POST /api/incidentes/zk-report` — protegido, flujo completo con persistencia.
  - `POST /api/incidentes/zk-report?dryRun=true` — flujo completo sin tocar la base de datos.

### 3. Seguimiento ciudadano

Cualquier persona puede entrar a:

```
/seguimiento/[id-del-incidente]
```

Y ver:

- Estado del reporte (activo / atendido / resuelto).
- Verificación ZK sellada.
- Auditoría Arkiv cuando el incidente recibió despacho.
- Timestamp y link al explorador.

---

## 🔐 Variables de entorno

Crear `.env.local` en la raíz del proyecto:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# Google AI Studio (Gemini) — usado como analizador principal o fallback
GOOGLE_AI_API_KEY=tu-gemini-api-key

# OpenRouter (alternativa gratuita a Gemini)
OPENROUTER_API_KEY=sk-or-v1-tu-openrouter-key
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct

# Seguridad de API
API_SECRET=clave-aleatoria-de-api
NEXT_PUBLIC_API_SECRET=clave-aleatoria-de-api

# Blockchain Arkiv
ARKIV_PRIVATE_KEY=0x_tu_private_key_aqui

# Stellar / Soroban (ZK verifier)
# El contrato verifier está desplegado en Stellar TESTNET:
#   CCX7FMGEF627I74U37ABFYIYJYGXVHHULN5JC5VLXAOG2NU3LB5YUCGM
# `verify_and_store` (no read-only) crea una TX real on-chain y persiste un AuditRecord.
# Sin `STELLAR_SECRET_KEY` válida, el sistema cae a modo simulado (snarkjs local).
STELLAR_SECRET_KEY=SCGSTV73HMPAFVB2TJ3YJ5M2QLK3RAEDUE2NGJUP3YGHAE3AEUWUBCIL
```

> ⚠️ **Nunca subís `.env.local` a git.** El repositorio ya ignora archivos `.env*`.

---

## 🎮 Instalación y ejecución local

```bash
npm install
npm run dev
```

Abrir:

```
http://localhost:3000?dev=true
```

Para probar reportes ciudadanos ZK:

```
http://localhost:3000/reportar
```

Para auditoría de proofs:

```
http://localhost:3000/stellar-auditoria
```

Para auditoría Arkiv:

```
http://localhost:3000/auditoria
```

---

## 📋 Estado de las integraciones

| Integración | Estado | Notas |
|-------------|--------|-------|
| Supabase Realtime | ✅ Funcional | Incidentes y recursos en tiempo real |
| Arkiv Braga Testnet | ✅ Funcional | Despacho y auditoría on-chain reales |
| Gemini 2.0 Flash | ✅ Funcional | Análisis de posts; requiere `GOOGLE_AI_API_KEY` |
| OpenRouter | ✅ Funcional | Alternativa gratuita; requiere `OPENROUTER_API_KEY` |
| Circom/Groth16 proof | ✅ Funcional | Verificación local con `snarkjs` |
| Stellar/Soroban verifier | ✅ Desplegado | Contrato `CCX7FMGEF627I74U37ABFYIYJYGXVHHULN5JC5VLXAOG2NU3LB5YUCGM` en testnet; `verify_and_store` persiste audit on-chain |

## 🔗 Evidencia Stellar/Soroban (ejemplo histórico)

- **Operator account:** `GDAA5YJMSKHH2IKPNDIG252KKT2PSHVDLLURPQKYRGFSD4HHIJB5MBOR`
- **Verifier contract:** `CCX7FMGEF627I74U37ABFYIYJYGXVHHULN5JC5VLXAOG2NU3LB5YUCGM`
- **WASM upload tx:** [eb47c317…fa14a](https://stellar.expert/explorer/testnet/tx/eb47c317ffb0b873c3ca538ac97835ca17347e5431c163b96d24d18d5a9fa14a)
- **Contract deploy tx:** [f572660c…b20c7f](https://stellar.expert/explorer/testnet/tx/f572660c59e8386e6157523d70a6cede541e29d25851200f57522a15ffb20c7f)
- **Sample verify_and_store tx:** [7e664d9f…ac808](https://stellar.expert/explorer/testnet/tx/7e664d9f01e1fe82bb506fa1441059e295baf681e1766ef31935c4045a6ac808) (audit stored: `valid=true`, `operator=GDAA5Y…`, `journal_digest_lo/hi` populated)
- **End-to-end HTTP demo tx (incident `dbb10422-…`):** [dc531277…4b710](https://stellar.expert/explorer/testnet/tx/dc531277bc51b77dfffa0c01d771fc804bf8dd8d457928b92e91b18013e4b710) (proof generado por snarkjs, verificado y persistido on-chain vía `/api/incidentes/zk-report`)
- **Explorador del contrato:** [Ver contrato en Stellar Expert](https://stellar.expert/explorer/testnet/contract/CCX7FMGEF627I74U37ABFYIYJYGXVHHULN5JC5VLXAOG2NU3LB5YUCGM)

---

## 📝 Notas de arquitectura

- **Simulación controlada**: el panel `?dev=true` tiene límite de 5 incidentes activos, auto-resolución a los 2 minutos y limpieza manual para evitar que la base de datos se llene como ocurría con versiones anteriores.
- **Middleware de seguridad**: los endpoints `/api/*` requieren `x-api-secret` salvo los marcados como públicos (`/api/analytics`, `/api/incidentes/zk-verify`, `/api/incidentes/[id]` para seguimiento ciudadano).
- **Fuentes del sistema**: se reemplazaron las fuentes Google por fuentes del sistema para evitar fallas de build offline.

---

## 🔗 Evidencia Arkiv (ejemplo histórico)

- **Dirección del operador:** `0xb5443307029efA0a1F1BF44421CCCaF3249ac0e4`
- **Entity Key en Braga Testnet:** `0x5d0d95f154889e650afe18c6c4a86d2ada55ca8a238061776a03f0878cec3558`
- **Explorador:** [Ver entidad auditada](https://explorer.braga.hoodi.arkiv.network/entity/0x5d0d95f154889e650afe18c6c4a86d2ada55ca8a238061776a03f0878cec3558)

---

## 👥 Equipo

- **Participante:** Alvarez, Marcelo Simón
- **Rol:** Fullstack Developer & Web3/AI Integrator
- **Repositorio:** [climate-crisis-dashboard](https://github.com/Arkiv-Network/arkiv-puna-tech-hackathon)

---

## 🌟 Tracks presentados

- **Arkiv × Puna Tech Builder Challenge 2026:** auditoría on-chain de detecciones IA y despachos operativos.
# Stellar Hacks: Real-World ZK — reporte ciudadano anónimo verificable con Circom + Groth16 on-chain en Soroban.
