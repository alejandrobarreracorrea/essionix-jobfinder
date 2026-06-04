import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { remoteok } from "../src/fetchers/remoteok.js";
const fixture = readFileSync("test/fixtures/remoteok.json", "utf8");
afterEach(() => vi.restoreAllMocks());
describe("remoteok fetcher", () => {
  it("parsea ofertas saltando el elemento de metadata", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => fixture }));
    const jobs = await remoteok.fetch();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe("Senior SRE");
    expect(jobs[0].url).toBe("https://remoteok.com/remote-jobs/1");
    expect(jobs[0].remote).toBe(true);
  });
  it("devuelve [] si la red falla", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(await remoteok.fetch()).toEqual([]);
  });
});
