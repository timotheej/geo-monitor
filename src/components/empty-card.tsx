import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** État vide guidé : ce qui manque, et le geste qui débloque. */
export function EmptyCard({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children?: React.ReactNode;
  action?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-3 rounded-lg border border-dashed px-5 py-8", className)}>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {children ? <p className="max-w-prose text-sm text-pretty text-muted-foreground">{children}</p> : null}
      </div>
      {action ? (
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href={action.href} />}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
