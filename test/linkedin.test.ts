import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { linkedin } from "../src/fetchers/linkedin.js";
const fixture = readFileSync("test/fixtures/linkedin.html", "utf8");
afterEach(() => vi.restoreAllMocks());
describe("linkedin fetcher", () => {
  it("parsea ofertas del HTML", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => fixture }));
    const jobs = await linkedin.fetch();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe("SRE Contractor");
    expect(jobs[0].company).toBe("Acme");
    expect(jobs[0].url).toContain("/jobs/view/4");
  });
  it("devuelve [] si la respuesta no es ok (anti-bot)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 999, text: async () => "" }));
    expect(await linkedin.fetch()).toEqual([]);
  });
});
