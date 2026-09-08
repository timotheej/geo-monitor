import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function InspectionNotFound() {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-lg font-medium">Inspection introuvable</h1>
      <p className="mt-2 text-sm text-muted-foreground">Elle a peut-être été supprimée, ou l&apos;identifiant est incomplet.</p>
      <Button variant="outline" size="sm" className="mt-4" nativeButton={false} render={<Link href="/inspect" />}>
        Retour aux inspections
      </Button>
    </div>
  );
}
