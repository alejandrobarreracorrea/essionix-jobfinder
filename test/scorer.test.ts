import { describe, it, expect, vi, beforeEach } from "vitest";

// Mockear el Agent SDK: query() es un async-generator que emite mensajes.
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({ query: vi.fn() }));
import { query } from "@anthropic-ai/claude-agent-sdk";
import { scoreJob } from "../src/scorer.js";
import type { Job } from "../src/types.js";

const job: Job = {
  id: "1", title: "SRE Contractor (Remote LATAM)", company: "Acme",
  location: "Remote", remote: true, url: "u",
  description: "Terraform, AWS, Kubernetes. Español.", postedAt: null,
  source: "remoteok", salary: null,
};

function mockResult(result: string) {
  (query as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
    (async function* () {
      yield { type: "result", result };
    })(),
  );
}

beforeEach(() => vi.clearAllMocks());

describe("scoreJob", () => {
  it("parsea el JSON del resultado", async () => {
    mockResult('{"score":88,"reason":"match fuerte","highlights":["Terraform","AWS"]}');
    const s = await scoreJob(job, "PERFIL");
    expect(s.score).toBe(88);
    expect(s.highlights).toContain("Terraform");
  });

  it("extrae el JSON aunque venga con texto alrededor", async () => {
    mockResult('Claro:\n{"score":70,"reason":"ok","highlights":[]}\nlisto');
    const s = await scoreJob(job, "PERFIL");
    expect(s.score).toBe(70);
  });

  it("incluye el perfil en el prompt enviado a query", async () => {
    mockResult('{"score":50,"reason":"x","highlights":[]}');
    await scoreJob(job, "PERFIL_UNICO_XYZ");
    const arg = (query as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(JSON.stringify(arg)).toContain("PERFIL_UNICO_XYZ");
  });

  it("lanza si la respuesta no trae JSON", async () => {
    mockResult("sin json aquí");
    await expect(scoreJob(job, "PERFIL")).rejects.toThrow();
  });
});
