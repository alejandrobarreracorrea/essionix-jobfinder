import { readFileSync } from "node:fs";
import { FETCHERS } from "./fetchers/index.js";
import { normalize } from "./normalize.js";
import { loadRules, passesRules } from "./rules.js";
import { loadSeen, saveSeen, filterUnseen, markSeen, purge } from "./state.js";
import { scoreBatch } from "./scorer.js";
import { sendDigest } from "./email.js";
import { loadSourcesState, saveSourcesState, expandIfDue, activeFetchers } from "./sources.js";
import type { Job, ScoredJob } from "./types.js";

const DRY = process.argv.includes("--dry-run");

async function main() {
  // Diagnóstico: fuerza un email de prueba y termina (no toca el pipeline).
  if (process.env.JOBFINDER_TEST_EMAIL) {
    console.log(
      `[email] TEST: GMAIL_USER set=${!!process.env.GMAIL_USER} ` +
        `APP_PASSWORD set=${!!process.env.GMAIL_APP_PASSWORD} DIGEST_TO set=${!!process.env.DIGEST_TO}`,
    );
    const dummy: ScoredJob = {
      id: "test", title: "TEST — verificación de email JobFinder", company: "Essionix",
      location: "Remote", remote: true, url: "https://example.com", description: "test",
      postedAt: null, source: "test", salary: null,
      score: { score: 99, reason: "correo de prueba", highlights: ["ok"] },
    };
    await sendDigest([dummy], {
      user: process.env.GMAIL_USER!,
      appPassword: process.env.GMAIL_APP_PASSWORD!,
      to: process.env.DIGEST_TO!,
    });
    console.log("[email] TEST: sendDigest terminó sin excepción");
    return;
  }

  const nowISO = new Date().toISOString();
  const cfg = loadRules();
  const profile = readFileSync("config/profile.md", "utf8");
  const seen = loadSeen();

  // 0. cobertura progresiva: enciende 2 portales nuevos cada 2 días (se persiste al final).
  const srcState = expandIfDue(loadSourcesState(), FETCHERS.length, nowISO);
  const active = activeFetchers(FETCHERS, srcState);
  console.log(
    `[sources] activas ${active.length}/${FETCHERS.length}: ${active.map((f) => f.name).join(", ")}`,
  );

  // 1. fetch en paralelo, tolerante a fallos
  const raw = await Promise.all(
    active.map(async (f) => {
      try {
        const items = await f.fetch();
        console.log(`[fetch] ${f.name}: ${items.length}`);
        return items.map((r) => normalize(f.name, r));
      } catch (e) {
        console.error(`[fetch] ${f.name} falló: ${(e as Error).message}`);
        return [];
      }
    }),
  );
  const jobs: Job[] = raw.flat();

  // 2. dedup por id entre fuentes + 3. reglas + 4. no vistos
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const candidates = filterUnseen(
    [...byId.values()].filter((j) => passesRules(j, cfg)),
    seen,
  );
  console.log(`[pipeline] candidatas tras reglas+dedup: ${candidates.length}`);

  // 5. score IA en lotes (umbral). JOBFINDER_MAX_SCORE limita cuántas puntuar (debug).
  const maxScore = process.env.JOBFINDER_MAX_SCORE
    ? Number(process.env.JOBFINDER_MAX_SCORE)
    : Infinity;
  const BATCH = 12;
  const toScore = candidates.slice(0, maxScore);
  const scored: ScoredJob[] = [];
  const evaluated: Job[] = []; // solo las que el scorer devolvió un puntaje
  for (let i = 0; i < toScore.length; i += BATCH) {
    const chunk = toScore.slice(i, i + BATCH);
    const t0 = Date.now();
    try {
      const scores = await scoreBatch(chunk, profile);
      for (const job of chunk) {
        const s = scores.get(job.id);
        if (!s) continue; // no devuelta → no evaluada → se reintenta
        evaluated.push(job);
        if (s.score >= cfg.threshold) scored.push({ ...job, score: s });
      }
      console.log(
        `[score] lote ${i / BATCH + 1}: ${scores.size}/${chunk.length} puntuadas (${Date.now() - t0}ms)`,
      );
    } catch (e) {
      console.error(`[score] lote ${i / BATCH + 1} falló (${Date.now() - t0}ms): ${(e as Error).message}`);
    }
  }
  scored.sort((a, b) => b.score.score - a.score.score);
  console.log(`[pipeline] sobre umbral ${cfg.threshold}: ${scored.length}`);
  if (process.env.JOBFINDER_DEBUG) {
    for (const j of scored) {
      console.error(`[passed] ${j.score.score} [${j.location}] ${j.title.slice(0, 60)}`);
    }
  }

  // 6. email
  if (DRY) {
    console.log(
      scored
        .map((j) => `${j.score.score}  ${j.title} — ${j.company} (${j.url})`)
        .join("\n"),
    );
    return;
  }
  // Siempre manda email: el digest si hay matches, o "sin vacantes nuevas hoy"
  // (latido diario, para que el silencio nunca se confunda con "se murió").
  await sendDigest(scored, {
    user: process.env.GMAIL_USER!,
    appPassword: process.env.GMAIL_APP_PASSWORD!,
    to: process.env.DIGEST_TO!,
    scanned: candidates.length,
    threshold: cfg.threshold,
  });

  // 7. persistir estado: vistas (solo las evaluadas) + cobertura progresiva
  // (las que el scorer no pudo evaluar se reintentan en la próxima corrida)
  const next = purge(markSeen(seen, evaluated, nowISO), nowISO, 60);
  saveSeen(next);
  saveSourcesState(srcState);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
