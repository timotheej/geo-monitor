/** Formatage côté UI, locale française. Pur, utilisable côté client. */

const pct = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });
const pct1 = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 });
const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eurFine = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 3, maximumFractionDigits: 4 });
const int = new Intl.NumberFormat("fr-FR");
/** Fuseau d'affichage : les serveurs (Vercel) sont en UTC, on force celui de l'équipe. */
export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Europe/Paris";
const tz = { timeZone: APP_TIMEZONE } as const;
const dateTime = new Intl.DateTimeFormat("fr-FR", { ...tz, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const dateLong = new Intl.DateTimeFormat("fr-FR", { ...tz, weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
const dayShort = new Intl.DateTimeFormat("fr-FR", { ...tz, day: "numeric", month: "short" });

/** Taux 0..1 en pourcentage. null devient un tiret court. */
export function formatRate(v: number | null | undefined, fine = false): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "-";
  return (fine ? pct1 : pct).format(v);
}

export function formatDelta(points: number | null | undefined): string | null {
  if (points === null || points === undefined || Number.isNaN(points)) return null;
  const rounded = Math.round(points * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${int.format(rounded)} pt${Math.abs(rounded) >= 2 ? "s" : ""}`;
}

export function formatEur(v: number | null | undefined, fine = false): string {
  if (v === null || v === undefined) return "-";
  return (fine ? eurFine : eur).format(v);
}

export function formatInt(v: number | null | undefined): string {
  if (v === null || v === undefined) return "-";
  return int.format(v);
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return dateTime.format(new Date(d));
}

export function formatDateLong(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return dateLong.format(new Date(d));
}

/** 'YYYY-MM-DD' vers '6 sept.' */
export function formatDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return dayShort.format(new Date(y, m - 1, d));
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms < 0) return "-";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m < 60) return rest ? `${m} min ${rest} s` : `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

export function formatLatency(ms: number | null | undefined): string {
  if (!ms) return "-";
  return ms >= 1000 ? `${(ms / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} s` : `${ms} ms`;
}

/** Durée d'un run : jusqu'à sa fin, ou jusqu'à maintenant s'il tourne encore. null s'il n'a jamais tourné. */
export function runDurationMs(run: { startedAt: Date | string; finishedAt: Date | string | null; status: string }): number | null {
  const live = run.status === "pending" || run.status === "running";
  const end = run.finishedAt ? new Date(run.finishedAt).getTime() : live ? Date.now() : null;
  return end === null ? null : end - new Date(run.startedAt).getTime();
}
