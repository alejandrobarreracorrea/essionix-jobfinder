import type { Fetcher, RawJob } from "../types.js";
const stripHtml = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
export const jobicy: Fetcher = {
  name: "jobicy",
  async fetch(): Promise<RawJob[]> {
    try {
      const res = await fetch("https://jobicy.com/api/v2/remote-jobs?count=50&tag=devops", { headers: { "User-Agent": "essionix-jobfinder" }, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) return [];
      const data = JSON.parse(await res.text()) as { jobs?: any[] };
      return (data.jobs ?? []).map((d) => ({
        title: d.jobTitle,
        company: d.companyName,
        location: d.jobGeo || "Remote",
        url: d.url,
        description: stripHtml(d.jobDescription ?? d.jobExcerpt ?? ""),
        postedAt: d.pubDate ?? null,
        salary: null,
        remote: true,
      }));
    } catch { return []; }
  },
};
