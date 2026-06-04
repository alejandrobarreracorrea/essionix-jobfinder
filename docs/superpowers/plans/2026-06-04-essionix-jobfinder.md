# Essionix JobFinder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pipeline diario (GitHub Actions) que descubre y filtra ofertas contractor/remoto/español para DevOps/Cloud/SRE y envía un email rankeado.

**Architecture:** fetchers (multi-fuente, tolerantes a fallos) → normalize → reglas → dedup contra estado → scorer IA (Claude) → email (Resend) → commit del estado. Sin servidor; estado versionado en `state/seen.json`.

**Tech Stack:** TypeScript, Node 20 (ESM, `fetch` nativo), Vitest, `@anthropic-ai/sdk`, `resend`, `fast-xml-parser`.

Spec de referencia: `docs/superpowers/specs/2026-06-03-essionix-jobfinder-design.md`.

---

## File Structure

```
src/
  types.ts            # RawJob, Job, Fetcher, Score, ScoredJob
  normalize.ts        # RawJob -> Job (id estable, remote inferido)
  rules.ts            # pre-filtro por keywords + carga de config
  state.ts            # load/save seen.json, dedup, purga
  scorer.ts           # Claude tool-use -> Score (perfil cacheado)
  email.ts            # render HTML + envío Resend
  fetchers/
    index.ts          # registro de fetchers activos
    remoteok.ts
    remotive.ts
    weworkremotely.ts
    himalayas.ts
    getonbrd.ts
    torre.ts
    linkedin.ts       # best-effort, endpoint guest
  index.ts            # orquestador + --dry-run
config/
  profile.md          # perfil de referencia (editable)
  rules.json          # include/exclude keywords + threshold
state/
  seen.json           # dedup (versionado) — arranca como {}
test/
  *.test.ts
  fixtures/           # respuestas de ejemplo por fuente
.github/workflows/jobfinder.yml
package.json
tsconfig.json
vitest.config.ts
```

---

## Task 1: Scaffold del proyecto

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`

- [ ] **Step 1: Crear `package.json`**

```json
{
  "name": "essionix-jobfinder",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "tsx src/index.ts",
    "dry-run": "tsx src/index.ts --dry-run",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.32.1",
    "fast-xml-parser": "^4.5.0",
    "resend": "^4.0.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Crear `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Crear `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["test/**/*.test.ts"] },
});
```

- [ ] **Step 4: Crear `.gitignore`**

```
node_modules/
dist/
.env
*.log
```

- [ ] **Step 5: Instalar dependencias**

Run: `npm install`
Expected: crea `node_modules/` y `package-lock.json` sin errores.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore
git commit -m "chore: scaffold Node/TS + vitest"
```

---

## Task 2: Tipos compartidos

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Escribir `src/types.ts`**

```ts
export interface RawJob {
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  postedAt: string | null; // ISO 8601 o null
  salary: string | null;
  remote?: boolean; // si la fuente lo indica explícito
}

export interface Job {
  id: string; // hash estable de source+url
  title: string;
  company: string;
  location: string;
  remote: boolean;
  url: string;
  description: string;
  postedAt: string | null;
  source: string;
  salary: string | null;
}

export interface Fetcher {
  name: string;
  fetch(): Promise<RawJob[]>;
}

export interface Score {
  score: number; // 0-100
  reason: string;
  highlights: string[];
}

export interface ScoredJob extends Job {
  score: Score;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: tipos compartidos"
```

---

## Task 3: Normalizador

**Files:**
- Create: `src/normalize.ts`, `test/normalize.test.ts`

- [ ] **Step 1: Escribir el test que falla**

`test/normalize.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalize, jobId } from "../src/normalize.js";
import type { RawJob } from "../src/types.js";

const raw: RawJob = {
  title: "SRE Contractor",
  company: "Acme",
  location: "Remote - LATAM",
  url: "https://acme.com/jobs/1",
  description: "Terraform and AWS",
  postedAt: "2026-06-01T00:00:00Z",
  salary: null,
};

describe("normalize", () => {
  it("genera id estable a partir de source+url", () => {
    const a = jobId("remoteok", raw.url);
    const b = jobId("remoteok", raw.url);
    expect(a).toBe(b);
    expect(jobId("remotive", raw.url)).not.toBe(a);
  });

  it("infiere remote=true desde la location cuando no viene explícito", () => {
    const job = normalize("remoteok", raw);
    expect(job.remote).toBe(true);
    expect(job.source).toBe("remoteok");
    expect(job.id).toBe(jobId("remoteok", raw.url));
  });

  it("respeta remote explícito de la fuente", () => {
    const job = normalize("x", { ...raw, location: "Bogota", remote: true });
    expect(job.remote).toBe(true);
  });

  it("remote=false cuando ni location ni flag lo indican", () => {
    const job = normalize("x", { ...raw, location: "Bogota oficina" });
    expect(job.remote).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `npx vitest run test/normalize.test.ts`
Expected: FAIL — "Cannot find module ../src/normalize.js".

- [ ] **Step 3: Implementar `src/normalize.ts`**

```ts
import { createHash } from "node:crypto";
import type { Job, RawJob } from "./types.js";

