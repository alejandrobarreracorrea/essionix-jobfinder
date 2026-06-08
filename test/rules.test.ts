import { describe, it, expect } from "vitest";
import { passesRules, isRecent, type RulesConfig } from "../src/rules.js";
import type { Job } from "../src/types.js";

const cfg: RulesConfig = {
  threshold: 65,
  include: ["devops", "aws", "terraform"],
  exclude: ["presencial", "on-site"],
};

const base: Job = {
  id: "1", title: "DevOps Engineer", company: "Acme", location: "Remote",
  remote: true, url: "u", description: "AWS Terraform", postedAt: null,
  source: "s", salary: null,
};

describe("passesRules", () => {
  it("pasa cuando es remoto y matchea include", () => {
    expect(passesRules(base, cfg)).toBe(true);
  });
  it("descarta si no es remoto", () => {
    expect(passesRules({ ...base, remote: false }, cfg)).toBe(false);
  });
  it("descarta si no matchea ningún include", () => {
    expect(passesRules({ ...base, title: "Chef", description: "cooking" }, cfg)).toBe(false);
  });
  it("descarta si matchea un exclude (red-flag)", () => {
    expect(passesRules({ ...base, description: "AWS pero presencial obligatorio" }, cfg)).toBe(false);
  });
});

describe("isRecent", () => {
  const now = "2026-06-08T00:00:00Z";
  it("acepta una vacante fresca (dentro del límite)", () => {
    expect(isRecent({ ...base, postedAt: "2026-06-01T00:00:00Z" }, 21, now)).toBe(true);
  });
  it("descarta una vacante vieja (fuera del límite)", () => {
    expect(isRecent({ ...base, postedAt: "2026-04-01T00:00:00Z" }, 21, now)).toBe(false);
  });
  it("sin fecha de publicación → no filtra (no sabemos la edad)", () => {
    expect(isRecent({ ...base, postedAt: null }, 21, now)).toBe(true);
  });
  it("sin límite configurado → no filtra", () => {
    expect(isRecent({ ...base, postedAt: "2020-01-01T00:00:00Z" }, undefined, now)).toBe(true);
  });
  it("fecha inválida → no filtra", () => {
    expect(isRecent({ ...base, postedAt: "no-es-fecha" }, 21, now)).toBe(true);
  });
});
