import type { Fetcher, RawJob } from "../types.js";
const stripHtml = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
export const remoteok: Fetcher = {
  name: "remoteok",
  async fetch(): Promise<RawJob[]> {
    try {
      const res = await fetch("https://remoteok.com/api", { headers: { "User-Agent": "essionix-jobfinder" } });
      if (!res.ok) return [];
      const data = JSON.parse(await res.text()) as any[];
      return data.filter((d) => d && d.position && d.url).map((d) => ({
        title: d.position, company: d.company ?? "", location: d.location || "Remote",
        url: d.url, description: stripHtml(d.description ?? ""), postedAt: d.date ?? null,
        salary: d.salary_min ? `${d.salary_min}` : null, remote: true,
      }));
    } catch { return []; }
  },
};
