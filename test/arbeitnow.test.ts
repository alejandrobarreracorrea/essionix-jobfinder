import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { arbeitnow } from "../src/fetchers/arbeitnow.js";
const fixture = readFileSync("test/fixtures/arbeitnow.json", "utf8");
afterEach(() => vi.restoreAllMocks());
describe("arbeitnow fetcher", () => {
  it("parsea ofertas del response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => fixture }));
    const jobs = await arbeitnow.fetch();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe("Cloud Engineer");
    expect(jobs[0].remote).toBe(true);
    expect(jobs[0].postedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  it("devuelve [] si la red falla", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(await arbeitnow.fetch()).toEqual([]);
  });
});
