# AGENTS.md

## Project Overview

Next.js 16 (App Router) + TypeScript dashboard for climate emergency management in San Miguel de Tucumán. Integrates Supabase (PostgreSQL + Realtime), Google Gemini AI, and Arkiv Blockchain (Braga Testnet).

## Developer Commands

```bash
npm install      # Install dependencies
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint check
```

## Dev Mode

In local development only, append `?dev=true` to enable the simulation control panel (bottom-left corner). It has a social post composer (Facebook/Instagram/X), injects citizen ZK reports, and toggles the simulated social feed. The panel is unavailable in production and simulated social mentions are rejected outside development.

## Social Hashtag Trigger

Social incidents are created ONLY from posts containing the trigger hashtag (`#AlertaTucuman`, override with `NEXT_PUBLIC_TRIGGER_HASHTAG`). There is no random incident spawning anymore.

- Single pipeline: `lib/services/social-incident-service.ts` → `ingestSocialPost()` (hashtag filter → dedup by post id → LLM/heuristic analysis → gazetteer geocoding → corroborate or create).
- Entry points: `POST /api/social/mention` (webhook, supports `?dryRun=true`) and `SocialMediaAgent.runScan()` (`POST /api/agent`).
- `UsgsConnector` and `EonetConnector` are not active sources: incidents require an incoming citizen report or social mention. The dashboard no longer triggers agent scans. Historical USGS/EONET rows remain in Supabase but are excluded from incident reads and analytics with `isNonReportIncident`; do not delete them without approval. `/api/incidentes/respawn` returns 410. Real reports are not auto-resolved or expired by simulation maintenance.
- Analyzer fallback chain: OpenRouter → Gemini → `lib/agents/heuristic-analyzer.ts` (rule-based, no key needed).
- Isomorphic helpers (safe in client): `lib/agents/hashtag.ts`, `lib/agents/tucuman-gazetteer.ts`, `lib/social-feed-simulator.ts`.
- Active social incidents show in the map's Active tab with a "Pending Validation" badge; posts dedup via `fuente_detalles.related_post_ids`.
- Without `.env.local`, Supabase-backed flows cannot be verified. `dryRun` for the social endpoint still requires an authenticated operator/admin session or `API_SECRET` in the server-to-server header; production rejects dry-runs.
- Citizen ZK reports require real `zk/build/` wasm/zkey/verification_key.json artifacts. Missing artifacts or failed verification return an error, never a synthetic proof. The circuit declares coordinates private, but exact coordinates remain in operational DB fields; public map responses are approximate.
- Quick check (with a staff session): `curl -X POST "localhost:3000/api/social/mention?dryRun=true" -H "Content-Type: application/json" -d '{"platform":"facebook","author":"x","text":"Incendio en Yerba Buena #AlertaTucuman"}'`

## Environment Variables (.env.local)

Critical env vars (see `.env.local` for actual values used in this repo):

- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase client + Auth
- `SUPABASE_SERVICE_ROLE_KEY` — Server-side Supabase (bypasses RLS); required for admin user management
- `GOOGLE_AI_API_KEY` — Gemini API for AI analysis
- `API_SECRET` — Server-to-server auth for social/agent APIs only. Never set `NEXT_PUBLIC_API_SECRET` (old deployed value must be rotated if it was shared).
- `ARKIV_PRIVATE_KEY` — Blockchain signing key (**never prefix with NEXT_PUBLIC_**)

Arkiv dispatch endpoint falls back to simulated mode if `ARKIV_PRIVATE_KEY` is `'0xREEMPLAZAR_CON_TU_PRIVATE_KEY_AQUI'`.

## Auth & User Management (Supabase Auth, shared project)

