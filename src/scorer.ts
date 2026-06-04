import Anthropic from "@anthropic-ai/sdk";
import type { Job, Score } from "./types.js";

const MODEL = "claude-haiku-4-5";

const TOOL: Anthropic.Messages.Tool = {
  name: "report_score",
  description: "Reporta el puntaje de encaje de la oferta con el perfil.",
  input_schema: {
    type: "object",
    properties: {
      score: { type: "number", description: "0-100" },
      reason: { type: "string", description: "1-2 frases" },
      highlights: { type: "array", items: { type: "string" } },
    },
    required: ["score", "reason", "highlights"],
  },
};

export function buildClient(apiKey = process.env.ANTHROPIC_API_KEY): Anthropic {
  return new Anthropic({ apiKey });
}

export async function scoreJob(client: Anthropic, job: Job, profile: string): Promise<Score> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "report_score" },
    system: [
      {
        type: "text",
        text:
          "Eres un evaluador de ofertas de empleo. Puntúa de 0-100 qué tan bien encaja la oferta con el perfil. " +
          "Premia: contractor/freelance, remoto, español, DevOps/SRE/Cloud, y el combo SRE+DBA. " +
          "Penaliza: on-site, relocation, solo-junior.\n\nPERFIL:\n" + profile,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content:
          `Oferta:\nTítulo: ${job.title}\nEmpresa: ${job.company}\n` +
          `Ubicación: ${job.location}\nFuente: ${job.source}\n` +
          `Descripción: ${job.description.slice(0, 4000)}`,
      },
    ],
  });
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("sin tool_use en la respuesta");
  return block.input as unknown as Score;
}
