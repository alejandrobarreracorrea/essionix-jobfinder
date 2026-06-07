import type { Fetcher, RawJob } from "../types.js";
const stripHtml = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
export const arbeitnow: Fetcher = {
  name: "arbeitnow",
  async fetch(): Promise<RawJob[]> {
    try {
      const res = await fetch("https://www.arbeitnow.com/api/job-board-api", { headers: { "User-Agent": "essionix-jobfinder" }, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) return [];
      const data = JSON.parse(await res.text()) as { data?: any[] };
      return (data.data ?? []).map((d) => ({
        title: d.title,
        company: d.company_name ?? "",
        location: d.location || "Remote",
        url: d.url,
        description: stripHtml(d.description ?? ""),
        postedAt: d.created_at ? new Date(d.created_at * 1000).toISOString() : null,
        salary: null,
        remote: !!d.remote,
      }));
    } catch { return []; }
  },
};
