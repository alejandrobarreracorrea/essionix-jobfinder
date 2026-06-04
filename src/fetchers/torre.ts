import type { Fetcher, RawJob } from "../types.js";
export const torre: Fetcher = {
  name: "torre",
  async fetch(): Promise<RawJob[]> {
    try {
      const res = await fetch("https://search.torre.co/opportunities/_search/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "essionix-jobfinder" },
        body: JSON.stringify({ remote: true, "skill/role": { text: "devops" } }),
      });
      if (!res.ok) return [];
      const data = JSON.parse(await res.text()) as any[];
      return data
        .filter((d) => d && d.id && d.objective)
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
