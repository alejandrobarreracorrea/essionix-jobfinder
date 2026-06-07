import type { Fetcher, RawJob } from "../types.js";
const stripHtml = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
export const workingnomads: Fetcher = {
  name: "workingnomads",
  async fetch(): Promise<RawJob[]> {
    try {
      const res = await fetch("https://www.workingnomads.com/api/exposed_jobs/", { headers: { "User-Agent": "essionix-jobfinder" }, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) return [];
      const data = JSON.parse(await res.text());
      const list: any[] = Array.isArray(data) ? data : [];
      return list
        .filter((d) => d.url && d.title)
        .map((d) => ({
          title: d.title,
          company: d.company_name ?? "",
          location: d.location || "Remote",
          url: d.url,
          description: stripHtml(d.description ?? ""),
          postedAt: d.pub_date ?? null,
          salary: null,
          remote: true,
        }));
    } catch { return []; }
  },
};
