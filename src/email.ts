import { Resend } from "resend";
import type { ScoredJob } from "./types.js";

export function renderDigest(jobs: ScoredJob[]): string {
  const sorted = [...jobs].sort((a, b) => b.score.score - a.score.score);
  const rows = sorted
    .map(
      (j) => `
    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:12px">
      <div style="font-size:12px;color:#64748b">${j.source} · score ${j.score.score}/100</div>
      <div style="font-size:18px;font-weight:600;margin:4px 0">${escapeHtml(j.title)}</div>
      <div style="color:#334155">${escapeHtml(j.company)} — ${escapeHtml(j.location)}</div>
      <div style="margin:8px 0;color:#475569">${escapeHtml(j.score.reason)}</div>
      <div style="font-size:12px;color:#0f766e">${j.score.highlights.map(escapeHtml).join(" · ")}</div>
      <a href="${escapeHtml(j.url)}" style="display:inline-block;margin-top:8px;background:#0f172a;color:#fff;
         padding:8px 14px;border-radius:6px;text-decoration:none">Postular</a>
    </div>`,
    )
    .join("");
  return `<div style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto">
    <h2>JobFinder — ${sorted.length} ofertas nuevas</h2>${rows}</div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

export async function sendDigest(
  jobs: ScoredJob[],
  opts: { apiKey: string; to: string; from?: string },
): Promise<void> {
  const resend = new Resend(opts.apiKey);
  const { error } = await resend.emails.send({
    from: opts.from ?? "JobFinder <onboarding@resend.dev>",
    to: opts.to,
    subject: `JobFinder — ${jobs.length} ofertas nuevas`,
    html: renderDigest(jobs),
  });
  if (error) throw new Error(`Resend: ${JSON.stringify(error)}`);
}
