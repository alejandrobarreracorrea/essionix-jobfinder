import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { weworkremotely } from "../src/fetchers/weworkremotely.js";
const fixture = readFileSync("test/fixtures/wwr.xml", "utf8");
afterEach(() => vi.restoreAllMocks());
describe("weworkremotely fetcher", () => {
  it("parsea ofertas del RSS", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => fixture }));
    const jobs = await weworkremotely.fetch();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].company).toBe("Company");
    expect(jobs[0].title).toBe("SRE Engineer");
    expect(jobs[0].url).toBe("https://weworkremotely.com/jobs/3");
  });
  it("devuelve [] si la red falla", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(await weworkremotely.fetch()).toEqual([]);
  });
});
