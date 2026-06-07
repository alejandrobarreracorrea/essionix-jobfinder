import type { Fetcher, RawJob } from "../types.js";

// Jooble: agregador que cubre portales nacionales hispanos (Computrabajo, elempleo,
// Bumeran, OCC, Laborum, etc.) que NO tienen API propia. API REST gratis con key
// (JOOBLE_API_KEY). Sin key → []. Consulta país por país; un país que falla no
// tumba al resto. El dedup entre países lo hace el orquestador (hash source+url).
const stripHtml = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const REMOTE = /\b(remote|remoto|remota|teletrabajo|home\s?office)\b/i;

// Jooble geocodifica por CIUDAD, no por país ("Colombia"→0, "Bogota"→62). Usamos
// "Remote" (pozo grande de remotos) + las capitales de cada país hispano (sin acentos).
const COUNTRIES = ["Remote", "Bogota", "Mexico", "Buenos Aires", "Santiago", "Lima", "Quito", "Madrid"];
const KEYWORDS = "devops";
const DEBUG = !!process.env.JOBFINDER_DEBUG;

export const jooble: Fetcher = {
  name: "jooble",
  async fetch(): Promise<RawJob[]> {
    const key = process.env.JOOBLE_API_KEY;
    if (!key) {
      if (DEBUG) console.error("[jooble] sin JOOBLE_API_KEY");
      return [];
    }
    if (DEBUG) console.error(`[jooble] key presente (len=${key.length})`);
    const out: RawJob[] = [];
    for (const location of COUNTRIES) {
      try {
        const res = await fetch(`https://jooble.org/api/${key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": "essionix-jobfinder" },
          body: JSON.stringify({ keywords: KEYWORDS, location }),
          signal: AbortSignal.timeout(30_000),
        });
        const body = await res.text();
        if (!res.ok) {
          if (DEBUG) console.error(`[jooble] ${location}: HTTP ${res.status} body=${body.slice(0, 200)}`);
          continue;
        }
        const data = JSON.parse(body) as { jobs?: any[]; totalCount?: number };
        if (DEBUG) {
          console.error(
            `[jooble] ${location}: ${(data.jobs ?? []).length} jobs (totalCount=${data.totalCount ?? "?"})`,
          );
        }
        for (const j of data.jobs ?? []) {
          if (!j || !j.title || !j.link) continue;
          const loc = String(j.location ?? location);
          const snippet = stripHtml(String(j.snippet ?? ""));
          out.push({
            title: String(j.title),
            company: String(j.company ?? ""),
            location: loc,
            url: String(j.link),
            description: snippet,
            postedAt: typeof j.updated === "string" ? j.updated : null,
            salary: j.salary || null,
            remote: REMOTE.test(`${j.title} ${loc} ${snippet}`),
          });
        }
      } catch (e) {
        if (DEBUG) console.error(`[jooble] ${location}: error ${(e as Error).message}`);
        /* un país falla → seguimos con los demás */
      }
    }
    return out;
  },
};
