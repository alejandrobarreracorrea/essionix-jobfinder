import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { themuse } from "../src/fetchers/themuse.js";
const fixture = readFileSync("test/fixtures/themuse.json", "utf8");
afterEach(() => vi.restoreAllMocks());
describe("themuse fetcher", () => {
  it("parsea ofertas del response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => fixture }));
    const jobs = await themuse.fetch();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe("DevOps Engineer");
    expect(jobs[0].company).toBe("Delta");
    expect(jobs[0].url).toContain("/jobs/delta/");
    expect(jobs[0].location).toBe("Flexible / Remote");
  });
  it("devuelve [] si la red falla", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(await themuse.fetch()).toEqual([]);
  });
});
