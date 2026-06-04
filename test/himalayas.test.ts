import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { himalayas } from "../src/fetchers/himalayas.js";
const fixture = readFileSync("test/fixtures/himalayas.json", "utf8");
afterEach(() => vi.restoreAllMocks());
describe("himalayas fetcher", () => {
  it("parsea ofertas del response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => fixture }));
    const jobs = await himalayas.fetch();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe("Platform Engineer");
    expect(jobs[0].company).toBe("Hima");
    expect(jobs[0].url).toBe("https://himalayas.app/jobs/4");
    expect(jobs[0].remote).toBe(true);
  });
  it("devuelve [] si la red falla", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(await himalayas.fetch()).toEqual([]);
  });
});