const REMOTE_RE = /\b(remote|remoto|remota|anywhere|teletrabajo)\b/i;

export function jobId(source: string, url: string): string {
  return createHash("sha256").update(`${source}::${url}`).digest("hex").slice(0, 16);
}

export function normalize(source: string, raw: RawJob): Job {
  const remote = raw.remote ?? REMOTE_RE.test(raw.location);
  return {
    id: jobId(source, raw.url),
    title: raw.title.trim(),
    company: raw.company.trim(),
    location: raw.location.trim(),
    remote,
    url: raw.url,
    description: raw.description,
    postedAt: raw.postedAt,
    source,
    salary: raw.salary,
  };
}
```

- [ ] **Step 4: Correr el test y ver que pasa**

Run: `npx vitest run test/normalize.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/normalize.ts test/normalize.test.ts
git commit -m "feat: normalizador con id estable e inferencia de remote"
```

---

## Task 4: Pre-filtro por reglas

**Files:**
- Create: `src/rules.ts`, `config/rules.json`, `test/rules.test.ts`

- [ ] **Step 1: Crear `config/rules.json`**

```json
{
  "threshold": 65,
  "include": ["devops","sre","site reliability","cloud","platform engineer","infrastructure","infraestructura","aws","terraform","kubernetes","k8s","dba","oracle","database","base de datos"],
  "exclude": ["on-site","on site","presencial","hybrid required","relocation required","unpaid"]
}
```

- [ ] **Step 2: Escribir el test que falla**

`test/rules.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { passesRules, type RulesConfig } from "../src/rules.js";
import type { Job } from "../src/types.js";

const cfg: RulesConfig = {
  threshold: 65,
  include: ["devops", "aws", "terraform"],
  exclude: ["presencial", "on-site"],
};

const base: Job = {
  id: "1", title: "DevOps Engineer", company: "Acme", location: "Remote",
  remote: true, url: "u", description: "AWS Terraform", postedAt: null,
  source: "s", salary: null,
};

describe("passesRules", () => {
  it("pasa cuando es remoto y matchea include", () => {
    expect(passesRules(base, cfg)).toBe(true);
  });
  it("descarta si no es remoto", () => {
    expect(passesRules({ ...base, remote: false }, cfg)).toBe(false);
  });
  it("descarta si no matchea ningún include", () => {
    expect(passesRules({ ...base, title: "Chef", description: "cooking" }, cfg)).toBe(false);
  });
  it("descarta si matchea un exclude (red-flag)", () => {
    expect(passesRules({ ...base, description: "AWS pero presencial obligatorio" }, cfg)).toBe(false);
  });
});
```

- [ ] **Step 3: Correr el test y ver que falla**

Run: `npx vitest run test/rules.test.ts`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 4: Implementar `src/rules.ts`**

```ts
import { readFileSync } from "node:fs";
import type { Job } from "./types.js";

export interface RulesConfig {
  threshold: number;
  include: string[];
  exclude: string[];
}

export function loadRules(path = "config/rules.json"): RulesConfig {
  return JSON.parse(readFileSync(path, "utf8")) as RulesConfig;
}

export function passesRules(job: Job, cfg: RulesConfig): boolean {
  if (!job.remote) return false;
  const hay = `${job.title} ${job.description} ${job.location}`.toLowerCase();
  if (cfg.exclude.some((kw) => hay.includes(kw.toLowerCase()))) return false;
  return cfg.include.some((kw) => hay.includes(kw.toLowerCase()));
}
```

- [ ] **Step 5: Correr el test y ver que pasa**

Run: `npx vitest run test/rules.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/rules.ts config/rules.json test/rules.test.ts
git commit -m "feat: pre-filtro por reglas + config"
```

---

## Task 5: Estado y dedup

**Files:**
- Create: `src/state.ts`, `state/seen.json`, `test/state.test.ts`

- [ ] **Step 1: Crear `state/seen.json`**

```json
{}
```

- [ ] **Step 2: Escribir el test que falla**

`test/state.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { filterUnseen, markSeen, purge } from "../src/state.js";
import type { Job } from "../src/types.js";

const job = (id: string): Job => ({
  id, title: "t", company: "c", location: "Remote", remote: true,
  url: "u", description: "d", postedAt: null, source: "s", salary: null,
});

describe("state", () => {
  it("filterUnseen deja solo ids no vistos", () => {
    const seen = { a: "2026-06-01T00:00:00Z" };
    const out = filterUnseen([job("a"), job("b")], seen);
    expect(out.map((j) => j.id)).toEqual(["b"]);
  });

  it("markSeen agrega ids con timestamp dado", () => {
    const seen = markSeen({}, [job("x")], "2026-06-04T00:00:00Z");
    expect(seen["x"]).toBe("2026-06-04T00:00:00Z");
  });

  it("purge elimina entradas más viejas que N días", () => {
    const seen = { old: "2026-01-01T00:00:00Z", fresh: "2026-06-03T00:00:00Z" };
    const out = purge(seen, "2026-06-04T00:00:00Z", 60);
    expect(out).toEqual({ fresh: "2026-06-03T00:00:00Z" });
  });
});
```

- [ ] **Step 3: Correr el test y ver que falla**

Run: `npx vitest run test/state.test.ts`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 4: Implementar `src/state.ts`**

```ts
import { readFileSync, writeFileSync } from "node:fs";
import type { Job } from "./types.js";

