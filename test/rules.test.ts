import { describe, it, expect } from "vitest";
import { passesRules, type RulesConfig } from "../src/rules.js";
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
