import { NextResponse } from "next/server";
import { getInspection } from "@/lib/inspect/queries";

export async function GET(_: Request, ctx: RouteContext<"/api/inspections/[id]">) {
  const { id } = await ctx.params;
  const data = await getInspection(id);
  if (!data) return NextResponse.json({ error: "Inspection introuvable" }, { status: 404 });
  const { inspection } = data;
  return NextResponse.json({
    inspection: {
      id: inspection.id,
      url: inspection.url,
      status: inspection.status,
      page: inspection.page,
      access: inspection.access,
      questions: inspection.questions,
      questionsReused: inspection.questionsReused,
      engineIds: inspection.engineIds,
      plannedCount: inspection.plannedCount,
      doneCount: inspection.doneCount,
      costEstimate: inspection.costEstimate,
      error: inspection.error,
    },
    answers: inspection.answers.map((a) => ({
      questionIndex: a.questionIndex,
      question: inspection.questions[a.questionIndex]?.text,
      engine: a.engine.label,
      urlCited: a.urlCited,
      urlRank: a.urlRank,
      domainCited: a.domainCited,
      urlRetrieved: a.urlRetrieved,
      domainRetrieved: a.domainRetrieved,
      searchQueries: a.searchQueries,
      sources: a.sources.map((s) => ({ domain: s.domain, url: s.url, cited: s.cited })),
      costEstimate: a.costEstimate,
      error: a.error,
    })),
  });
}
