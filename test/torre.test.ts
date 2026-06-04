import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { torre } from "../src/fetchers/torre.js";
const fixture = readFileSync("test/fixtures/torre.json", "utf8");
afterEach(() => vi.restoreAllMocks());
describe("torre fetcher", () => {
  it("parsea ofertas y envía POST body correcto", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, text: async () => fixture });
    vi.stubGlobal("fetch", mockFetch);
    const jobs = await torre.fetch();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe("DevOps Engineer");
    expect(jobs[0].company).toBe("Torre Co");
    expect(jobs[0].url).toContain("/post/abc");
    const callArgs = mockFetch.mock.calls[0][1] as RequestInit;
    expect(callArgs.method).toBe("POST");
  });
  it("devuelve [] si la red falla", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(await torre.fetch()).toEqual([]);
  });
});
