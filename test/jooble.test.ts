import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { jooble } from "../src/fetchers/jooble.js";

const fixture = readFileSync("test/fixtures/jooble.json", "utf8");

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.JOOBLE_API_KEY;
});

describe("jooble fetcher", () => {
  it("sin JOOBLE_API_KEY devuelve [] y no llama a fetch", async () => {
    delete process.env.JOOBLE_API_KEY;
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await jooble.fetch()).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });

  it("con key parsea jobs, mapea link→url y detecta remoto", async () => {
    process.env.JOOBLE_API_KEY = "k";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => fixture }));
    const jobs = await jooble.fetch();
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs[0].title).toBe("DevOps Engineer (Remoto)");
    expect(jobs[0].company).toBe("Acme Cloud");
    expect(jobs[0].url).toBe("https://jooble.org/jdp/123456");
    expect(jobs[0].remote).toBe(true);
  });

  it("consulta vía POST (una vez por ubicación configurada)", async () => {
    process.env.JOOBLE_API_KEY = "k";
    const f = vi.fn().mockResolvedValue({ ok: true, text: async () => fixture });
    vi.stubGlobal("fetch", f);
    await jooble.fetch();
    expect(f.mock.calls.length).toBeGreaterThan(0);
    expect(f.mock.calls[0][1].method).toBe("POST");
  });

  it("tolera fallos de red (devuelve [])", async () => {
    process.env.JOOBLE_API_KEY = "k";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("net")));
    expect(await jooble.fetch()).toEqual([]);
  });
});
