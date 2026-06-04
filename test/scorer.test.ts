import { describe, it, expect, vi } from "vitest";
import { scoreJob } from "../src/scorer.js";
import type { Job } from "../src/types.js";

const job: Job = {
  id: "1", title: "SRE Contractor (Remote LATAM)", company: "Acme",
  location: "Remote", remote: true, url: "u",
  description: "Terraform, AWS, Kubernetes. Español.", postedAt: null,
  source: "remoteok", salary: null,
};

function fakeClient(payload: object) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "tool_use", name: "report_score", input: payload }],
      }),
    },
  } as any;
}

describe("scoreJob", () => {
  it("devuelve el Score del tool_use", async () => {
    const client = fakeClient({ score: 88, reason: "match fuerte", highlights: ["Terraform", "AWS"] });
    const s = await scoreJob(client, job, "PERFIL");
    expect(s.score).toBe(88);
    expect(s.highlights).toContain("Terraform");
  });

  it("envía el perfil como bloque cacheado", async () => {
    const client = fakeClient({ score: 70, reason: "ok", highlights: [] });
    await scoreJob(client, job, "PERFIL");
    const arg = client.messages.create.mock.calls[0][0];
    const sys = arg.system;
    expect(JSON.stringify(sys)).toContain("cache_control");
    expect(JSON.stringify(sys)).toContain("PERFIL");
  });
});
