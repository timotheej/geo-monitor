import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function RunNotFound() {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-lg font-medium">Run introuvable</h1>
      <p className="mt-2 text-sm text-muted-foreground">Il a peut-être été supprimé, ou l&apos;identifiant est incomplet.</p>
      <Button variant="outline" size="sm" className="mt-4" nativeButton={false} render={<Link href="/runs" />}>
        Retour aux runs
      </Button>
    </div>
  );
}
