import type { Fetcher, RawJob } from "../types.js";
const stripHtml = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
export const remotive: Fetcher = {
  name: "remotive",
  async fetch(): Promise<RawJob[]> {
    try {
      const res = await fetch("https://remotive.com/api/remote-jobs?category=devops", { headers: { "User-Agent": "essionix-jobfinder" }, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) return [];
      const data = JSON.parse(await res.text()) as { jobs?: any[] };
      return (data.jobs ?? []).map((d) => ({
        title: d.title, company: d.company_name ?? "", location: d.candidate_required_location || "Remote",
        url: d.url, description: stripHtml(d.description ?? ""), postedAt: d.publication_date ?? null,
        salary: d.salary || null, remote: true,
      }));
    } catch { return []; }
  },
};
