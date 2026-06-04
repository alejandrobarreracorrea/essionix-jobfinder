export interface RawJob {
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  postedAt: string | null; // ISO 8601 o null
  salary: string | null;
  remote?: boolean; // si la fuente lo indica explícito
}

export interface Job {
  id: string; // hash estable de source+url
  title: string;
  company: string;
  location: string;
  remote: boolean;
  url: string;
  description: string;
  postedAt: string | null;
  source: string;
  salary: string | null;
}

export interface Fetcher {
  name: string;
  fetch(): Promise<RawJob[]>;
}

export interface Score {
  score: number; // 0-100
  reason: string;
  highlights: string[];
}

export interface ScoredJob extends Job {
  score: Score;
}
