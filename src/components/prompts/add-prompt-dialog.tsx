"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createPrompt } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export function AddPromptDialog({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [webSearch, setWebSearch] = useState(true);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const text = String(fd.get("text") ?? "").trim();
    const lang = String(fd.get("lang") ?? "fr").trim() || "fr";
    const tags = String(fd.get("tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    startTransition(async () => {
      try {
        await createPrompt({ projectId, text, lang, tags, webSearch });
        toast.success("Prompt ajouté", { description: "Il sera interrogé au prochain run." });
        setOpen(false);
        setWebSearch(true);
        router.refresh();
      } catch (err) {
        toast.error("Prompt non ajouté", { description: err instanceof Error ? err.message : String(err) });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus data-icon="inline-start" />
        Ajouter un prompt
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>Ajouter un prompt</DialogTitle>
            <DialogDescription>Une question telle qu&apos;un utilisateur la poserait à un assistant IA, sans mentionner la marque.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="prompt-text">Texte</FieldLabel>
              <Textarea id="prompt-text" name="text" required minLength={5} autoFocus placeholder="Quels sont les meilleurs sites pour louer un appartement à Lyon ?" className="min-h-24" />
            </Field>
            <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3">
              <Field>
                <FieldLabel htmlFor="prompt-lang">Langue</FieldLabel>
                <Input id="prompt-lang" name="lang" defaultValue="fr" maxLength={5} className="font-mono" />
              </Field>
              <Field>
                <FieldLabel htmlFor="prompt-tags">Tags</FieldLabel>
                <Input id="prompt-tags" name="tags" placeholder="location, lyon" />
                <FieldDescription>Séparés par des virgules.</FieldDescription>
              </Field>
            </div>
            <Field orientation="horizontal">
              <Switch id="prompt-web" checked={webSearch} onCheckedChange={setWebSearch} />
              <FieldLabel htmlFor="prompt-web" className="flex-col items-start gap-0.5">
                <span>Avec recherche web</span>
                <FieldDescription>
                  {webSearch ? "Mesure la citation : le moteur cherche sur le web et renvoie ses sources." : "Mesure la notoriété : le moteur répond de mémoire, seule la mention compte."}
                </FieldDescription>
              </FieldLabel>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Ajout en cours" : "Ajouter le prompt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
