import type { Fetcher, RawJob } from "../types.js";
export const torre: Fetcher = {
  name: "torre",
  async fetch(): Promise<RawJob[]> {
    try {
      const res = await fetch("https://search.torre.co/opportunities/_search/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "essionix-jobfinder" },
        body: JSON.stringify({ remote: true, "skill/role": { text: "devops" } }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) return [];
      const data = JSON.parse(await res.text());
      const list = Array.isArray(data) ? data : [];
      return list
        .filter((d: any) => d && d.id && d.objective)
        .map((d) => ({
          title: d.objective,
          company: d.organizations?.[0]?.name ?? "",
          location: "Remote",
          url: `https://torre.ai/post/${d.id}`,
          description: d.objective,
          postedAt: null,
          salary: null,
          remote: true,
        }));
    } catch { return []; }
  },
};
