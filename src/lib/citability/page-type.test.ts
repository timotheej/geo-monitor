import { describe, expect, it } from "vitest";
import { extractSignals } from "./signals";
import { detectPageType } from "./page-type";
import {
  ARTICLE_HTML, ARTICLE_URL, DIRECTORY_HTML, DIRECTORY_URL, DOC_HTML, DOC_URL, JS_EMPTY_HTML, JS_EMPTY_URL, LISTICLE_HTML, LISTICLE_URL, SERVICE_HTML, SERVICE_URL,
} from "./fixtures";

describe("detectPageType", () => {
  it("listicle : top N, meilleures, ItemList, entités en H2", () => {
    const r = detectPageType(extractSignals(LISTICLE_HTML, { url: LISTICLE_URL }));
    expect(r.type).toBe("listicle");
    expect(r.confidence).toBeGreaterThan(0.7);
    expect(r.reasons).toEqual(expect.arrayContaining(["« top N » dans le titre", "schéma ItemList"]));
  });

  it("service : nos services, formulaire, prix à partir de, soumission", () => {
    const r = detectPageType(extractSignals(SERVICE_HTML, { url: SERVICE_URL }));
    expect(r.type).toBe("service");
    expect(r.reasons).toContain("appel à une soumission ou un devis");
    expect(r.reasons).toContain("formulaire de contact");
  });

  it("documentation : developers.google.com", () => {
    const r = detectPageType(extractSignals(DOC_HTML, { url: DOC_URL }));
    expect(r.type).toBe("documentation");
    expect(r.confidence).toBeGreaterThan(0.8);
  });

  it("directory : clutch.co", () => {
    const r = detectPageType(extractSignals(DIRECTORY_HTML, { url: DIRECTORY_URL }));
    expect(r.type).toBe("directory");
  });

  it("guide : étapes, question dans le titre, BlogPosting", () => {
    const r = detectPageType(extractSignals(ARTICLE_HTML, { url: ARTICLE_URL }));
    expect(r.type).toBe("guide");
    expect(r.reasons).toContain("étapes numérotées");
  });

  it("other : page vide", () => {
    const r = detectPageType(extractSignals(JS_EMPTY_HTML, { url: JS_EMPTY_URL }));
    expect(r.type).toBe("other");
    expect(r.confidence).toBeLessThan(0.5);
  });

  it("news : NewsArticle ou domaine de presse", () => {
    const html = `<html lang="fr"><head><title>Les agences SEO face à l'IA | Le Devoir</title><script type="application/ld+json">{"@type":"NewsArticle","headline":"x"}</script></head><body><main><p>${"Article de presse sur les agences. ".repeat(40)}</p></main></body></html>`;
    expect(detectPageType(extractSignals(html, { url: "https://www.ledevoir.com/economie/123/agences-seo-ia" })).type).toBe("news");
    const html2 = `<html><head><title>Un titre</title><script type="application/ld+json">{"@type":"NewsArticle","headline":"x"}</script></head><body><main><p>Texte.</p></main></body></html>`;
    expect(detectPageType(extractSignals(html2, { url: "https://blog.inconnu.ca/article" })).type).toBe("news");
  });

  it("institutional : gouv.qc.ca, gc.ca, ordre professionnel", () => {
    const html = `<html lang="fr"><head><title>Loi 25 : obligations des entreprises</title></head><body><main><p>Texte officiel.</p></main></body></html>`;
    expect(detectPageType(extractSignals(html, { url: "https://www.cai.gouv.qc.ca/loi-25" })).type).toBe("institutional");
    expect(detectPageType(extractSignals(html, { url: "https://www.canada.ca/fr/services.html" })).type).toBe("institutional");
    expect(detectPageType(extractSignals(html, { url: "https://ised-isde.canada.gc.ca/site" })).type).toBe("institutional");
    const ordre = `<html lang="fr"><head><title>Ordre des CPA du Québec : trouver un comptable</title></head><body><main><p>Texte.</p></main></body></html>`;
    expect(detectPageType(extractSignals(ordre, { url: "https://cpaquebec.ca/trouver" })).type).toBe("institutional");
  });

  it("guide : comment et HowTo", () => {
    const html = `<html lang="fr"><head><title>Comment choisir une agence SEO en 5 étapes</title><script type="application/ld+json">{"@type":"HowTo","name":"x"}</script></head><body><main><h1>Comment choisir une agence SEO</h1><p>Texte.</p></main></body></html>`;
    const r = detectPageType(extractSignals(html, { url: "https://example.com/guide" }));
    expect(r.type).toBe("guide");
    expect(r.reasons).toContain("schéma HowTo");
  });

  it("listicle bat service quand un article d'agence a un encart de soumission", () => {
    const html = LISTICLE_HTML.replace("</article>", `<aside><p>Nos services : demander une soumission gratuite.</p></aside></article>`);
    expect(detectPageType(extractSignals(html, { url: LISTICLE_URL })).type).toBe("listicle");
  });
});
