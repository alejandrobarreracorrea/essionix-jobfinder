import type { Fetcher, RawJob } from "../types.js";
const BASE = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=devops%20sre&location=Latin%20America&f_WT=2&start=0";
const pick = (html: string, re: RegExp) => (html.match(re)?.[1] ?? "").trim();
export const linkedin: Fetcher = {
  name: "linkedin",
  async fetch(): Promise<RawJob[]> {
    try {
      const res = await fetch(BASE, { headers: { "User-Agent": "Mozilla/5.0 essionix-jobfinder" }, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) return [];
      const html = await res.text();
      const cards = html.split("<li>").filter((c) => c.includes("base-card"));
      return cards.map((c) => ({
        title: pick(c, /base-search-card__title">([^<]+)</),
        company: pick(c, /base-search-card__subtitle">([^<]+)</),
        location: pick(c, /job-search-card__location">([^<]+)</) || "Remote",
        url: c.match(/href="(https:\/\/www\.linkedin\.com\/jobs\/view\/[^"?]+)/)?.[1] ?? "",
        description: "", postedAt: null, salary: null, remote: true,
      })).filter((j) => j.title && j.url);
    } catch { return []; }
  },
};
