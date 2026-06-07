import { describe, it, expect } from "vitest";
import { renderDigest } from "../src/email.js";
import type { ScoredJob } from "../src/types.js";

const sj: ScoredJob = {
  id: "1", title: "SRE Contractor", company: "Acme", location: "Remote",
  remote: true, url: "https://acme.com/1", description: "d", postedAt: null,
  source: "remoteok", salary: null,
  score: { score: 88, reason: "match fuerte", highlights: ["Terraform", "AWS"] },
};

describe("renderDigest", () => {
  it("incluye título, score, motivo y link", () => {
    const html = renderDigest([sj]);
    expect(html).toContain("SRE Contractor");
    expect(html).toContain("88");
    expect(html).toContain("match fuerte");
    expect(html).toContain("https://acme.com/1");
  });

  it("ordena por score descendente", () => {
    const low = { ...sj, id: "2", title: "Low", score: { score: 70, reason: "r", highlights: [] } };
    const html = renderDigest([low, sj]);
    expect(html.indexOf("SRE Contractor")).toBeLessThan(html.indexOf("Low"));
  });

  it("sin ofertas: muestra mensaje de 'sin vacantes' con conteo y umbral", () => {
    const html = renderDigest([], { scanned: 21, threshold: 65 });
    expect(html).toContain("sin vacantes nuevas");
    expect(html).toContain("21");
    expect(html).toContain("65");
  });

  it("sin ofertas sin meta: no rompe", () => {
    const html = renderDigest([]);
    expect(html).toContain("No se encontraron vacantes");
    expect(html).toContain("0 candidatas");
  });
});
