/**
 * Règles de détection : citation (domaine dans les sources) et mention
 * (marque ou alias dans le texte). Pur, sans dépendance, testé unitairement.
 */

export type Entity = {
  type: "brand" | "competitor";
  id: string;
  /** Termes textuels à chercher : nom + alias */
  terms: string[];
  /** Domaines de l'entité, sous-domaines inclus */
  domains: string[];
};

export type SourceLike = { url: string; title?: string };

export type DetectionResult = {
  entityType: Entity["type"];
  entityId: string;
  cited: boolean;
  citationRank: number | null;
  mentioned: boolean;
  mentionRank: number | null;
  matchedTerms: string[];
};

/** Hôte normalisé : minuscules, sans "www.", sans port. Accepte une URL ou un domaine nu. */
export function normalizeDomain(input: string): string {
  let host = input.trim().toLowerCase();
  if (!host) return "";
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//.test(host) ? host : `https://${host}`;
    host = new URL(withScheme).hostname;
  } catch {
    host = host.replace(/^[a-z]+:\/\//, "").split(/[/?#:]/)[0] ?? "";
  }
  return host.replace(/^www\./, "");
}

/** `blog.gatto.city` correspond à `gatto.city`, mais `notgatto.city` non. */
export function domainMatches(host: string, target: string): boolean {
  const h = normalizeDomain(host);
  const t = normalizeDomain(target);
  if (!h || !t) return false;
  return h === t || h.endsWith(`.${t}`);
}

/** Minuscules, sans accents, espaces réduits. */
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Position (index dans le texte normalisé) de la première occurrence d'un terme,
 * avec frontières de mot compatibles Unicode. -1 si absent.
 */
export function findTerm(normalizedText: string, term: string): number {
  const t = normalizeText(term).trim();
  if (!t) return -1;
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(t)}(?![\\p{L}\\p{N}])`, "u");
  const m = re.exec(normalizedText);
  return m ? m.index : -1;
}

export function detect(text: string, sources: SourceLike[], entities: Entity[]): DetectionResult[] {
  const normalized = normalizeText(text);
  const hosts = sources.map((s) => normalizeDomain(s.url));

  const partial = entities.map((e) => {
    let citationRank: number | null = null;
    for (let i = 0; i < hosts.length; i++) {
      if (e.domains.some((d) => domainMatches(hosts[i], d))) {
        citationRank = i + 1;
        break;
      }
    }

    let firstIndex = Number.POSITIVE_INFINITY;
    const matchedTerms: string[] = [];
    for (const term of e.terms) {
      const idx = findTerm(normalized, term);
      if (idx >= 0) {
        matchedTerms.push(term);
        if (idx < firstIndex) firstIndex = idx;
      }
    }
    // Une URL du domaine dans le texte compte aussi comme mention.
    if (matchedTerms.length === 0) {
      for (const d of e.domains) {
        const idx = normalized.indexOf(normalizeDomain(d));
        if (idx >= 0) {
          matchedTerms.push(d);
          firstIndex = Math.min(firstIndex, idx);
        }
      }
    }

    return { e, citationRank, firstIndex: Number.isFinite(firstIndex) ? firstIndex : null, matchedTerms };
  });

  // Rang de mention = ordre d'apparition parmi les entités mentionnées.
  const order = partial
    .filter((p) => p.firstIndex !== null)
    .sort((a, b) => (a.firstIndex as number) - (b.firstIndex as number));
  const rankById = new Map(order.map((p, i) => [p.e.id, i + 1]));

  return partial.map((p) => ({
    entityType: p.e.type,
    entityId: p.e.id,
    cited: p.citationRank !== null,
    citationRank: p.citationRank,
    mentioned: p.firstIndex !== null,
    mentionRank: rankById.get(p.e.id) ?? null,
    matchedTerms: p.matchedTerms,
  }));
}

/** Surlignage côté UI : segments [start, end) dans le texte brut pour chaque entité. */
export function findMentionSpans(text: string, terms: string[]): Array<{ start: number; end: number; term: string }> {
  // La normalisation NFD peut changer les index : on travaille sur le texte brut,
  // en insensible à la casse et aux accents via une classe équivalente approximative.
  const spans: Array<{ start: number; end: number; term: string }> = [];
  for (const term of terms) {
    const t = term.trim();
    if (!t) continue;
    const pattern = Array.from(t)
      .map((ch) => {
        const base = ch.normalize("NFD").replace(/\p{M}/gu, "");
        return base === " " ? "\\s+" : escapeRegExp(base) + "\\p{M}*";
      })
      .join("");
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, "giu");
    let m: RegExpExecArray | null;
    const nfd = text.normalize("NFD");
    while ((m = re.exec(nfd)) !== null) {
      // Index dans NFD, on les reprojette sur le texte original.
      const start = nfd.slice(0, m.index).normalize("NFC").length;
      const end = start + m[0].normalize("NFC").length;
      spans.push({ start, end, term });
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  return spans.sort((a, b) => a.start - b.start);
}
