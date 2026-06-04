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