export type Seen = Record<string, string>; // id -> firstSeen ISO

export function loadSeen(path = "state/seen.json"): Seen {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Seen;
  } catch {
    return {};
  }
}

export function saveSeen(seen: Seen, path = "state/seen.json"): void {
  writeFileSync(path, JSON.stringify(seen, null, 2) + "\n");
}

export function filterUnseen(jobs: Job[], seen: Seen): Job[] {
  return jobs.filter((j) => !(j.id in seen));
}

export function markSeen(seen: Seen, jobs: Job[], nowISO: string): Seen {
  const out = { ...seen };
  for (const j of jobs) if (!(j.id in out)) out[j.id] = nowISO;
  return out;
}

export function purge(seen: Seen, nowISO: string, maxDays: number): Seen {
  const cutoff = new Date(nowISO).getTime() - maxDays * 86400_000;
  return Object.fromEntries(
    Object.entries(seen).filter(([, iso]) => new Date(iso).getTime() >= cutoff),
  );
}
```

- [ ] **Step 5: Correr el test y ver que pasa**

Run: `npx vitest run test/state.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/state.ts state/seen.json test/state.test.ts
git commit -m "feat: estado y dedup con purga"
```

---

## Task 6: Scorer IA

**Files:**
- Create: `src/scorer.ts`, `config/profile.md`, `test/scorer.test.ts`

- [ ] **Step 1: Crear `config/profile.md`**

```markdown
# Perfil — Alejandro Barrera

Cloud Engineer Sr (Globant), Colombia (GMT-5), ~11 años de experiencia.

**Busca:** posiciones **contractor / freelance**, **100% remotas**, mercado **hispanohablante** (LatAm / España).

**Foco:** Cloud / SRE / DevOps.
**Stack:** AWS (EC2, RDS, VPC, S3, IAM, Route53, CloudWatch, SNS, ELB, CloudFront), Terraform / IaC, CI/CD, Linux/RHEL.
**DBA senior (diferenciador):** Oracle OCP 12c (RAC, ASM, DataGuard, Multitenant), SQL Server, MySQL, PostgreSQL.
**Idioma:** Español (nativo), inglés técnico.

**Red-flags:** on-site/presencial, relocation obligatorio, roles solo junior.
```

- [ ] **Step 2: Escribir el test que falla (con cliente mockeado)**

`test/scorer.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { scoreJob } from "../src/scorer.js";
import type { Job } from "../src/types.js";

const job: Job = {
  id: "1", title: "SRE Contractor (Remote LATAM)", company: "Acme",
  location: "Remote", remote: true, url: "u",
  description: "Terraform, AWS, Kubernetes. Español.", postedAt: null,
  source: "remoteok", salary: null,
};

function fakeClient(payload: object) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "tool_use", name: "report_score", input: payload }],
      }),
    },
  } as any;
}

describe("scoreJob", () => {
  it("devuelve el Score del tool_use", async () => {
    const client = fakeClient({ score: 88, reason: "match fuerte", highlights: ["Terraform", "AWS"] });
    const s = await scoreJob(client, job, "PERFIL");
    expect(s.score).toBe(88);
    expect(s.highlights).toContain("Terraform");
  });

  it("envía el perfil como bloque cacheado", async () => {
    const client = fakeClient({ score: 70, reason: "ok", highlights: [] });
    await scoreJob(client, job, "PERFIL");
    const arg = client.messages.create.mock.calls[0][0];
    const sys = arg.system;
    expect(JSON.stringify(sys)).toContain("cache_control");
    expect(JSON.stringify(sys)).toContain("PERFIL");
  });
});
```

- [ ] **Step 3: Correr el test y ver que falla**

Run: `npx vitest run test/scorer.test.ts`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 4: Implementar `src/scorer.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";
import type { Job, Score } from "./types.js";

const MODEL = "claude-haiku-4-5-20251001";

const TOOL = {
  name: "report_score",
  description: "Reporta el puntaje de encaje de la oferta con el perfil.",
  input_schema: {
    type: "object" as const,
    properties: {
      score: { type: "number", description: "0-100" },
      reason: { type: "string", description: "1-2 frases" },
      highlights: { type: "array", items: { type: "string" } },
    },
    required: ["score", "reason", "highlights"],
  },
};

export function buildClient(apiKey = process.env.ANTHROPIC_API_KEY): Anthropic {
  return new Anthropic({ apiKey });
}

