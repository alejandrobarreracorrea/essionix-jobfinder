import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Job, Score } from "./types.js";

// Sonnet: el modelo disponible en suscripción (Haiku solo va por API key).
const MODEL = "claude-sonnet-4-6";
const TIMEOUT_MS = 90_000; // tope duro por oferta para que nunca se cuelgue infinito
const DEBUG = !!process.env.JOBFINDER_DEBUG;

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

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  let text = "";
  try {
    for await (const message of query({
      prompt,
      options: {
        systemPrompt: SYSTEM,
        model: MODEL,
        maxTurns: 1,
        permissionMode: "bypassPermissions",
        settingSources: [], // hermético: no cargar CLAUDE.md ni settings del repo
        disallowedTools: [
          "Bash", "Read", "Write", "Edit", "Glob", "Grep",
          "WebSearch", "WebFetch", "AskUserQuestion", "Task", "Monitor",
        ],
        abortController: ac,
        stderr: DEBUG ? (d: string) => console.error(`[scorer:stderr] ${d.trim()}`) : undefined,
      },
    })) {
      if (DEBUG) console.error(`[scorer:msg] ${message.type}`);
      if (message.type === "result") {
        const m = message as { structured_output?: unknown; result?: string; subtype?: string };
        if (DEBUG) console.error(`[scorer:result] subtype=${m.subtype ?? "?"} text=${String(m.result ?? "").slice(0, 200)}`);
        if (m.structured_output) return m.structured_output as Score;
        if (typeof m.result === "string") text = m.result;
      }
    }
  } finally {
    clearTimeout(timer);
  }

  // Fallback robusto: extraer el primer objeto JSON del texto.
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`scorer: sin JSON en la respuesta (text="${text.slice(0, 150)}")`);
  return JSON.parse(match[0]) as Score;
}