- Staff sign-in at `/login` → `app/login/actions.ts` (Supabase `signInWithPassword`, then checks `public.perfiles.rol`/`status`).
- Password recovery: `/recuperar` (request email) → `/auth/callback` (exchanges `code` for session) → `/restablecer` (new password). Requires Supabase Auth Site URL + Redirect URLs configured.
- `/admin` is admin-only with a sidebar layout (`?section=`): **control** (agent kill switch → `config_sistema.agent_mode`, gates agent and social webhook; disabled if unavailable), **thresholds** (`auto_resolve_minutes` → auto-resolve cutoff, `confidence_threshold` → ingest minimum), **connections** (read-only configured flags, secrets must be managed in the hosting secrets manager), **users** (roles, suspend, reset password, create operator, assign resources), **resources** (full CRUD via `/api/recursos`). Components live in `components/admin/` (ported from the PMV branch).
- Every admin action calls `registrar_auditoria` RPC via the **session** client (it uses `auth.uid()` — never via the service client).
- `/api/recursos`: GET any active staff; PATCH dispatch fields (estado/incidente_id/cantidad_disponible) admin/operador only; PATCH `retired` and card edits plus POST/DELETE admin-only. Needs `supabase-migration-recursos-cantidad.sql` for the `cantidad`/`cantidad_disponible` columns (GET degrades gracefully without it). Real dispatches require an operator action: browser timers and automatic reset never release them; a concurrent claim returns `409`, and partial dispatches remain visible for reconciliation without marking the incident attended.
- `lib/services/config-service.ts` — `getSystemConfig`/`getConfigNumber`, tolerant reads of `config_sistema` with 10s cache. Agent/social ingest fail closed when `agent_mode` is absent or unavailable.
- `lib/supabase-auth.ts` — `createAuthClient()` (SSR cookie client), `requireStaff(role)`, `auditAdmin()`.
- `proxy.ts` enforces: public pages (`/login`, `/recuperar`, `/restablecer`, `/auth/callback`, `/mapa`, `/reportar`, `/seguimiento/*`, `/auditoria*`), protected pages need an active `perfiles` row, `/admin` needs `rol = "admin"`, non-GET APIs need `admin`/`operador`. Service APIs (`/api/agent`, `/api/social/mention`) also accept `x-api-secret`; ZK citizen reporting is public.
- DB schema comes from the `Zntinel-PMV` branch of `v0-climate-crisis-dashboard` (`supabase-setup.sql` + `supabase-rls-policies.sql`): `perfiles`, `config_sistema`, `auditoria_admin`, `asignaciones_recursos`.
- **Required migration**: run `supabase-auth-hardening.sql` on the shared Supabase project — fixes the `handle_new_user` trigger so self-signups can't grant themselves roles via `raw_user_meta_data`; new profiles start as `operador`/`suspendido` until an admin activates them. It also creates `replace_operator_resources`, a transaction-atomic admin-only replacement with audit.

## API Security

All `/api/*` routes (except `PUBLIC_APIS` in `proxy.ts`: `/api/analytics`, `/api/incidentes/arkiv-verify`, `/api/incidentes/zk-report`, `/api/incidentes/zk-verify`, `/api/layers/*`, `/api/public/*`, `/api/stellar`, GET `/api/incidentes/{uuid}`, health/version) require a Supabase session — service APIs (`/api/agent`, `/api/social/mention`) additionally accept `x-api-secret: <API_SECRET>` for server-to-server calls. `zk-report` is intentionally public (anonymous citizen reports; Zod validation + rate limit).

