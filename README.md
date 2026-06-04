# essionix-jobfinder

Pipeline diario que descubre ofertas **contractor / remoto / español** para **DevOps / Cloud / SRE**, las puntúa con Claude y envía un email rankeado (Resend).

## Cómo funciona
GitHub Action (cron diario) → fetchers multi-fuente → normaliza → reglas → dedup contra `state/seen.json` → scorer IA (Claude Haiku) → email con las ofertas nuevas que superan el umbral. El estado se commitea de vuelta al repo para no repetir ofertas.

Fuentes: RemoteOK, Remotive, WeWorkRemotely, Himalayas, GetOnBrd, Torre y LinkedIn (best-effort, endpoint público sin login — sin riesgo para tu cuenta).

## Configuración
1. Edita `config/profile.md` (tu perfil; el scorer puntúa contra esto) y `config/rules.json` (keywords include/exclude + `threshold`, por defecto 65).
2. En GitHub → Settings → Secrets and variables → Actions, define:
   - `ANTHROPIC_API_KEY` — tu API key de Claude.
   - `RESEND_API_KEY` — API key de [Resend](https://resend.com).
   - `DIGEST_TO` — email destino del resumen.
3. El cron corre 07:00 Colombia (12:00 UTC). También puedes dispararlo manual en Actions → jobfinder → Run workflow.

### Email (Resend)
Para pruebas, el remitente por defecto es `onboarding@resend.dev` (no requiere dominio). Para producción, verifica un dominio en Resend y ajusta el `from` en `src/email.ts`.

## Desarrollo local
- `npm install`
- `npm test` — suite completa (Vitest).
- `npm run typecheck` — chequeo de tipos.
- `npm run dry-run` — corre el pipeline e imprime la lista rankeada SIN enviar email ni guardar estado. Requiere `ANTHROPIC_API_KEY` en el entorno y hace requests reales a las fuentes:
  `ANTHROPIC_API_KEY=sk-... npm run dry-run`

## Arquitectura
Spec: `docs/superpowers/specs/2026-06-03-essionix-jobfinder-design.md`
Plan: `docs/superpowers/plans/2026-06-04-essionix-jobfinder.md`

Módulos (`src/`): `fetchers/` (una fuente por archivo, tolerante a fallos) · `normalize.ts` · `rules.ts` · `state.ts` · `scorer.ts` · `email.ts` · `index.ts` (orquestador).