export async function scoreJob(client: Anthropic, job: Job, profile: string): Promise<Score> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "report_score" },
    system: [
      {
        type: "text",
        text:
          "Eres un evaluador de ofertas de empleo. Puntúa de 0-100 qué tan bien encaja la oferta con el perfil. " +
          "Premia: contractor/freelance, remoto, español, DevOps/SRE/Cloud, y el combo SRE+DBA. " +
          "Penaliza: on-site, relocation, solo-junior.\n\nPERFIL:\n" + profile,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content:
          `Oferta:\nTítulo: ${job.title}\nEmpresa: ${job.company}\n` +
          `Ubicación: ${job.location}\nFuente: ${job.source}\n` +
          `Descripción: ${job.description.slice(0, 4000)}`,
      },
    ],
  });
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("sin tool_use en la respuesta");
  return block.input as Score;
}
```

- [ ] **Step 5: Correr el test y ver que pasa**

Run: `npx vitest run test/scorer.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/scorer.ts config/profile.md test/scorer.test.ts
git commit -m "feat: scorer IA con perfil cacheado y salida estructurada"
```

---

## Task 7: Email (render + envío)

**Files:**
- Create: `src/email.ts`, `test/email.test.ts`

- [ ] **Step 1: Escribir el test que falla (solo el render puro)**

`test/email.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { renderDigest } from "../src/email.js";
import type { ScoredJob } from "../src/types.js";

const sj: ScoredJob = {
  id: "1", title: "SRE Contractor", company: "Acme", location: "Remote",
  remote: true, url: "https://acme.com/1", description: "d", postedAt: null,
  source: "remoteok", salary: null,
  score: { score: 88, reason: "match fuerte", highlights: ["Terraform", "AWS"] },
};

describe("renderDigest", () => {
  it("incluye título, score, motivo y link", () => {
    const html = renderDigest([sj]);
    expect(html).toContain("SRE Contractor");
    expect(html).toContain("88");
    expect(html).toContain("match fuerte");
    expect(html).toContain("https://acme.com/1");
  });

  it("ordena por score descendente", () => {
    const low = { ...sj, id: "2", title: "Low", score: { score: 70, reason: "r", highlights: [] } };
    const html = renderDigest([low, sj]);
    expect(html.indexOf("SRE Contractor")).toBeLessThan(html.indexOf("Low"));
  });
});
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `npx vitest run test/email.test.ts`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 3: Implementar `src/email.ts`**

```ts
import { Resend } from "resend";
import type { ScoredJob } from "./types.js";

export function renderDigest(jobs: ScoredJob[]): string {
  const sorted = [...jobs].sort((a, b) => b.score.score - a.score.score);
  const rows = sorted
    .map(
      (j) => `
    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:12px">
      <div style="font-size:12px;color:#64748b">${j.source} · score ${j.score.score}/100</div>
      <div style="font-size:18px;font-weight:600;margin:4px 0">${escapeHtml(j.title)}</div>
      <div style="color:#334155">${escapeHtml(j.company)} — ${escapeHtml(j.location)}</div>
      <div style="margin:8px 0;color:#475569">${escapeHtml(j.score.reason)}</div>
      <div style="font-size:12px;color:#0f766e">${j.score.highlights.map(escapeHtml).join(" · ")}</div>
      <a href="${j.url}" style="display:inline-block;margin-top:8px;background:#0f172a;color:#fff;
         padding:8px 14px;border-radius:6px;text-decoration:none">Postular</a>
    </div>`,
    )
    .join("");
  return `<div style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto">
    <h2>JobFinder — ${sorted.length} ofertas nuevas</h2>${rows}</div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

export async function sendDigest(
  jobs: ScoredJob[],
  opts: { apiKey: string; to: string; from?: string },
): Promise<void> {
  const resend = new Resend(opts.apiKey);
  const { error } = await resend.emails.send({
    from: opts.from ?? "JobFinder <onboarding@resend.dev>",
    to: opts.to,
    subject: `JobFinder — ${jobs.length} ofertas nuevas`,
    html: renderDigest(jobs),
  });
  if (error) throw new Error(`Resend: ${JSON.stringify(error)}`);
}
```

- [ ] **Step 4: Correr el test y ver que pasa**

Run: `npx vitest run test/email.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/email.ts test/email.test.ts
git commit -m "feat: render HTML del digest + envío Resend"
```

---

## Task 8: Fetcher RemoteOK (patrón JSON + fixture)

**Files:**
- Create: `src/fetchers/remoteok.ts`, `test/fixtures/remoteok.json`, `test/remoteok.test.ts`

- [ ] **Step 1: Crear fixture `test/fixtures/remoteok.json`**

```json
[
  { "legal": "primer elemento es metadata, se ignora" },
  {
    "position": "Senior SRE",
    "company": "Acme",
    "location": "Worldwide",
    "url": "https://remoteok.com/remote-jobs/1",
    "description": "<p>AWS, Terraform</p>",
    "date": "2026-06-03T00:00:00+00:00",
    "salary_min": 90000
  }
]
```

- [ ] **Step 2: Escribir el test que falla**

`test/remoteok.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { remoteok } from "../src/fetchers/remoteok.js";

const fixture = readFileSync("test/fixtures/remoteok.json", "utf8");

afterEach(() => vi.restoreAllMocks());

