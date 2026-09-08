/** Normalisation d'URL pour comparer une page suivie avec les sources renvoyées par les moteurs. */

const TRACKING_PARAMS = /^(utm_|ref$|fbclid$|gclid$|msclkid$|mc_cid$|mc_eid$|igshid$|si$|msockid$)/i;

export function normalizeUrl(input: string): string | null {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const params = Array.from(u.searchParams.entries())
    .filter(([k]) => !TRACKING_PARAMS.test(k))
    .sort(([a], [b]) => a.localeCompare(b));
  const qs = params.length ? "?" + params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&") : "";
  let path = u.pathname.replace(/\/+$/, "");
  if (path === "") path = "";
  return `${host}${path}${qs}`;
}

export function urlMatches(a: string, b: string): boolean {
  const na = normalizeUrl(a);
  const nb = normalizeUrl(b);
  return na !== null && nb !== null && na === nb;
}

/** Vrai si `source` est une page du même site que `target` (sous-domaines inclus). */
export function sameSite(source: string, targetDomain: string): boolean {
  const n = normalizeUrl(source);
  if (!n) return false;
  const host = n.split("/")[0].split("?")[0];
  const t = targetDomain.toLowerCase().replace(/^www\./, "");
  return host === t || host.endsWith(`.${t}`);
}

/** Origine (scheme + hôte) d'une URL, pour robots.txt et llms.txt. */
export function originOf(input: string): string | null {
  try {
    return new URL(input).origin;
  } catch {
    return null;
  }
}
