import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Job, Score } from "./types.js";

// Sonnet: el modelo disponible en suscripción (Haiku solo va por API key).
const MODEL = "claude-sonnet-4-6";

const SYSTEM =
  "Eres un evaluador de ofertas de empleo. Devuelve SOLO un objeto JSON válido " +
  "(sin markdown, sin ```, sin texto antes ni después) con exactamente estas claves: " +
  '"score" (número 0-100), "reason" (1-2 frases), "highlights" (array de strings). ' +
  "Premia: contractor/freelance, remoto, español, DevOps/SRE/Cloud, y el combo SRE+DBA. " +
  "Penaliza: on-site, relocation obligatorio, roles solo-junior.";

// Usa el Claude Agent SDK, autenticado con la suscripción (CLAUDE_CODE_OAUTH_TOKEN)
// — no requiere saldo de API. Una llamada por oferta, sin herramientas (solo texto).
export async function scoreJob(job: Job, profile: string): Promise<Score> {
  const prompt =
    `PERFIL DEL CANDIDATO:\n${profile}\n\n` +
    `OFERTA:\nTítulo: ${job.title}\nEmpresa: ${job.company}\n` +
    `Ubicación: ${job.location}\nFuente: ${job.source}\n` +
    `Descripción: ${job.description.slice(0, 4000)}\n\n` +
    "Puntúa qué tan bien encaja la oferta con el perfil. Devuelve solo el JSON.";

  let text = "";
  for await (const message of query({
    prompt,
    options: {
      systemPrompt: SYSTEM,
      model: MODEL,
      maxTurns: 1,
      disallowedTools: [
        "Bash", "Read", "Write", "Edit", "Glob", "Grep",
        "WebSearch", "WebFetch", "AskUserQuestion", "Task", "Monitor",
      ],
    },
  })) {
    if (message.type === "result") {
      const m = message as { structured_output?: unknown; result?: string };
      if (m.structured_output) return m.structured_output as Score;
      if (typeof m.result === "string") text = m.result;
    }
  }

  // Fallback robusto: extraer el primer objeto JSON del texto.
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`scorer: sin JSON en la respuesta: ${text.slice(0, 200)}`);
  return JSON.parse(match[0]) as Score;
}