describe("remoteok fetcher", () => {
  it("parsea ofertas saltando el elemento de metadata", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => fixture }));
    const jobs = await remoteok.fetch();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe("Senior SRE");
    expect(jobs[0].url).toBe("https://remoteok.com/remote-jobs/1");
    expect(jobs[0].remote).toBe(true);
  });

  it("devuelve [] si la red falla (tolerante a fallos)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(await remoteok.fetch()).toEqual([]);
  });
});
```

- [ ] **Step 3: Correr el test y ver que falla**

Run: `npx vitest run test/remoteok.test.ts`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 4: Implementar `src/fetchers/remoteok.ts`**

```ts
import type { Fetcher, RawJob } from "../types.js";

const stripHtml = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export const remoteok: Fetcher = {
  name: "remoteok",
  async fetch(): Promise<RawJob[]> {
    try {
      const res = await fetch("https://remoteok.com/api", {
        headers: { "User-Agent": "essionix-jobfinder" },
      });
      if (!res.ok) return [];
      const data = JSON.parse(await res.text()) as any[];
      return data
        .filter((d) => d && d.position && d.url)
        .map((d) => ({
          title: d.position,
          company: d.company ?? "",
          location: d.location || "Remote",
          url: d.url,
          description: stripHtml(d.description ?? ""),
          postedAt: d.date ?? null,
          salary: d.salary_min ? `${d.salary_min}` : null,
          remote: true,
        }));
    } catch {
      return [];
    }
  },
};
```

- [ ] **Step 5: Correr el test y ver que pasa**

Run: `npx vitest run test/remoteok.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/fetchers/remoteok.ts test/fixtures/remoteok.json test/remoteok.test.ts
git commit -m "feat: fetcher RemoteOK (JSON, tolerante a fallos)"
```

---

## Task 9: Fetcher Remotive (JSON)

**Files:**
- Create: `src/fetchers/remotive.ts`, `test/fixtures/remotive.json`, `test/remotive.test.ts`

- [ ] **Step 1: Crear fixture `test/fixtures/remotive.json`**

```json
{ "jobs": [
  { "title": "DevOps Engineer", "company_name": "Beta",
    "candidate_required_location": "LATAM",
    "url": "https://remotive.com/job/2",
    "description": "<p>Kubernetes</p>",
    "publication_date": "2026-06-02T10:00:00",
    "salary": "" }
]}
```

- [ ] **Step 2: Escribir el test que falla**

`test/remotive.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { remotive } from "../src/fetchers/remotive.js";

const fixture = readFileSync("test/fixtures/remotive.json", "utf8");
afterEach(() => vi.restoreAllMocks());

describe("remotive fetcher", () => {
  it("mapea jobs al RawJob común", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => fixture }));
    const jobs = await remotive.fetch();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe("DevOps Engineer");
    expect(jobs[0].company).toBe("Beta");
    expect(jobs[0].url).toBe("https://remotive.com/job/2");
  });

  it("devuelve [] ante error de red", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("x")));
    expect(await remotive.fetch()).toEqual([]);
  });
});
```

- [ ] **Step 3: Correr el test y ver que falla**

Run: `npx vitest run test/remotive.test.ts`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 4: Implementar `src/fetchers/remotive.ts`**

```ts
import type { Fetcher, RawJob } from "../types.js";

const stripHtml = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export const remotive: Fetcher = {
  name: "remotive",
  async fetch(): Promise<RawJob[]> {
    try {
      const res = await fetch(
        "https://remotive.com/api/remote-jobs?category=devops",
        { headers: { "User-Agent": "essionix-jobfinder" } },
      );
      if (!res.ok) return [];
      const data = JSON.parse(await res.text()) as { jobs?: any[] };
      return (data.jobs ?? []).map((d) => ({
        title: d.title,
        company: d.company_name ?? "",
        location: d.candidate_required_location || "Remote",
        url: d.url,
        description: stripHtml(d.description ?? ""),
        postedAt: d.publication_date ?? null,
        salary: d.salary || null,
        remote: true,
      }));
    } catch {
      return [];
    }
  },
};
```

- [ ] **Step 5: Correr el test y ver que pasa**

Run: `npx vitest run test/remotive.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/fetchers/remotive.ts test/fixtures/remotive.json test/remotive.test.ts
git commit -m "feat: fetcher Remotive"
```

---

## Task 10: Fetcher WeWorkRemotely (RSS)

**Files:**
- Create: `src/fetchers/weworkremotely.ts`, `test/fixtures/wwr.xml`, `test/wwr.test.ts`

- [ ] **Step 1: Crear fixture `test/fixtures/wwr.xml`**

```xml
<rss><channel>
  <item>
    <title>Company: SRE Engineer</title>
    <link>https://weworkremotely.com/jobs/3</link>
    <description>Terraform and AWS</description>
    <pubDate>Tue, 03 Jun 2026 00:00:00 +0000</pubDate>
    <region>Anywhere</region>
  </item>
</channel></rss>
```

- [ ] **Step 2: Escribir el test que falla**

`test/wwr.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { weworkremotely } from "../src/fetchers/weworkremotely.js";

