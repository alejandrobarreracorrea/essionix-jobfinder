import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Job, Score } from "./types.js";

// Sonnet: el modelo disponible en suscripción (Haiku solo va por API key).
const MODEL = "claude-sonnet-4-6";
const TIMEOUT_MS = 120_000; // tope duro por lote
const DEBUG = !!process.env.JOBFINDER_DEBUG;

const SYSTEM =
  "Eres un evaluador de ofertas de empleo. Recibes un perfil y varias ofertas. " +
  "Devuelve SOLO un array JSON (sin markdown, sin ```, sin texto antes ni después), " +
  'un objeto por oferta, con: "id" (el id exacto de la oferta), "score" (número 0-100), ' +
  '"reason" (1 frase), "highlights" (array de strings). ' +
  "Premia: contractor/freelance, remoto, español, DevOps/SRE/Cloud, y el combo SRE+DBA. " +
  "Penaliza: on-site, relocation obligatorio, roles solo-junior, y puestos no técnicos.";

// Puntúa un LOTE de ofertas en una sola llamada al Agent SDK (autenticado con la
// suscripción vía CLAUDE_CODE_OAUTH_TOKEN — sin saldo de API). Devuelve un Map id→Score
// solo para las ofertas que el modelo devolvió; las ausentes se omiten (se reintentan).
export async function scoreBatch(jobs: Job[], profile: string): Promise<Map<string, Score>> {
  if (jobs.length === 0) return new Map();
  const ids = new Set(jobs.map((j) => j.id));

  const list = jobs
    .map(
      (j) =>
        `### Oferta id=${j.id}\nTítulo: ${j.title}\nEmpresa: ${j.company}\n` +
        `Ubicación: ${j.location}\nFuente: ${j.source}\n` +
        `Descripción: ${j.description.slice(0, 1200)}`,
    )
    .join("\n\n");

  const prompt =
    `PERFIL DEL CANDIDATO:\n${profile}\n\n` +
    `Evalúa CADA una de estas ${jobs.length} ofertas contra el perfil:\n\n${list}\n\n` +
    `Devuelve SOLO el array JSON, un objeto por oferta (usa el id exacto). Sin markdown.`;

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
        const m = message as { result?: string; subtype?: string };
        if (DEBUG) console.error(`[scorer:result] subtype=${m.subtype ?? "?"}`);
        if (typeof m.result === "string") text = m.result;
      }
    }
  } finally {
    clearTimeout(timer);
  }

  // Extraer el primer array JSON del texto (tolera fences/preámbulos).
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`scorer: sin array JSON en la respuesta (text="${text.slice(0, 150)}")`);
  const parsed = JSON.parse(match[0]) as Array<{ id?: string } & Score>;

  const out = new Map<string, Score>();
  for (const r of parsed) {
    if (!r || typeof r.id !== "string" || !ids.has(r.id)) continue;
    if (typeof r.score !== "number") continue;
    out.set(r.id, {
      score: r.score,
      reason: typeof r.reason === "string" ? r.reason : "",
      highlights: Array.isArray(r.highlights) ? r.highlights : [],
    });
  }
  return out;
}
