import { readFileSync } from "node:fs";
import { FETCHERS } from "./fetchers/index.js";
import { normalize } from "./normalize.js";
import { loadRules, passesRules } from "./rules.js";
import { loadSeen, saveSeen, filterUnseen, markSeen, purge } from "./state.js";
import { scoreBatch } from "./scorer.js";
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

  // 6. email
  if (DRY) {
    console.log(
      scored
        .map((j) => `${j.score.score}  ${j.title} — ${j.company} (${j.url})`)
        .join("\n"),
    );
    return;
  }
  if (scored.length > 0) {
    await sendDigest(scored, {
      user: process.env.GMAIL_USER!,
      appPassword: process.env.GMAIL_APP_PASSWORD!,
      to: process.env.DIGEST_TO!,
    });
  }

  // 7. persistir estado: solo las evaluadas con éxito se marcan vistas
  // (las que el scorer no pudo evaluar se reintentan en la próxima corrida)
  const next = purge(markSeen(seen, evaluated, nowISO), nowISO, 60);
  saveSeen(next);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
