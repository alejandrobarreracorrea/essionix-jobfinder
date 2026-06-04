import { readFileSync } from "node:fs";
import { FETCHERS } from "./fetchers/index.js";
import { normalize } from "./normalize.js";
import { loadRules, passesRules } from "./rules.js";
import { loadSeen, saveSeen, filterUnseen, markSeen, purge } from "./state.js";
import { scoreJob } from "./scorer.js";
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

  // 5. score IA (umbral)
  const scored: ScoredJob[] = [];
  const evaluated: Job[] = []; // solo las que el scorer evaluó sin lanzar
  for (const job of candidates) {
    try {
      const score = await scoreJob(job, profile);
      evaluated.push(job);
      if (score.score >= cfg.threshold) scored.push({ ...job, score });
    } catch (e) {
      console.error(`[score] omitida ${job.id}: ${(e as Error).message}`);
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
