import type { Fetcher, RawJob } from "../types.js";
const stripHtml = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
export const getonbrd: Fetcher = {
  name: "getonbrd",
  async fetch(): Promise<RawJob[]> {
    try {
      const res = await fetch("https://www.getonbrd.com/api/v0/categories/programming/jobs", { headers: { "User-Agent": "essionix-jobfinder" }, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) return [];
      const data = JSON.parse(await res.text()) as { data?: any[] };
      return (data.data ?? []).map((d) => ({
        title: d.attributes?.title ?? "",
        company: d.attributes?.company?.data?.attributes?.name ?? "",
        location: "Remote",
        url: `https://www.getonbrd.com/jobs/${d.id}`,
        description: stripHtml(d.attributes?.description ?? ""),
        postedAt: d.attributes?.published_at ?? null,
        salary: null,
        remote: d.attributes?.remote ?? true,
      }));
    } catch { return []; }
  },
};