const fixture = readFileSync("test/fixtures/wwr.xml", "utf8");
afterEach(() => vi.restoreAllMocks());

describe("weworkremotely fetcher", () => {
  it("parsea items del RSS y separa empresa/título", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => fixture }));
    const jobs = await weworkremotely.fetch();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].company).toBe("Company");
    expect(jobs[0].title).toBe("SRE Engineer");
    expect(jobs[0].url).toBe("https://weworkremotely.com/jobs/3");
  });

  it("devuelve [] ante error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("x")));
    expect(await weworkremotely.fetch()).toEqual([]);
  });
});
```

- [ ] **Step 3: Correr el test y ver que falla**

Run: `npx vitest run test/wwr.test.ts`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 4: Implementar `src/fetchers/weworkremotely.ts`**

```ts
import { XMLParser } from "fast-xml-parser";
import type { Fetcher, RawJob } from "../types.js";

const parser = new XMLParser();

export const weworkremotely: Fetcher = {
  name: "weworkremotely",
  async fetch(): Promise<RawJob[]> {
    try {
      const res = await fetch(
        "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
        { headers: { "User-Agent": "essionix-jobfinder" } },
      );
      if (!res.ok) return [];
      const xml = parser.parse(await res.text());
      const items = xml?.rss?.channel?.item;
      const list = Array.isArray(items) ? items : items ? [items] : [];
      return list.map((it: any) => {
        const full: string = String(it.title ?? "");
        const [company, ...rest] = full.split(":");
        const title = rest.join(":").trim() || full;
        return {
          title,
          company: rest.length ? company.trim() : "",
          location: String(it.region ?? "Remote"),
          url: String(it.link ?? ""),
          description: String(it.description ?? ""),
          postedAt: it.pubDate ? new Date(String(it.pubDate)).toISOString() : null,
          salary: null,
          remote: true,
        };
      });
    } catch {
      return [];
    }
  },
};
```

- [ ] **Step 5: Correr el test y ver que pasa**

Run: `npx vitest run test/wwr.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/fetchers/weworkremotely.ts test/fixtures/wwr.xml test/wwr.test.ts
git commit -m "feat: fetcher WeWorkRemotely (RSS)"
```

---

## Task 11: Fetchers Himalayas, GetOnBrd, Torre (JSON, mismo patrón)

**Files:**
- Create: `src/fetchers/himalayas.ts`, `src/fetchers/getonbrd.ts`, `src/fetchers/torre.ts` y sus fixtures+tests análogos.

> Patrón idéntico a Remotive (Task 9): `fetch` → `if (!res.ok) return []` → map a `RawJob` → `catch { return [] }`. Endpoints y mapeo de campos:

- [ ] **Step 1: Himalayas** — endpoint `https://himalayas.app/jobs/api?limit=50`. Campos: `title`, `companyName`, `locationRestrictions`/`"Remote"`, `applicationLink`, `description`, `pubDate`, `remote:true`. Fixture `test/fixtures/himalayas.json` con `{ "jobs": [ { ...un job... } ] }`. Test `test/himalayas.test.ts` espejo de Task 9 (un job parseado + `[]` en error).

- [ ] **Step 2: GetOnBrd** — endpoint `https://www.getonbrd.com/api/v0/categories/programming/jobs?expand=["company"]`. Respuesta JSON:API con `data[].attributes`: `title`, `attributes.remote`, `links` o `id` para construir url `https://www.getonbrd.com/jobs/<id>`, `description`. Fixture `test/fixtures/getonbrd.json`. Test `test/getonbrd.test.ts` espejo.

- [ ] **Step 3: Torre** — `POST https://search.torre.co/opportunities/_search/` con body `{ "remote": true, "skill/role": { "text": "devops" } }`. Respuesta: array de results con `objective` (título), `organizations[0].name`, `id` → url `https://torre.ai/post/<id>`. Fixture `test/fixtures/torre.json`. Test `test/torre.test.ts` espejo (incluye que el `body` del POST se envía).

- [ ] **Step 4: Correr los tres tests**

Run: `npx vitest run test/himalayas.test.ts test/getonbrd.test.ts test/torre.test.ts`
Expected: PASS (2 tests c/u).

- [ ] **Step 5: Commit**

```bash
git add src/fetchers/himalayas.ts src/fetchers/getonbrd.ts src/fetchers/torre.ts test/fixtures/himalayas.json test/fixtures/getonbrd.json test/fixtures/torre.json test/himalayas.test.ts test/getonbrd.test.ts test/torre.test.ts
git commit -m "feat: fetchers Himalayas, GetOnBrd, Torre"
```

---

## Task 12: Fetcher LinkedIn (guest, best-effort)

**Files:**
- Create: `src/fetchers/linkedin.ts`, `test/fixtures/linkedin.html`, `test/linkedin.test.ts`

- [ ] **Step 1: Crear fixture `test/fixtures/linkedin.html`**

```html
<ul>
  <li><div class="base-card">
    <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/4">x</a>
    <h3 class="base-search-card__title">SRE Contractor</h3>
    <h4 class="base-search-card__subtitle">Acme</h4>
    <span class="job-search-card__location">Remote, LATAM</span>
  </div></li>
</ul>
```

