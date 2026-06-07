# essionix-jobfinder

Pipeline diario que descubre ofertas **contractor / remoto / español** para **DevOps / Cloud / SRE**, las puntúa con Claude y envía un email rankeado (Gmail SMTP).

## Cómo funciona
GitHub Action (cron diario) → fetchers multi-fuente → normaliza → reglas → dedup contra `state/seen.json` → scorer IA (Claude Sonnet vía Agent SDK) → email con las ofertas nuevas que superan el umbral. El estado se commitea de vuelta al repo para no repetir ofertas.

Fuentes (catálogo de 11): RemoteOK, Remotive, WeWorkRemotely, Himalayas, GetOnBrd, Jobicy, WorkingNomads, Arbeitnow, TheMuse, Torre y LinkedIn (las últimas best-effort, sin login — sin riesgo para tu cuenta).

**Cobertura progresiva:** no se usan los 11 portales de golpe. Arranca con los 5 probados (RemoteOK, Remotive, WeWorkRemotely, Himalayas, GetOnBrd) y **activa 2 portales nuevos cada 2 días** hasta tener los 11 (≈día 6). El estado vive en `state/sources.json` (`activeCount` + `lastExpandedISO`), versionado. Para forzar/reiniciar la cobertura, edita ese archivo (ej. `activeCount: 11` para activarlos todos ya, o `lastExpandedISO: ""` para reiniciar el reloj). El orden de activación es el del array en `src/fetchers/index.ts`.

## Configuración
1. Edita `config/profile.md` (tu perfil; el scorer puntúa contra esto) y `config/rules.json` (keywords include/exclude + `threshold`, por defecto 65).
2. En GitHub → Settings → Secrets and variables → Actions, define:
   - `CLAUDE_CODE_OAUTH_TOKEN` — token de tu suscripción Claude (ver abajo).
   - `GMAIL_USER` — tu cuenta Gmail remitente (ej. `tucuenta@gmail.com`).
   - `GMAIL_APP_PASSWORD` — una App Password de Google (ver abajo).
   - `DIGEST_TO` — email destino del resumen (puede ser el mismo Gmail).
3. El cron corre 07:00 Colombia (12:00 UTC). También puedes dispararlo manual en Actions → jobfinder → Run workflow.

### Scorer IA (suscripción Claude, sin saldo de API)
El scorer usa el **Claude Agent SDK** autenticado con tu **suscripción** (Pro/Max), no con saldo de API:
1. En tu máquina con Claude Code instalado, corre `claude setup-token` → genera un token de ~1 año.
2. Guárdalo como el secret `CLAUDE_CODE_OAUTH_TOKEN`.
3. **No definas `ANTHROPIC_API_KEY`** en el repo: tiene prioridad sobre el token y forzaría cobro por API.

Modelo: `claude-sonnet-4-6` (en suscripción, Haiku solo está por API). El uso del Agent SDK con suscripción tira de una bolsa mensual de créditos separada de tu uso interactivo de Claude Code.

### Email (Gmail SMTP)
El envío usa el SMTP de Gmail vía `nodemailer`. Necesitas una **App Password** (no tu contraseña normal):
1. Activa la verificación en 2 pasos (2FA) en tu cuenta de Google.
2. Ve a https://myaccount.google.com/apppasswords y genera una contraseña de aplicación (16 caracteres).
3. Úsala como `GMAIL_APP_PASSWORD`; pon tu correo en `GMAIL_USER`.

Límite de Gmail: ~500 correos/día (el pipeline envía 1/día). El remitente por defecto es `JobFinder <GMAIL_USER>`; ajústalo en `src/email.ts` si quieres.

## Desarrollo local
- `npm install`
- `npm test` — suite completa (Vitest).
- `npm run typecheck` — chequeo de tipos.
- `npm run dry-run` — corre el pipeline e imprime la lista rankeada SIN enviar email ni guardar estado. Requiere `CLAUDE_CODE_OAUTH_TOKEN` en el entorno (y que `ANTHROPIC_API_KEY` NO esté definido) y hace requests reales a las fuentes:
  `CLAUDE_CODE_OAUTH_TOKEN=... npm run dry-run`

## Arquitectura
Spec: `docs/superpowers/specs/2026-06-03-essionix-jobfinder-design.md`
Plan: `docs/superpowers/plans/2026-06-04-essionix-jobfinder.md`

Módulos (`src/`): `fetchers/` (una fuente por archivo, tolerante a fallos) · `normalize.ts` · `rules.ts` · `state.ts` · `scorer.ts` · `email.ts` · `index.ts` (orquestador).
