import { readFileSync } from "node:fs";
import type { Job } from "./types.js";

export interface RulesConfig {
  threshold: number;
  include: string[];
  exclude: string[];
  maxAgeDays?: number; // descarta vacantes con fecha más vieja que esto (links muertos)
  sourceThresholds?: Record<string, number>; // umbral más alto por fuente (ej. jooble: 75)
}

export function loadRules(path = "config/rules.json"): RulesConfig {
  return JSON.parse(readFileSync(path, "utf8")) as RulesConfig;
}

// Umbral efectivo para una fuente: el específico si existe, o el general.
export function thresholdFor(source: string, cfg: RulesConfig): number {
  return cfg.sourceThresholds?.[source] ?? cfg.threshold;
}

export function passesRules(job: Job, cfg: RulesConfig): boolean {
  if (!job.remote) return false;
  const hay = `${job.title} ${job.description} ${job.location}`.toLowerCase();
  if (cfg.exclude.some((kw) => hay.includes(kw.toLowerCase()))) return false;
  return cfg.include.some((kw) => hay.includes(kw.toLowerCase()));
}

// Frescura: vacantes viejas suelen estar ya cerradas ("no longer available").
// Sin límite o sin fecha (o fecha inválida) → no filtra (no podemos saber la edad).
export function isRecent(job: Job, maxAgeDays: number | undefined, nowISO: string): boolean {
  if (!maxAgeDays || !job.postedAt) return true;
  const posted = new Date(job.postedAt).getTime();
  if (Number.isNaN(posted)) return true;
  const ageDays = (new Date(nowISO).getTime() - posted) / 86_400_000;
  return ageDays <= maxAgeDays;
}
