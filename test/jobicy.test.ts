import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { jobicy } from "../src/fetchers/jobicy.js";
const fixture = readFileSync("test/fixtures/jobicy.json", "utf8");
afterEach(() => vi.restoreAllMocks());
describe("jobicy fetcher", () => {
  it("parsea ofertas del response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => fixture }));
    const jobs = await jobicy.fetch();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe("DevOps Engineer");
    expect(jobs[0].company).toBe("Acme");
    expect(jobs[0].url).toBe("https://jobicy.com/jobs/1-devops");
    expect(jobs[0].remote).toBe(true);
  });
  it("devuelve [] si la red falla", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(await jobicy.fetch()).toEqual([]);
  });
});
