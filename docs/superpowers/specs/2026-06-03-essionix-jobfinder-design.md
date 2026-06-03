# Essionix JobFinder — Diseño

**Fecha:** 2026-06-03
**Autor:** Alejandro Barrera
**Estado:** Aprobado para implementación

## Objetivo

Automatizar el **descubrimiento y filtrado** de ofertas de empleo tipo **contractor, remoto, en español** para perfiles **DevOps / Cloud / SRE**. Cada día llega un email con una lista rankeada de ofertas nuevas que encajan, con link directo para postular. La postulación final es manual (decisión consciente, sin riesgo para cuentas).

**No-objetivos (YAGNI):** auto-postular, scrapear LinkedIn con sesión autenticada, dashboard web, seguimiento de estado de postulaciones. Quedan fuera de este spec.

## Perfil de referencia (para el scorer)

Alejandro Barrera — Cloud Engineer Sr, Colombia (GMT-5), ~11 años.

- **Foco:** Cloud / SRE / DevOps.
- **Stack:** AWS (EC2, RDS, VPC, S3, IAM, Route53, CloudWatch, SNS, ELB, CloudFront), Terraform / IaC, CI/CD, Linux/RHEL.
- **DBA senior (diferenciador):** Oracle OCP 12c (RAC, ASM, DataGuard, Multitenant), SQL Server, MySQL, PostgreSQL.
- **Idioma:** Español.
- **Busca:** contractor / freelance, 100% remoto, mercado hispanohablante (LatAm / España).

El perfil vive en `config/profile.md` (editable) y se inyecta al scorer como contenido cacheado.

## Arquitectura

GitHub Action programada (cron diario) ejecuta un único pipeline en TypeScript/Node. Sin servidor; el estado se versiona en el repo.

```
cron diario (GitHub Actions)
  └─ pipeline:
       fetchers → normalize → reglas → LLM score → dedup → email
                                                       ↓
                                          state/seen.json (commit)
```

Secuencia idempotente: solo se notifican ofertas **nuevas** (no vistas antes) que pasen el pre-filtro por reglas **y** obtengan score ≥ umbral.

## Componentes

Cada componente es un módulo aislado con interfaz definida, testeable por separado.

### 1. Fetchers (`src/fetchers/`)

Un módulo por fuente. Interfaz común:

```ts
interface Fetcher {
  name: string;
  fetch(): Promise<RawJob[]>;  // tolerante a fallos: un error → [] + log, no rompe el pipeline
}
```

Fuentes (acceso limpio, JSON/RSS):

| Fuente        | Acceso                | Notas                          |
|---------------|-----------------------|--------------------------------|
| RemoteOK      | JSON API pública      | `https://remoteok.com/api`     |
| Remotive      | JSON API pública      | filtra por categoría devops    |
| WeWorkRemotely| RSS por categoría     | DevOps/SysAdmin feed           |
| Himalayas     | JSON API pública      | remoto global                  |
| GetOnBrd      | API pública           | foco LatAm/español             |
| Torre         | API pública (search)  | foco LatAm                     |
| LinkedIn      | endpoint *guest* jobs | best-effort, sin login/sesión  |

LinkedIn usa el endpoint público `jobs-guest/jobs/api/seeMoreJobPostings/search` (sin autenticación, devuelve tarjetas HTML). Es best-effort: si responde 999/cambia/cae, se loguea y el pipeline continúa con el resto. **No se usa la cuenta del usuario** → sin riesgo de baneo.

Agregar una fuente nueva = un archivo en `src/fetchers/` que implementa `Fetcher`. Sin tocar el resto.

### 2. Normalizador (`src/normalize.ts`)

Convierte `RawJob` (formato por fuente) → `Job` (esquema común):

```ts
interface Job {
  id: string;          // hash estable de (fuente + url) → clave de dedup
  title: string;
  company: string;
  location: string;
  remote: boolean;
  url: string;
  description: string;
  postedAt: string | null;  // ISO 8601
  source: string;
  salary: string | null;
}
```

### 3. Pre-filtro por reglas (`src/rules.ts`)

Filtro barato (sin IA) que descarta el grueso del ruido:

- **Remoto:** debe ser remoto (campo `remote` o keywords "remote/remoto" en location/descripción).
- **Rol:** keywords incluyentes — devops, sre, site reliability, cloud, platform engineer, infrastructure, aws, terraform, kubernetes, dba, oracle, database.
- **Red-flags (excluyentes):** on-site, presencial, hybrid-required, "junior" como único nivel, idiomas no-español/inglés requeridos como excluyente.