Rate limiting is applied via `lib/rate-limit.ts`: Redis REST with atomic Lua counters when `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are configured; bounded local counters otherwise. `RATE_LIMIT_REQUIRE_DISTRIBUTED=true` requires Redis and rejects APIs with 503 on missing configuration/outages. Limits: 200 API requests/min, 3 citizen report attempts/10min, 10 ZK proof generations/min per IP. The proxy rejects API bodies larger than 256 KiB before parsing them. See `docs/rate-limiting.md`; the hosting proxy must sanitize client IP headers.

## Architecture

- `app/` — Next.js App Router pages and API routes
- `app/api/incidentes/` — Core API routes for incident management
- `app/api/agent/` — AI agent endpoint (Gemini analysis)
- `app/auditoria/page.tsx` — Public blockchain audit portal (`/auditoria`)
- `app/mapa/page.tsx` — Public read-only live map (`/mapa`); backed by `app/api/public/incidentes` (sanitized fields, no `fuente_detalles`)
- `lib/services/` — Business logic layer (IncidentService, ArkivService, api-response helpers)
- `lib/supabase.ts` — Server-side Supabase client (service role)
- `lib/supabase-client.ts` — Client-side Supabase client (anon key, for Realtime)
- `lib/config.ts` — Centralized constants (limits, timeouts, coordinates, keywords)
- `lib/agents/` — Social media connectors and Gemini analyzer
- `hooks/` — Custom React hooks (simulation, realtime, etc.)

## Framework Quirks

- **Tailwind CSS v4** — Uses CSS-based config in `app/globals.css`, no `tailwind.config.js`. PostCSS plugin is `@tailwindcss/postcss`.
- **Next.js build** — TypeScript errors fail the build. Production build needs Supabase environment variables at build time because several API routes load the service client eagerly.
- **shadcn/ui** — Components use `components.json` schema. Aliases: `@/components/ui`, `@/lib/utils`, `@/hooks`.
- **Arkiv SDK** — Uses `@arkiv-network/sdk` with `braga` chain and `http()` transport for wallet client.

## Key Integrations

### Arkiv Blockchain
- Network: Braga Testnet
- Explorer: `https://explorer.braga.hoodi.arkiv.network/entity/{entityKey}`
- Dispatch creates entity with 7-day lease; AI detection entities start with 1-hour lease
- `ArkivService` in `lib/services/arkiv-service.ts` handles all blockchain operations with automatic simulated mode fallback

### Supabase Realtime
- WebSocket connections for live incident updates
- Tables: `incidentes`, `recursos`
- Service role key required for server-side operations
- Use `lib/supabase.ts` for server-side, `lib/supabase-client.ts` for client-side

### Google Gemini
- Model: `gemini-2.0-flash`
- Used by `SocialMediaAgent` for filtering and severity classification

## Code Conventions

- **API Routes** use `lib/services/api-response.ts` helpers (`apiSuccess`, `apiError`, `apiValidationError`, `apiNotFound`)
- **Business logic** lives in `lib/services/` — route handlers should be thin wrappers
- **Constants** are centralized in `lib/config.ts` — avoid magic numbers in code
- **Validation** uses Zod schemas in `lib/validation.ts`

## Known Issues (To Be Addressed)

### Security
- Rotate `API_SECRET` if it was ever deployed as `NEXT_PUBLIC_API_SECRET`; removing it from the source does not invalidate already published bundles.
- Enable the configured distributed rate limiter in production; IP quotas still need a trusted proxy and edge protection against distributed abuse.
- Admin actions that change Supabase Auth and `perfiles` span two services and cannot be made atomic by a database transaction alone. Monitor and reconcile partial failures.
- Never commit `.env.local` or secrets; keep service role, Gemini and blockchain keys server-side.

### Performance
- **Sequential queries per mention**: `ingestSocialPost()` runs up to 4 sequential Supabase queries per hashtag post (dedup, location, count, insert). Consider an RPC if volume grows.

### Validation
- `npm run lint` requires zero warnings. `npm test` covers the rate limiter without external services. `npx tsc --noEmit` and lint should run before publishing.

### Architecture
- **Next.js request gate**: Auth and rate limiting use the Next.js 16 `proxy.ts` convention.
- **Rate limiting activation**: Without Redis env vars, counters remain local. Configure Redis and `RATE_LIMIT_REQUIRE_DISTRIBUTED=true` for shared enforcement across serverless instances.

## Testing

`npm test` runs rate limiter tests; `npm run zk:check` generates and verifies real ZK proofs. Manual dashboard testing via `?dev=true` simulation panel.
