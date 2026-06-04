import type { Fetcher, RawJob } from "../types.js";
const stripHtml = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
export const himalayas: Fetcher = {
  name: "himalayas",
  async fetch(): Promise<RawJob[]> {
    try {
      const res = await fetch("https://himalayas.app/jobs/api?limit=50", { headers: { "User-Agent": "essionix-jobfinder" } });
      if (!res.ok) return [];
      const data = JSON.parse(await res.text()) as { jobs?: any[] };
      return (data.jobs ?? []).map((d) => {
        const loc = Array.isArray(d.locationRestrictions)
          ? d.locationRestrictions.join(", ")
          : d.locationRestrictions ? String(d.locationRestrictions) : "Remote";
        return {
          title: d.title, company: d.companyName ?? "",
          location: loc || "Remote",
          url: d.applicationLink,
          description: stripHtml(d.description ?? ""),
          postedAt: d.pubDate ?? null,
          salary: null, remote: true,
        };
      });
    } catch { return []; }
  },
};
