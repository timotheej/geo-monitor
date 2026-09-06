"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/** Lien qui ouvre le drawer de détail en conservant les autres paramètres (période, filtres). */
export function ResultLink({
  resultId,
  className,
  children,
  ...rest
}: { resultId: string; className?: string; children?: React.ReactNode } & Omit<React.ComponentProps<typeof Link>, "href">) {
  const pathname = usePathname();
  const params = useSearchParams();
  const next = new URLSearchParams(params.toString());
  next.set("result", resultId);
  return (
    <Link href={`${pathname}?${next.toString()}`} scroll={false} className={className} {...rest}>
      {children}
    </Link>
  );
}
