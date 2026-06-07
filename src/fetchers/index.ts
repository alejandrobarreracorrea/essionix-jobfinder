import type { Fetcher } from "../types.js";
import { remoteok } from "./remoteok.js";
import { remotive } from "./remotive.js";
import { weworkremotely } from "./weworkremotely.js";
import { himalayas } from "./himalayas.js";
import { getonbrd } from "./getonbrd.js";
import { jobicy } from "./jobicy.js";
import { workingnomads } from "./workingnomads.js";
import { arbeitnow } from "./arbeitnow.js";
import { themuse } from "./themuse.js";
import { torre } from "./torre.js";
import { linkedin } from "./linkedin.js";

// ORDEN = prioridad de activación progresiva (ver src/sources.ts).
// Los 5 primeros (probados) arrancan activos; los demás se encienden de a 2 cada 2 días.
export const FETCHERS: Fetcher[] = [
  remoteok, remotive, weworkremotely, himalayas, getonbrd, // núcleo probado
  jobicy, workingnomads, arbeitnow, themuse, // nuevos
  torre, linkedin, // best-effort (suelen dar 0)
];
