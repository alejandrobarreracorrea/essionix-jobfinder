import type { Fetcher, RawJob } from "../types.js";

// Jooble: agregador que cubre portales nacionales hispanos (Computrabajo, elempleo,
// Bumeran, OCC, Laborum, etc.) que NO tienen API propia. API REST gratis con key
// (JOOBLE_API_KEY). Sin key → []. Consulta país por país; un país que falla no
// tumba al resto. El dedup entre países lo hace el orquestador (hash source+url).
const stripHtml = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const REMOTE = /\b(remote|remoto|remota|teletrabajo|home\s?office)\b/i;

const COUNTRIES = ["México", "Argentina", "Chile", "Perú", "Ecuador", "Colombia", "España"];
const KEYWORDS = "devops sre cloud kubernetes";

export const jooble: Fetcher = {
  name: "jooble",
  async fetch(): Promise<RawJob[]> {
    const key = process.env.JOOBLE_API_KEY;
    if (!key) return [];
    const out: RawJob[] = [];
    for (const location of COUNTRIES) {
      try {
        const res = await fetch(`https://jooble.org/api/${key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": "essionix-jobfinder" },
          body: JSON.stringify({ keywords: KEYWORDS, location }),
          signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) continue;
        const data = JSON.parse(await res.text()) as { jobs?: any[] };
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
      } catch {
        /* un país falla → seguimos con los demás */
      }
    }
    return out;
  },
};
