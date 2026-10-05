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

Append `?dev=true` to enable the simulation control panel (bottom-left corner). It has a social post composer (Facebook/Instagram/X), injects citizen ZK reports, and toggles the simulated social feed (one post every 30s).

## Social Hashtag Trigger

Social incidents are created ONLY from posts containing the trigger hashtag (`#AlertaTucuman`, override with `NEXT_PUBLIC_TRIGGER_HASHTAG`). There is no random incident spawning anymore.

- Single pipeline: `lib/services/social-incident-service.ts` → `ingestSocialPost()` (hashtag filter → dedup by post id → LLM/heuristic analysis → gazetteer geocoding → corroborate or create).
- Entry points: `POST /api/social/mention` (webhook, supports `?dryRun=true`) and `SocialMediaAgent.runScan()` (`POST /api/agent`).
- Analyzer fallback chain: OpenRouter → Gemini → `lib/agents/heuristic-analyzer.ts` (rule-based, no key needed).
- Isomorphic helpers (safe in client): `lib/agents/hashtag.ts`, `lib/agents/tucuman-gazetteer.ts`, `lib/social-feed-simulator.ts`.
- Active social incidents show in the map's Active tab with a "Pending Validation" badge; posts dedup via `fuente_detalles.related_post_ids`.
- Without `.env.local` only `dryRun` works (Supabase client throws at import; the service imports it lazily).
- Quick check: `curl -X POST "localhost:3000/api/social/mention?dryRun=true" -H "Content-Type: application/json" -d '{"platform":"facebook","author":"x","text":"Incendio en Yerba Buena #AlertaTucuman"}'`

## Environment Variables (.env.local)

Critical env vars (see `.env.local` for actual values used in this repo):

- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase client
- `SUPABASE_SERVICE_ROLE_KEY` — Server-side Supabase (bypasses RLS)
- `GOOGLE_AI_API_KEY` — Gemini API for AI analysis
- `API_SECRET` + `NEXT_PUBLIC_API_SECRET` — Protects `/api/*` routes via middleware
- `ARKIV_PRIVATE_KEY` — Blockchain signing key (**never prefix with NEXT_PUBLIC_**)

Arkiv dispatch endpoint falls back to simulated mode if `ARKIV_PRIVATE_KEY` is `'0xREEMPLAZAR_CON_TU_PRIVATE_KEY_AQUI'`.

## API Security

All `/api/*` routes (except `PUBLIC_PATHS` in `middleware.ts`: `/api/analytics`, `/api/incidentes/arkiv-verify`, `/api/layers/*`, `/api/public/*`, health/version) require either:
- Header: `x-api-secret: <API_SECRET>`
- Query param: `?secret=<API_SECRET>`

Rate limiting is applied via `lib/rate-limit.ts`.

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
- **Next.js build** — `next.config.mjs` has `typescript.ignoreBuildErrors: true`. TypeScript strict mode is enabled but not enforced at build time.
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
- **API Secret exposed to client**: `NEXT_PUBLIC_API_SECRET` is bundled in client-side JavaScript. In production, use Supabase RLS or JWT-based auth instead of shared secrets.
- **Credentials in `.env.local`**: Contains real Supabase service role key, Gemini API key, and Arkiv private key. Ensure `.env.local` is never committed to git.

### Performance
- **Sequential queries per mention**: `ingestSocialPost()` runs up to 4 sequential Supabase queries per hashtag post (dedup, location, count, insert). Consider an RPC if volume grows.

### Pre-existing type errors
- `npx tsc --noEmit` reports 2 errors in `components/dashboard/crisis-map/map-inner.tsx` (`eventHandlers` on `MapContainer`). Build ignores TS errors.

### Architecture
- **Middleware deprecation**: Next.js 16 marks `middleware.ts` as deprecated in favor of "proxy". Current implementation works but should be migrated.
- **Rate limiting limitations**: In-memory rate limiter doesn't work across serverless instances. For production, use Upstash Redis or Vercel KV.

## Testing

No test suite configured. Manual testing via `?dev=true` simulation panel.
