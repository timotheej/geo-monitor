import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { DEFAULT_PRICING } from "@/lib/pricing";
import type { EngineConfig, Provider } from "@/db/schema";

export async function GET() {
  const db = await getDb();
  return NextResponse.json({ engines: await db.query.engines.findMany({ orderBy: (e, { asc }) => asc(e.createdAt) }) });
}

/** Crée un moteur s'il n'en existe pas déjà un pour ce fournisseur : `{ provider, model, label, config?, enabled? }`. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    provider?: Provider;
    model?: string;
    label?: string;
    config?: EngineConfig;
    enabled?: boolean;
  };
  if (!body.provider || !body.model || !body.label) {
    return NextResponse.json({ error: "provider, model et label requis" }, { status: 400 });
  }
  if (!(body.provider in DEFAULT_PRICING)) {
    return NextResponse.json({ error: `Fournisseur inconnu : ${body.provider}` }, { status: 400 });
  }
  const db = await getDb();
  const existing = await db.query.engines.findFirst({ where: (e, { eq }) => eq(e.provider, body.provider!) });
  if (existing) return NextResponse.json({ engine: existing, created: false });
  const [engine] = await db
    .insert(schema.engines)
    .values({
      provider: body.provider,
      model: body.model,
      label: body.label,
      enabled: body.enabled ?? true,
      config: body.config ?? { maxSearches: 2 },
    })
    .returning();
  return NextResponse.json({ engine, created: true }, { status: 201 });
}

/** Modifie un moteur existant : `{ provider | id, enabled?, model?, config? }`. */
export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { id?: string; provider?: Provider; enabled?: boolean; model?: string; config?: EngineConfig };
  const db = await getDb();
  const engine = body.id
    ? await db.query.engines.findFirst({ where: (e, { eq }) => eq(e.id, body.id!) })
    : body.provider
      ? await db.query.engines.findFirst({ where: (e, { eq }) => eq(e.provider, body.provider!) })
      : undefined;
  if (!engine) return NextResponse.json({ error: "Moteur introuvable" }, { status: 404 });
  const [updated] = await db
    .update(schema.engines)
    .set({
      enabled: body.enabled ?? engine.enabled,
      model: body.model?.trim() || engine.model,
      config: body.config ? { ...engine.config, ...body.config } : engine.config,
    })
    .where(eq(schema.engines.id, engine.id))
    .returning();
  return NextResponse.json({ engine: updated });
}
