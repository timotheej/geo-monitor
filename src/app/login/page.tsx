import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-md bg-signal text-signal-foreground">
            <span className="block size-2.5 rounded-full bg-current" />
          </span>
          <span className="text-sm font-medium">GEO Monitor</span>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
