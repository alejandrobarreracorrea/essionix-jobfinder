import { describe, it, expect } from "vitest";
import { normalize, jobId } from "../src/normalize.js";
import type { RawJob } from "../src/types.js";

const raw: RawJob = {
  title: "SRE Contractor",
  company: "Acme",
  location: "Remote - LATAM",
  url: "https://acme.com/jobs/1",
  description: "Terraform and AWS",
  postedAt: "2026-06-01T00:00:00Z",
  salary: null,
};

describe("normalize", () => {
  it("genera id estable a partir de source+url", () => {
    const a = jobId("remoteok", raw.url);
    const b = jobId("remoteok", raw.url);
    expect(a).toBe(b);
    expect(jobId("remotive", raw.url)).not.toBe(a);
  });

  it("infiere remote=true desde la location cuando no viene explícito", () => {
    const job = normalize("remoteok", raw);
    expect(job.remote).toBe(true);
    expect(job.source).toBe("remoteok");
    expect(job.id).toBe(jobId("remoteok", raw.url));
  });

  it("respeta remote explícito de la fuente", () => {
    const job = normalize("x", { ...raw, location: "Bogota", remote: true });
    expect(job.remote).toBe(true);
  });

  it("remote=false cuando ni location ni flag lo indican", () => {
    const job = normalize("x", { ...raw, location: "Bogota oficina" });
    expect(job.remote).toBe(false);
  });
});
