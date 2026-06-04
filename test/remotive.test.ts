import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { remotive } from "../src/fetchers/remotive.js";
const fixture = readFileSync("test/fixtures/remotive.json", "utf8");
afterEach(() => vi.restoreAllMocks());
describe("remotive fetcher", () => {
  it("parsea ofertas del response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => fixture }));
    const jobs = await remotive.fetch();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe("DevOps Engineer");
    expect(jobs[0].company).toBe("Beta");
    expect(jobs[0].url).toBe("https://remotive.com/job/2");
  });
  it("devuelve [] si la red falla", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(await remotive.fetch()).toEqual([]);
  });
});
