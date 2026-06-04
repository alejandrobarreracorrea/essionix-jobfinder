import { describe, it, expect } from "vitest";
import { filterUnseen, markSeen, purge } from "../src/state.js";
import type { Job } from "../src/types.js";

const job = (id: string): Job => ({
  id, title: "t", company: "c", location: "Remote", remote: true,
  url: "u", description: "d", postedAt: null, source: "s", salary: null,
});

describe("state", () => {
  it("filterUnseen deja solo ids no vistos", () => {
    const seen = { a: "2026-06-01T00:00:00Z" };
    const out = filterUnseen([job("a"), job("b")], seen);
    expect(out.map((j) => j.id)).toEqual(["b"]);
  });

  it("markSeen agrega ids con timestamp dado", () => {
    const seen = markSeen({}, [job("x")], "2026-06-04T00:00:00Z");
    expect(seen["x"]).toBe("2026-06-04T00:00:00Z");
  });

  it("purge elimina entradas más viejas que N días", () => {
    const seen = { old: "2026-01-01T00:00:00Z", fresh: "2026-06-03T00:00:00Z" };
    const out = purge(seen, "2026-06-04T00:00:00Z", 60);
    expect(out).toEqual({ fresh: "2026-06-03T00:00:00Z" });
  });
});
