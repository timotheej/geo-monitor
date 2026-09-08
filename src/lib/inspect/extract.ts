import * as cheerio from "cheerio";

export type PageInfo = {
  title: string;
  h1: string;
  description: string;
  h2: string[];
  lang: string;
  wordCount: number;
  publishedAt: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  jsonLdTypes: string[];
  /** Extrait de texte pour la génération de questions (1 500 caractères max) */
  excerpt: string;
  /** Peu de texte dans le HTML brut mais des scripts : la page dépend sans doute de JavaScript */
  jsSuspect: boolean;
};

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** Extraction pure du HTML brut, sans exécution de JavaScript. */
export function extractPage(html: string): PageInfo {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe").remove();

  const jsonLdTypes: string[] = [];
  let ldDate: string | null = null;
  // Les scripts JSON-LD ont été retirés du DOM, on les relit dans la source.
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]);
      const nodes = Array.isArray(data) ? data : data["@graph"] ? data["@graph"] : [data];
      for (const n of nodes) {
        const t = n?.["@type"];
        if (t) jsonLdTypes.push(...(Array.isArray(t) ? t : [t]).map(String));
        if (!ldDate && typeof n?.datePublished === "string") ldDate = n.datePublished;
      }
    } catch {
      /* JSON invalide, ignoré */
    }
  }

  const meta = (name: string) => clean($(`meta[name="${name}"], meta[property="${name}"]`).first().attr("content") ?? "");
  const main = $("main, article, [role=main]").first();
  const scope = main.length ? main : $("body");
  scope.find("nav, header, footer, aside, form").remove();
  const text = clean(scope.text());
  const paragraphs = scope
    .find("p, li")
    .map((_, el) => clean($(el).text()))
    .get()
    .filter((p) => p.length > 40);
  const excerpt = (paragraphs.join(" ") || text).slice(0, 1500);
  const wordCount = text ? text.split(" ").length : 0;
  const publishedAt = meta("article:published_time") || ldDate || $("time[datetime]").first().attr("datetime") || null;

  return {
    title: clean($("title").first().text()) || meta("og:title"),
    h1: clean($("h1").first().text()),
    description: meta("description") || meta("og:description"),
    h2: $("h2")
      .map((_, el) => clean($(el).text()))
      .get()
      .filter(Boolean)
      .slice(0, 12),
    lang: ($("html").attr("lang") ?? "").toLowerCase().slice(0, 2) || (meta("og:locale").toLowerCase().slice(0, 2) || ""),
    wordCount,
    publishedAt,
    canonical: $('link[rel="canonical"]').attr("href") ?? null,
    robotsMeta: meta("robots") || null,
    jsonLdTypes: Array.from(new Set(jsonLdTypes)),
    excerpt,
    jsSuspect: wordCount < 50 && /<script/i.test(html),
  };
}
