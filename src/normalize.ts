import { createHash } from "node:crypto";
import type { Job, RawJob } from "./types.js";

const REMOTE_RE = /\b(remote|remoto|remota|anywhere|teletrabajo)\b/i;

export function jobId(source: string, url: string): string {
  return createHash("sha256").update(`${source}::${url}`).digest("hex").slice(0, 16);
}

export function normalize(source: string, raw: RawJob): Job {
  const remote = raw.remote ?? REMOTE_RE.test(raw.location);
  return {
    id: jobId(source, raw.url),
    title: raw.title.trim(),
    company: raw.company.trim(),
    location: raw.location.trim(),
    remote,
    url: raw.url,
    description: raw.description,
    postedAt: raw.postedAt,
    source,
    salary: raw.salary,
  };
}
