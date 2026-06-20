import { describe, it, expect, vi, afterEach } from "vitest";
import { isDead, filterLive } from "../src/liveness.js";

afterEach(() => vi.restoreAllMocks());

describe("isDead", () => {
  it("marca muerta si el cuerpo dice 'no longer available'", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200, text: async () => "<p>This job position is no longer available</p>",
    }));
    expect(await isDead("u")).toBe(true);
  });

  it("marca muerta si dice 'ya no está disponible'", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200, text: async () => "<div>La oferta ya no está disponible</div>",
    }));
    expect(await isDead("u")).toBe(true);
  });

  it("marca muerta con HTTP 404/410", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => "" }));
    expect(await isDead("u")).toBe(true);
  });

  it("viva si el cuerpo es una oferta normal", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200, text: async () => "<h1>DevOps Engineer</h1><button>Apply</button>",
    }));
    expect(await isDead("u")).toBe(false);
  });

  it("mantiene (no muerta) ante bloqueo HTTP (403/429)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => "" }));
    expect(await isDead("u")).toBe(false);
  });

  it("mantiene (no muerta) ante error de red/timeout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    expect(await isDead("u")).toBe(false);
  });
});

describe("filterLive", () => {
  it("deja solo las vivas", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      const dead = url.includes("dead");
      return Promise.resolve({ ok: true, status: 200, text: async () => (dead ? "no longer available" : "Apply now") });
    }));
    const out = await filterLive([{ url: "ok/1" }, { url: "dead/2" }, { url: "ok/3" }]);
    expect(out.map((j) => j.url)).toEqual(["ok/1", "ok/3"]);
  });
});
