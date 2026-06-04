# essionix-jobfinder

Pipeline diario que descubre ofertas **contractor / remoto / español** para **DevOps / Cloud / SRE**, las puntúa con Claude y envía un email rankeado (Gmail SMTP).

## Cómo funciona
GitHub Action (cron diario) → fetchers multi-fuente → normaliza → reglas → dedup contra `state/seen.json` → scorer IA (Claude Haiku) → email con las ofertas nuevas que superan el umbral. El estado se commitea de vuelta al repo para no repetir ofertas.

Fuentes: RemoteOK, Remotive, WeWorkRemotely, Himalayas, GetOnBrd, Torre y LinkedIn (best-effort, endpoint público sin login — sin riesgo para tu cuenta).

## Configuración
1. Edita `config/profile.md` (tu perfil; el scorer puntúa contra esto) y `config/rules.json` (keywords include/exclude + `threshold`, por defecto 65).
2. En GitHub → Settings → Secrets and variables → Actions, define:
   - `ANTHROPIC_API_KEY` — tu API key de Claude.
   - `GMAIL_USER` — tu cuenta Gmail remitente (ej. `tucuenta@gmail.com`).
   - `GMAIL_APP_PASSWORD` — una App Password de Google (ver abajo).
   - `DIGEST_TO` — email destino del resumen (puede ser el mismo Gmail).
3. El cron corre 07:00 Colombia (12:00 UTC). También puedes dispararlo manual en Actions → jobfinder → Run workflow.

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
- `npm run dry-run` — corre el pipeline e imprime la lista rankeada SIN enviar email ni guardar estado. Requiere `ANTHROPIC_API_KEY` en el entorno y hace requests reales a las fuentes:
  `ANTHROPIC_API_KEY=sk-... npm run dry-run`

## Arquitectura
Spec: `docs/superpowers/specs/2026-06-03-essionix-jobfinder-design.md`
Plan: `docs/superpowers/plans/2026-06-04-essionix-jobfinder.md`

Módulos (`src/`): `fetchers/` (una fuente por archivo, tolerante a fallos) · `normalize.ts` · `rules.ts` · `state.ts` · `scorer.ts` · `email.ts` · `index.ts` (orquestador).
