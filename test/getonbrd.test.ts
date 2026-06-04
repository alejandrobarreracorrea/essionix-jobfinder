import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { getonbrd } from "../src/fetchers/getonbrd.js";
const fixture = readFileSync("test/fixtures/getonbrd.json", "utf8");
afterEach(() => vi.restoreAllMocks());
describe("getonbrd fetcher", () => {
  it("parsea ofertas del response JSON:API", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => fixture }));
    const jobs = await getonbrd.fetch();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe("SRE");
    expect(jobs[0].url).toContain("/jobs/55");
    expect(jobs[0].remote).toBe(true);
  });
  it("devuelve [] si la red falla", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(await getonbrd.fetch()).toEqual([]);
  });
});
