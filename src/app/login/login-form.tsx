"use client";

import { useActionState } from "react";
import { login } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connexion</CardTitle>
        <CardDescription>Outil interne, un seul mot de passe pour toute l&apos;équipe.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action}>
          <FieldGroup>
            <Field data-invalid={state?.error ? true : undefined}>
              <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                autoFocus
                required
                aria-invalid={state?.error ? true : undefined}
              />
              {state?.error ? <FieldError>{state.error}</FieldError> : null}
            </Field>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Connexion en cours" : "Se connecter"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
