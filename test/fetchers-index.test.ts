import { describe, it, expect } from "vitest";
import { FETCHERS } from "../src/fetchers/index.js";
describe("registro de fetchers", () => {
  it("incluye las 7 fuentes con nombres únicos", () => {
    const names = FETCHERS.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(expect.arrayContaining(["remoteok","remotive","weworkremotely","himalayas","getonbrd","torre","linkedin"]));
  });
});
