const DEBUG = !!process.env.JOBFINDER_DEBUG;

// Marcadores de vacante cerrada (Jooble y agregadores muestran esto en el HTML).
const DEAD =
  /no longer available|this (job|position|vacancy) is no longer|position is no longer|job (has )?expired|expired|ya no (est[aá]) disponible|(oferta|vacante|posici[oó]n)[^.]{0,30}(no (est[aá]|se encuentra) disponible|ya no)|esta (oferta|vacante) ya no/i;

// ¿La vacante está muerta? Solo devuelve true ante señal CLARA (404/410 o marcador en
// el cuerpo). Ante bloqueo/timeout/error → false (la mantiene; nunca descarta por duda).
export async function isDead(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 essionix-jobfinder" },
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    if (res.status === 404 || res.status === 410) {
      if (DEBUG) console.error(`[liveness] DEAD ${res.status} ${url.slice(0, 80)}`);
      return true;
    }
    if (!res.ok) {
      if (DEBUG) console.error(`[liveness] keep (HTTP ${res.status}) ${url.slice(0, 80)}`);
      return false;
    }
    const body = await res.text();
    const dead = DEAD.test(body);
    if (DEBUG) console.error(`[liveness] ${dead ? "DEAD(marker)" : "alive"} ${url.slice(0, 80)}`);
    return dead;
  } catch (e) {
    if (DEBUG) console.error(`[liveness] keep (error ${(e as Error).message}) ${url.slice(0, 60)}`);
    return false;
  }
}

// Filtra una lista dejando solo las que NO están muertas (verifica en paralelo).
export async function filterLive<T extends { url: string }>(jobs: T[]): Promise<T[]> {
  const verdicts = await Promise.all(jobs.map((j) => isDead(j.url)));
  return jobs.filter((_, i) => !verdicts[i]);
}