Configurable en `config/rules.json` (listas de keywords incluyentes/excluyentes). Devuelve solo las candidatas que pasan.

### 4. Scorer IA (`src/scorer.ts`)

Para cada candidata que sobrevive a reglas y dedup, llama a Claude (modelo Haiku o Sonnet) y obtiene:

```ts
interface Score {
  score: number;        // 0-100
  reason: string;       // 1-2 frases: por qué encaja o no
  highlights: string[]; // puntos del perfil que matchean (ej. "Terraform", "Oracle RAC")
}
```

- El **perfil** (`config/profile.md`) se envía como bloque **cacheado** (prompt caching) — constante entre llamadas, costo mínimo.
- Salida estructurada vía tool use / JSON schema para evitar parseo frágil.
- Umbral por defecto: **65** (configurable en `config/rules.json`). Solo ofertas ≥ umbral entran al email.
- Costo estimado: centavos/día (decenas de candidatas tras el pre-filtro).

### 5. Estado / Dedup (`src/state.ts` + `state/seen.json`)

- `state/seen.json`: mapa `{ jobId: firstSeenISO }` de ofertas ya notificadas.
- El dedup ocurre **antes del scorer** (no gastar IA en ofertas ya vistas).
- Tras enviar el email, se agregan los nuevos `jobId` y el workflow commitea el archivo de vuelta al repo.
- Limpieza: entradas con `firstSeen` > 60 días se purgan (mantiene el archivo acotado).

### 6. Email (`src/email.ts`)

- Envío vía **Resend** (free tier) usando `RESEND_API_KEY`.
- Plantilla HTML: lista rankeada (mayor score primero), cada item con título, empresa, fuente, score, motivo, highlights y botón "Postular" → url.
- Si no hay ofertas nuevas que superen el umbral, **no se envía email** (cero ruido).
- Destinatario configurable (`config/profile.md` o secret `DIGEST_TO`).

### 7. Orquestación (`src/index.ts` + `.github/workflows/jobfinder.yml`)

`src/index.ts` encadena: fetch (todas las fuentes en paralelo, tolerante a fallos) → normalize → reglas → dedup → score → filtrar por umbral → email → persistir estado.

Workflow:

```yaml
on:
  schedule: [{ cron: "0 12 * * *" }]   # 12:00 UTC = 07:00 Colombia
  workflow_dispatch: {}                 # corrida manual
```

Pasos: checkout → setup-node → `npm ci` → `npm start` → commit de `state/seen.json` si cambió.

Secrets de GitHub: `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `DIGEST_TO`.

## Estructura del repo

```
essionix-jobfinder/
├─ src/
│  ├─ fetchers/        # un módulo por fuente
│  ├─ normalize.ts
│  ├─ rules.ts
│  ├─ scorer.ts
│  ├─ state.ts
│  ├─ email.ts
│  ├─ types.ts         # Job, RawJob, Score, Fetcher
│  └─ index.ts         # orquestador
├─ config/
│  ├─ profile.md       # perfil de referencia (editable)
│  └─ rules.json       # keywords + umbral
├─ state/
│  └─ seen.json        # dedup (versionado)
├─ .github/workflows/jobfinder.yml
├─ test/               # tests por módulo
└─ package.json
```

## Manejo de errores

- **Fetcher falla:** se captura, se loguea, devuelve `[]`. El pipeline sigue con las demás fuentes. Nunca una fuente caída tumba la corrida.
- **Scorer falla en una oferta:** se reintenta 1 vez; si falla, esa oferta se omite del email (no se marca como vista, para reintentar mañana).
- **Email falla:** el workflow falla visiblemente (GitHub muestra error) y el estado **no** se commitea, para reintentar la próxima corrida sin perder ofertas.
- **Sin API key / secret:** falla temprano con mensaje claro.

## Testing

- **Unitarios por módulo:** normalize (cada formato de fuente → `Job`), rules (casos pasa/descarta, red-flags), state (dedup, purga), scorer (mock de la API, valida parseo de salida estructurada).
- **Fixtures:** respuestas de ejemplo guardadas por fuente para no depender de la red en tests.
- **Smoke local:** `npm start` con `--dry-run` (no envía email, imprime la lista) para validar end-to-end manualmente antes del primer cron.

## Decisiones cerradas

- **Lenguaje:** TypeScript/Node.
- **Email:** Resend.
- **Hosting:** GitHub Actions (cron diario, estado versionado).
- **Match:** híbrido (reglas baratas + LLM Claude sobre candidatas).
- **Riesgo LinkedIn:** sin cuenta/sesión; LinkedIn es best-effort vía endpoint guest.
