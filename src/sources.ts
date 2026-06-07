import { readFileSync, writeFileSync } from "node:fs";
import type { Fetcher } from "./types.js";

export interface SourcesState {
  activeCount: number; // cuántos portales del catálogo (en orden) están activos
  lastExpandedISO: string; // última vez que se amplió ("" = sin inicializar)
}

const INITIAL = 5; // portales activos al arrancar (el núcleo probado)
const STEP = 2; // portales nuevos por expansión
const INTERVAL_DAYS = 2; // cada cuántos días ampliar

export function loadSourcesState(path = "state/sources.json"): SourcesState {
  try {
    const s = JSON.parse(readFileSync(path, "utf8")) as Partial<SourcesState>;
    if (typeof s.activeCount === "number") {
      return {
        activeCount: s.activeCount,
        lastExpandedISO: typeof s.lastExpandedISO === "string" ? s.lastExpandedISO : "",
      };
    }
  } catch {
    /* archivo ausente o inválido → estado inicial */
  }
  return { activeCount: INITIAL, lastExpandedISO: "" };
}

export function saveSourcesState(state: SourcesState, path = "state/sources.json"): void {
  writeFileSync(path, JSON.stringify(state, null, 2) + "\n");
}

// Amplía la cobertura: si pasaron >= INTERVAL_DAYS desde la última expansión,
// activa STEP portales más (tope = total). La primera vez (reloj sin inicializar)
// solo fija el reloj a `nowISO` sin ampliar, para que la primera ampliación sea
// realmente a los 2 días.
export function expandIfDue(state: SourcesState, total: number, nowISO: string): SourcesState {
  const capped = Math.min(state.activeCount, total);
  const last = Date.parse(state.lastExpandedISO);
  if (Number.isNaN(last)) {
    return { activeCount: capped, lastExpandedISO: nowISO }; // inicializa el reloj
  }
  if (capped >= total) {
    return { activeCount: total, lastExpandedISO: state.lastExpandedISO };
  }
  const elapsedDays = (new Date(nowISO).getTime() - last) / 86_400_000;
  if (elapsedDays >= INTERVAL_DAYS) {
    return { activeCount: Math.min(capped + STEP, total), lastExpandedISO: nowISO };
  }
  return { activeCount: capped, lastExpandedISO: state.lastExpandedISO };
}

export function activeFetchers(all: Fetcher[], state: SourcesState): Fetcher[] {
  return all.slice(0, Math.max(0, Math.min(state.activeCount, all.length)));
}