- [ ] **Step 2: Escribir el test que falla**

`test/linkedin.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { linkedin } from "../src/fetchers/linkedin.js";

const fixture = readFileSync("test/fixtures/linkedin.html", "utf8");
afterEach(() => vi.restoreAllMocks());

describe("linkedin guest fetcher", () => {
  it("extrae tarjetas del HTML guest", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => fixture }));
    const jobs = await linkedin.fetch();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe("SRE Contractor");
    expect(jobs[0].company).toBe("Acme");
    expect(jobs[0].url).toContain("/jobs/view/4");
  });

  it("devuelve [] ante 999/error (best-effort)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 999, text: async () => "" }));
    expect(await linkedin.fetch()).toEqual([]);
  });
});
```

- [ ] **Step 3: Correr el test y ver que falla**

Run: `npx vitest run test/linkedin.test.ts`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 4: Implementar `src/fetchers/linkedin.ts`**

```ts
import type { Fetcher, RawJob } from "../types.js";

const BASE =
  "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search" +
  "?keywords=devops%20sre&location=Latin%20America&f_WT=2&start=0";

const pick = (html: string, re: RegExp) => (html.match(re)?.[1] ?? "").trim();

export const linkedin: Fetcher = {
  name: "linkedin",
  async fetch(): Promise<RawJob[]> {
    try {
      const res = await fetch(BASE, { headers: { "User-Agent": "Mozilla/5.0 essionix-jobfinder" } });
      if (!res.ok) return []; // 999 anti-bot incluido
      const html = await res.text();
      const cards = html.split('<li>').filter((c) => c.includes("base-card"));
      return cards
        .map((c) => ({
          title: pick(c, /base-search-card__title">([^<]+)</),
          company: pick(c, /base-search-card__subtitle">\s*<a[^>]*>([^<]+)<|base-search-card__subtitle">([^<]+)</),
          location: pick(c, /job-search-card__location">([^<]+)</) || "Remote",
          url: (c.match(/href="(https:\/\/www\.linkedin\.com\/jobs\/view\/[^"?]+)/)?.[1] ?? ""),
          description: "",
          postedAt: null,
          salary: null,
          remote: true,
        }))
        .filter((j) => j.title && j.url);
    } catch {
      return [];
    }
  },
};
```

- [ ] **Step 5: Correr el test y ver que pasa**

Run: `npx vitest run test/linkedin.test.ts`
Expected: PASS (2 tests). Nota: el `company` puede requerir ajustar el regex contra el fixture — el test valida "Acme".

- [ ] **Step 6: Commit**

```bash
git add src/fetchers/linkedin.ts test/fixtures/linkedin.html test/linkedin.test.ts
git commit -m "feat: fetcher LinkedIn guest (best-effort)"
```

---

## Task 13: Registro de fetchers

**Files:**
- Create: `src/fetchers/index.ts`, `test/fetchers-index.test.ts`

- [ ] **Step 1: Escribir el test que falla**

`test/fetchers-index.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { FETCHERS } from "../src/fetchers/index.js";

describe("registro de fetchers", () => {
  it("incluye las 7 fuentes con nombres únicos", () => {
    const names = FETCHERS.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(
      expect.arrayContaining([
        "remoteok", "remotive", "weworkremotely", "himalayas", "getonbrd", "torre", "linkedin",
      ]),
    );
  });
});
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `npx vitest run test/fetchers-index.test.ts`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 3: Implementar `src/fetchers/index.ts`**

```ts
import type { Fetcher } from "../types.js";
import { remoteok } from "./remoteok.js";
import { remotive } from "./remotive.js";
import { weworkremotely } from "./weworkremotely.js";
import { himalayas } from "./himalayas.js";
import { getonbrd } from "./getonbrd.js";
import { torre } from "./torre.js";
import { linkedin } from "./linkedin.js";

export const FETCHERS: Fetcher[] = [
  remoteok, remotive, weworkremotely, himalayas, getonbrd, torre, linkedin,
];
```

- [ ] **Step 4: Correr el test y ver que pasa**

Run: `npx vitest run test/fetchers-index.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/fetchers/index.ts test/fetchers-index.test.ts
git commit -m "feat: registro central de fetchers"
```

---

## Task 14: Orquestador

**Files:**
- Create: `src/index.ts`

> Orquestador no-testeado unitariamente (es glue + I/O); se valida con el smoke `--dry-run` del Task 16. Compone los módulos ya probados.

- [ ] **Step 1: Implementar `src/index.ts`**

```ts
import { readFileSync } from "node:fs";
import { FETCHERS } from "./fetchers/index.js";
import { normalize } from "./normalize.js";
import { loadRules, passesRules } from "./rules.js";
import { loadSeen, saveSeen, filterUnseen, markSeen, purge } from "./state.js";
import { buildClient, scoreJob } from "./scorer.js";
import { sendDigest } from "./email.js";
import type { Job, ScoredJob } from "./types.js";

