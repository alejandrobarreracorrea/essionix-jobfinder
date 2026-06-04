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
