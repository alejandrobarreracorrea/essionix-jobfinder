import type { Fetcher } from "../types.js";
import { remoteok } from "./remoteok.js";
import { remotive } from "./remotive.js";
import { weworkremotely } from "./weworkremotely.js";
import { himalayas } from "./himalayas.js";
import { getonbrd } from "./getonbrd.js";
import { jooble } from "./jooble.js";
import { jobicy } from "./jobicy.js";
import { workingnomads } from "./workingnomads.js";
import { arbeitnow } from "./arbeitnow.js";
import { themuse } from "./themuse.js";
import { torre } from "./torre.js";
import { linkedin } from "./linkedin.js";

// ORDEN = prioridad de activación progresiva (ver src/sources.ts).
// Los 5 primeros (probados) arrancan activos; los demás se encienden de a 2 cada 2 días.
export const FETCHERS: Fetcher[] = [
  remoteok, remotive, weworkremotely, himalayas, getonbrd, // 1-5 núcleo probado
  jooble, // 6 agregador hispano (MX/AR/CL/PE/EC/CO/ES) — activo desde ya
  jobicy, workingnomads, arbeitnow, themuse, // 7-10 nuevos
  torre, linkedin, // 11-12 best-effort (suelen dar 0)
];
