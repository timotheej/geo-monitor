import { assertPublicUrl, UnsafeUrlError } from "./net-guard";

export const USER_AGENT = "GEO-Monitor/1.0 (+https://github.com/timotheej/geo-monitor)";
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

export type FetchedPage = {
  finalUrl: string;
  status: number;
  responseMs: number;
  contentType: string;
  body: string;
  redirects: number;
};

export class FetchPageError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "FetchPageError";
  }
}

async function readLimited(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
}

/**
 * Récupération sûre d'une page : hôte public vérifié à chaque saut, 5 redirections max,
 * 10 s, 2 Mo, sans cookies ni identifiants. `allowNonHtml` sert pour robots.txt et llms.txt.
 */
export async function safeFetch(input: string, opts: { allowNonHtml?: boolean } = {}): Promise<FetchedPage> {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new FetchPageError("URL invalide");
  }
  const started = Date.now();
  let redirects = 0;
  for (;;) {
    await assertPublicUrl(url);
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.5", "accept-language": "fr-CA,fr;q=0.9,en;q=0.7" },
        credentials: "omit",
      });
    } catch (err) {
      if (err instanceof UnsafeUrlError) throw err;
      const name = (err as Error).name;
      throw new FetchPageError(name === "TimeoutError" ? "Délai dépassé (10 s)" : `Connexion impossible : ${(err as Error).message}`);
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      if (++redirects > MAX_REDIRECTS) throw new FetchPageError("Trop de redirections");
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!opts.allowNonHtml && res.ok && !/text\/html|application\/xhtml/.test(contentType)) {
      throw new FetchPageError(`Ce n'est pas une page HTML (${contentType || "type inconnu"})`, res.status);
    }
    const body = await readLimited(res);
    return { finalUrl: url.toString(), status: res.status, responseMs: Date.now() - started, contentType, body, redirects };
  }
}

/** robots.txt : null si absent (404), texte sinon. Les erreurs réseau valent "absent". */
export async function fetchRobots(origin: string): Promise<string | null> {
  try {
    const r = await safeFetch(`${origin}/robots.txt`, { allowNonHtml: true });
    return r.status === 200 ? r.body : null;
  } catch {
    return null;
  }
}

export async function hasLlmsTxt(origin: string): Promise<boolean> {
  try {
    const r = await safeFetch(`${origin}/llms.txt`, { allowNonHtml: true });
    return r.status === 200 && r.body.trim().length > 0 && !/<html/i.test(r.body.slice(0, 500));
  } catch {
    return false;
  }
}
