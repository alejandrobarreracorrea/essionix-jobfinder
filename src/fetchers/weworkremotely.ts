import { XMLParser } from "fast-xml-parser";
import type { Fetcher, RawJob } from "../types.js";
const parser = new XMLParser();
export const weworkremotely: Fetcher = {
  name: "weworkremotely",
  async fetch(): Promise<RawJob[]> {
    try {
      const res = await fetch("https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss", { headers: { "User-Agent": "essionix-jobfinder" } });
      if (!res.ok) return [];
      const xml = parser.parse(await res.text());
      const items = xml?.rss?.channel?.item;
      const list = Array.isArray(items) ? items : items ? [items] : [];
      return list.map((it: any) => {
        const full: string = String(it.title ?? "");
        const [company, ...rest] = full.split(":");
        const title = rest.join(":").trim() || full;
        return {
          title, company: rest.length ? company.trim() : "",
          location: String(it.region ?? "Remote"), url: String(it.link ?? ""),
          description: String(it.description ?? ""),
          postedAt: it.pubDate ? new Date(String(it.pubDate)).toISOString() : null,
          salary: null, remote: true,
        };
      });
    } catch { return []; }
  },
};
