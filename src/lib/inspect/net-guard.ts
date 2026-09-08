import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** Garde anti-SSRF : refuse les adresses privées, de bouclage, lien-local et de métadonnées cloud. */
export function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6 === "::1" || v6 === "::") return true;
  if (v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80")) return true;
  if (v6.startsWith("::ffff:")) return isPrivateIp(v6.slice(7));
  return false;
}

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

/** Vérifie qu'une URL pointe vers un hôte public. Lève UnsafeUrlError sinon. */
export async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UnsafeUrlError("Seuls http et https sont acceptés");
  if (url.username || url.password) throw new UnsafeUrlError("Identifiants dans l'URL refusés");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new UnsafeUrlError("Hôte local refusé");
  }
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new UnsafeUrlError("Adresse IP privée refusée");
    return;
  }
  const addrs = await lookup(host, { all: true }).catch(() => []);
  if (addrs.length === 0) throw new UnsafeUrlError(`Nom introuvable : ${host}`);
  if (addrs.some((a) => isPrivateIp(a.address))) throw new UnsafeUrlError("L'hôte résout vers une adresse privée");
}