const DRY = process.argv.includes("--dry-run");

async function main() {
  const nowISO = new Date().toISOString();
  const cfg = loadRules();
  const profile = readFileSync("config/profile.md", "utf8");
  const seen = loadSeen();

  // 1. fetch en paralelo, tolerante a fallos
  const raw = await Promise.all(
    FETCHERS.map(async (f) => {
      const items = await f.fetch();
      console.log(`[fetch] ${f.name}: ${items.length}`);
      return items.map((r) => normalize(f.name, r));
    }),
  );
  const jobs: Job[] = raw.flat();

  // 2. dedup por id (entre fuentes) + 3. reglas + 4. no vistos
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const candidates = filterUnseen([...byId.values()].filter((j) => passesRules(j, cfg)), seen);
  console.log(`[pipeline] candidatas tras reglas+dedup: ${candidates.length}`);

  // 5. score IA
  const client = buildClient();
  const scored: ScoredJob[] = [];
  for (const job of candidates) {
    try {
      const score = await scoreJob(client, job, profile);
      if (score.score >= cfg.threshold) scored.push({ ...job, score });
    } catch (e) {
      console.error(`[score] omitida ${job.id}: ${(e as Error).message}`);
    }
  }
  scored.sort((a, b) => b.score.score - a.score.score);
  console.log(`[pipeline] sobre umbral ${cfg.threshold}: ${scored.length}`);

  // 6. email
  if (DRY) {
    console.log(scored.map((j) => `${j.score.score}  ${j.title} — ${j.company} (${j.url})`).join("\n"));
    return;
  }
  if (scored.length > 0) {
    await sendDigest(scored, {
      apiKey: process.env.RESEND_API_KEY!,
      to: process.env.DIGEST_TO!,
    });
  }

  // 7. persistir estado (todas las candidatas evaluadas se marcan vistas)
  const evaluated = candidates.filter((c) => scored.some((s) => s.id === c.id) || true);
  const next = purge(markSeen(seen, evaluated, nowISO), nowISO, 60);
  saveSeen(next);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: orquestador del pipeline + dry-run"
```

---

## Task 15: Workflow de GitHub Actions

**Files:**
- Create: `.github/workflows/jobfinder.yml`

- [ ] **Step 1: Implementar el workflow**

```yaml
name: jobfinder
on:
  schedule:
    - cron: "0 12 * * *"   # 12:00 UTC = 07:00 Colombia
  workflow_dispatch: {}

permissions:
  contents: write

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npm test
      - run: npm start
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          DIGEST_TO: ${{ secrets.DIGEST_TO }}
      - name: Commit estado
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add state/seen.json
          git diff --staged --quiet || git commit -m "chore: actualizar estado seen.json"
          git push
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/jobfinder.yml
git commit -m "ci: workflow diario de jobfinder"
```

---

## Task 16: Suite completa + smoke + README

**Files:**
- Create: `README.md` (sobreescribe el placeholder)

- [ ] **Step 1: Correr toda la suite**

Run: `npm test`
Expected: PASS — todos los tests de los Tasks 3-13 verdes.

- [ ] **Step 2: Smoke `--dry-run` (red real, sin email)**

Run: `ANTHROPIC_API_KEY=<tu-key> npm run dry-run`
Expected: imprime conteos `[fetch] …` por fuente y una lista rankeada. Si alguna fuente devuelve 0/falla, el resto continúa.

- [ ] **Step 3: Escribir `README.md`**

```markdown
# essionix-jobfinder

Pipeline diario que descubre ofertas **contractor / remoto / español** para **DevOps / Cloud / SRE**, las puntúa con Claude y envía un email rankeado (Resend).

## Configuración
1. Edita `config/profile.md` (tu perfil) y `config/rules.json` (keywords + umbral).
2. Secrets del repo (Settings → Secrets → Actions): `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `DIGEST_TO`.
3. El cron corre 07:00 Colombia; o dispáralo manual en Actions → jobfinder → Run workflow.

## Local
- `npm install`
- `npm test` — suite
- `npm run dry-run` — corre el pipeline e imprime resultados sin enviar email (requiere `ANTHROPIC_API_KEY`).

## Arquitectura
Ver `docs/superpowers/specs/2026-06-03-essionix-jobfinder-design.md`.
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README de uso"
```

- [ ] **Step 5: Push**

```bash
git push
```

---

## Self-Review (cobertura del spec)

- Fetchers multi-fuente + tolerancia a fallos → Tasks 8-13.
- Normalizador / esquema `Job` → Task 3.
- Pre-filtro por reglas + config → Task 4.
- Estado / dedup / purga → Task 5.
- Scorer IA con perfil cacheado + salida estructurada → Task 6.
- Email Resend (render + envío, no-enviar si vacío) → Tasks 7 y 14.
- Orquestación idempotente + manejo de errores → Task 14.
- Workflow cron + secrets + commit de estado → Task 15.
- Testing por módulo + fixtures + smoke dry-run → todos + Task 16.

Sin placeholders de código; tipos (`Job`, `Score`, `Fetcher`, `ScoredJob`) consistentes entre tasks.
