import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { DEFAULT_ENGINES } from "@/lib/engines";

/** Crée le projet Gatto.city, ses concurrents, les moteurs par défaut et quelques prompts. Idempotent. */
async function main() {
  const db = await getDb();

  let project = await db.query.projects.findFirst({ where: eq(schema.projects.name, "Rablab") });
  if (!project) {
    [project] = await db
      .insert(schema.projects)
      .values({
        name: "Rablab",
        brandName: "Rablab",
        aliases: ["Rablab.ca", "Rabacadémie", "Rabacademie"],
        domains: ["rablab.ca"],
        locale: "fr-CA",
        repeats: 1,
        costCapEur: 3,
      })
      .returning();
    console.log("Projet créé :", project.id);
  }

  const existingEngines = await db.query.engines.findMany();
  const wanted = process.env.GEO_MOCK_ENGINE === "1"
    ? [...DEFAULT_ENGINES, { provider: "mock" as const, model: "mock-v1", label: "Mock (test)" }]
    : DEFAULT_ENGINES;
  for (const e of wanted) {
    if (!existingEngines.some((x) => x.provider === e.provider)) {
      await db.insert(schema.engines).values({ ...e, config: { maxSearches: 3 } });
      console.log("Moteur créé :", e.label, e.model);
    }
  }

  const competitors = await db.query.competitors.findMany({ where: eq(schema.competitors.projectId, project.id) });
  if (competitors.length === 0) {
    await db.insert(schema.competitors).values([
      { projectId: project.id, name: "Digitad", aliases: ["Digitad.ca"], domains: ["digitad.ca"] },
      { projectId: project.id, name: "Adviso", aliases: ["Adviso.ca"], domains: ["adviso.ca"] },
      { projectId: project.id, name: "My Little Big Web", aliases: ["MyLittleBigWeb", "MLBW"], domains: ["mylittlebigweb.com"] },
    ]);
    console.log("Concurrents créés");
  }

  const prompts = await db.query.prompts.findMany({ where: eq(schema.prompts.projectId, project.id) });
  if (prompts.length === 0) {
    type Seed = { text: string; lang: string; tags: string[]; webSearch: boolean };
    const web = (text: string, lang: string, ...tags: string[]): Seed => ({ text, lang, tags, webSearch: true });
    const mem = (text: string, lang: string, ...tags: string[]): Seed => ({ text, lang, tags, webSearch: false });
    const samples: Seed[] = [
      // Choix d'agence, requêtes commerciales
      web("Quelle est la meilleure agence SEO à Montréal ?", "fr", "seo", "montreal", "agence"),
      web("Quelles agences de marketing web recommandes-tu à Montréal ?", "fr", "marketing-web", "montreal", "agence"),
      web("Quelle agence Google Ads choisir au Québec ?", "fr", "google-ads", "quebec", "agence"),
      web("Quelles sont les meilleures agences SEO au Québec pour une entreprise B2B ?", "fr", "seo", "b2b", "quebec"),
      web("Quelle agence SEO recommandes-tu pour une boutique Shopify au Québec ?", "fr", "seo", "ecommerce", "shopify"),
      web("Combien coûte une agence SEO à Montréal et lesquelles sont fiables ?", "fr", "seo", "montreal", "prix"),
      web("Quelle agence de référencement local pour une PME à Laval ou Longueuil ?", "fr", "seo-local", "pme"),
      web("Quelles sont les agences Google Partner à Montréal ?", "fr", "google-ads", "montreal", "certification"),
      web("Quelle alternative à Adviso pour une stratégie SEO à Montréal ?", "fr", "seo", "montreal", "alternatives"),
      // Services spécifiques (GEO, analytics, Loi 25, migration)
      web("Quelle agence peut m'aider à apparaître dans les réponses de ChatGPT et Perplexity au Québec ?", "fr", "geo", "quebec"),
      web("Qui peut m'aider avec la conformité à la Loi 25 et Google Analytics 4 au Québec ?", "fr", "analytics", "loi-25"),
      web("Quelle agence pour un audit technique SEO et une migration de site web au Québec ?", "fr", "seo", "audit", "migration"),
      // Notoriété et contenu (formation, podcast)
      web("Où suivre une formation SEO au Québec ?", "fr", "formation", "quebec"),
      web("Quels podcasts québécois sur le marketing numérique et le SEO ?", "fr", "podcast", "quebec"),
      web("Quelles agences de marketing numérique certifiées B Corp au Canada ?", "fr", "b-corp", "canada"),
      // Anglais (Montréal bilingue, clients canadiens)
      web("Best SEO agency in Montreal?", "en", "seo", "montreal", "en"),
      web("Which digital marketing agencies in Montreal are Google Partners?", "en", "google-ads", "montreal", "en"),
      web("Best agency for generative engine optimization and AI search visibility in Canada?", "en", "geo", "canada", "en"),
      web("Top SEO agencies in Quebec for e-commerce brands?", "en", "seo", "ecommerce", "en"),
      // Notoriété "dans le modèle", sans recherche web et sans nommer la marque
      mem("Quelles agences SEO connais-tu à Montréal ?", "fr", "notoriete", "montreal"),
      mem("Quelles sont les agences de marketing numérique les plus connues au Québec ?", "fr", "notoriete", "quebec"),
      mem("Which SEO agencies in Montreal are well known?", "en", "notoriete", "montreal", "en"),
    ];
    await db.insert(schema.prompts).values(samples.map((s) => ({ projectId: project!.id, ...s })));
    console.log("Prompts créés :", samples.length);
  }

  console.log("Seed terminé.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
