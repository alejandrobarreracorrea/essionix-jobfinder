import type { Fetcher, RawJob } from "../types.js";
const stripHtml = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
export const themuse: Fetcher = {
  name: "themuse",
  async fetch(): Promise<RawJob[]> {
    try {
      const res = await fetch("https://www.themuse.com/api/public/jobs?page=0&category=Software%20Engineering", { headers: { "User-Agent": "essionix-jobfinder" }, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) return [];
      const data = JSON.parse(await res.text()) as { results?: any[] };
      return (data.results ?? [])
        .filter((d) => d.refs?.landing_page && d.name)
        .map((d) => ({
          title: d.name,
          company: d.company?.name ?? "",
          location: d.locations?.[0]?.name ?? "Remote",
          url: d.refs?.landing_page ?? "",
          description: stripHtml(d.contents ?? ""),
          postedAt: d.publication_date ?? null,
          salary: null,
        }));
    } catch { return []; }
  },
};
