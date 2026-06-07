import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { workingnomads } from "../src/fetchers/workingnomads.js";
const fixture = readFileSync("test/fixtures/workingnomads.json", "utf8");
afterEach(() => vi.restoreAllMocks());
describe("workingnomads fetcher", () => {
  it("parsea ofertas del response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => fixture }));
    const jobs = await workingnomads.fetch();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe("SRE Engineer");
    expect(jobs[0].company).toBe("Beta");
    expect(jobs[0].url).toContain("/job/go/1/");
  });
  it("devuelve [] si la red falla", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(await workingnomads.fetch()).toEqual([]);
  });
});
