import { describe, expect, it } from "vitest";
import { extractPage } from "./extract";

const html = `<!doctype html><html lang="fr-CA"><head>
<title>Loi 25 : ce que votre site doit faire | Rablab</title>
<meta name="description" content="Guide pratique de conformité à la Loi 25 pour les sites web au Québec.">
<meta property="article:published_time" content="2026-05-02T10:00:00Z">
<link rel="canonical" href="https://rablab.ca/blog/loi-25">
<meta name="robots" content="index, follow, max-image-preview:large">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BlogPosting","datePublished":"2026-05-02"}</script>
<script>window.app = 1;</script>
</head><body>
<header><nav><a href="/">Accueil</a></nav></header>
<main><article>
<h1>Loi 25 : ce que votre site doit faire</h1>
<p>La Loi 25 impose aux entreprises québécoises de nouvelles obligations en matière de protection des renseignements personnels, et votre site web est concerné en premier lieu.</p>
<h2>Bannière de consentement</h2>
<p>Le consentement aux témoins non essentiels doit être obtenu avant tout dépôt, ce qui implique une bannière conforme et un registre.</p>
<h2>Google Analytics 4</h2>
<ul><li>Activez le mode consentement pour que les mesures respectent le choix des visiteurs de votre site.</li></ul>
</article></main>
<footer>Rablab inc.</footer>
</body></html>`;

describe("extractPage", () => {
  it("extracts metadata and content", () => {
    const p = extractPage(html);
    expect(p.title).toContain("Loi 25");
    expect(p.h1).toBe("Loi 25 : ce que votre site doit faire");
    expect(p.description).toContain("Guide pratique");
    expect(p.h2).toEqual(["Bannière de consentement", "Google Analytics 4"]);
    expect(p.lang).toBe("fr");
    expect(p.publishedAt).toBe("2026-05-02T10:00:00Z");
    expect(p.canonical).toBe("https://rablab.ca/blog/loi-25");
    expect(p.robotsMeta).toContain("index");
    expect(p.jsonLdTypes).toEqual(["BlogPosting"]);
    expect(p.wordCount).toBeGreaterThan(40);
    expect(p.excerpt).not.toContain("Accueil");
    expect(p.excerpt).not.toContain("Rablab inc.");
    expect(p.jsSuspect).toBe(false);
  });
  it("flags JavaScript-only pages", () => {
    const p = extractPage('<html><head><title>App</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
    expect(p.jsSuspect).toBe(true);
    expect(p.wordCount).toBe(0);
  });
});
