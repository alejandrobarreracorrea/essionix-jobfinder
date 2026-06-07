import { describe, it, expect } from "vitest";
import { expandIfDue, activeFetchers, type SourcesState } from "../src/sources.js";
import type { Fetcher } from "../src/types.js";

const mkFetchers = (n: number): Fetcher[] =>
  Array.from({ length: n }, (_, i) => ({ name: `f${i}`, fetch: async () => [] }));

describe("expandIfDue", () => {
  it("primera vez (reloj sin inicializar): fija el reloj, no amplía", () => {
    const out = expandIfDue({ activeCount: 5, lastExpandedISO: "" }, 11, "2026-06-07T00:00:00Z");
    expect(out.activeCount).toBe(5);
    expect(out.lastExpandedISO).toBe("2026-06-07T00:00:00Z");
  });

  it("amplía en STEP cuando pasaron >= 2 días", () => {
    const out = expandIfDue({ activeCount: 5, lastExpandedISO: "2026-06-05T00:00:00Z" }, 11, "2026-06-07T00:00:00Z");
    expect(out.activeCount).toBe(7);
    expect(out.lastExpandedISO).toBe("2026-06-07T00:00:00Z");
  });

  it("no amplía si pasó menos de 2 días", () => {
    const prev: SourcesState = { activeCount: 5, lastExpandedISO: "2026-06-06T00:00:00Z" };
    const out = expandIfDue(prev, 11, "2026-06-07T00:00:00Z");
    expect(out.activeCount).toBe(5);
    expect(out.lastExpandedISO).toBe("2026-06-06T00:00:00Z");
  });

  it("topa en el total y no vuelve a tocar el reloj", () => {
    const out = expandIfDue({ activeCount: 11, lastExpandedISO: "2026-01-01T00:00:00Z" }, 11, "2026-06-07T00:00:00Z");
    expect(out.activeCount).toBe(11);
    expect(out.lastExpandedISO).toBe("2026-01-01T00:00:00Z");
  });

  it("cerca del tope, amplía solo hasta el total", () => {
    const out = expandIfDue({ activeCount: 10, lastExpandedISO: "2026-06-04T00:00:00Z" }, 11, "2026-06-07T00:00:00Z");
    expect(out.activeCount).toBe(11);
  });
});

describe("activeFetchers", () => {
  it("toma los primeros activeCount del catálogo", () => {
    const all = mkFetchers(11);
    const active = activeFetchers(all, { activeCount: 7, lastExpandedISO: "x" });
    expect(active.map((f) => f.name)).toEqual(["f0", "f1", "f2", "f3", "f4", "f5", "f6"]);
  });

  it("nunca pasa del tamaño del catálogo", () => {
    const all = mkFetchers(3);
    expect(activeFetchers(all, { activeCount: 99, lastExpandedISO: "x" })).toHaveLength(3);
  });
});
