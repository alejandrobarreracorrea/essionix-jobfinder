import { describe, it, expect, vi, beforeEach } from "vitest";

// Mockear el Agent SDK: query() es un async-generator que emite mensajes.
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({ query: vi.fn() }));
import { query } from "@anthropic-ai/claude-agent-sdk";
import { scoreBatch } from "../src/scorer.js";
import type { Job } from "../src/types.js";

const mkJob = (id: string, title: string): Job => ({
  id, title, company: "Acme", location: "Remote", remote: true, url: "u",
  description: "Terraform, AWS, Kubernetes. Español.", postedAt: null,
  source: "remoteok", salary: null,
});

function mockResult(result: string) {
  (query as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
    (async function* () {
      yield { type: "result", subtype: "success", result };
    })(),
  );
}

beforeEach(() => vi.clearAllMocks());

describe("scoreBatch", () => {
  it("mapea cada resultado a su id", async () => {
    mockResult(
      '[{"id":"a","score":88,"reason":"match","highlights":["AWS"]},' +
        '{"id":"b","score":40,"reason":"no","highlights":[]}]',
    );
    const map = await scoreBatch([mkJob("a", "SRE"), mkJob("b", "Designer")], "PERFIL");
    expect(map.get("a")?.score).toBe(88);
    expect(map.get("a")?.highlights).toContain("AWS");
    expect(map.get("b")?.score).toBe(40);
  });

  it("ignora ids que no pertenecen al lote", async () => {
    mockResult('[{"id":"INTRUSO","score":99,"reason":"x","highlights":[]}]');
    const map = await scoreBatch([mkJob("a", "SRE")], "PERFIL");
    expect(map.has("INTRUSO")).toBe(false);
    expect(map.size).toBe(0);
  });

  it("extrae el array aunque venga con fences/preámbulo", async () => {
    mockResult('```json\n[{"id":"a","score":70,"reason":"ok","highlights":[]}]\n```');
    const map = await scoreBatch([mkJob("a", "SRE")], "PERFIL");
    expect(map.get("a")?.score).toBe(70);
  });

  it("incluye perfil e ids en el prompt enviado a query", async () => {
    mockResult('[{"id":"a","score":50,"reason":"x","highlights":[]}]');
    await scoreBatch([mkJob("a", "SRE")], "PERFIL_UNICO_XYZ");
    const arg = (query as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const s = JSON.stringify(arg);
    expect(s).toContain("PERFIL_UNICO_XYZ");
    expect(s).toContain("id=a");
  });

  it("lanza si la respuesta no trae array JSON", async () => {
    mockResult("sin json aquí");
    await expect(scoreBatch([mkJob("a", "SRE")], "PERFIL")).rejects.toThrow();
  });

  it("devuelve Map vacío sin llamar al SDK si el lote está vacío", async () => {
    const map = await scoreBatch([], "PERFIL");
    expect(map.size).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });
});
