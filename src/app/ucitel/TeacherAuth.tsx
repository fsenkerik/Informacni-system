"use client";

import { useState, type FormEvent } from "react";
import { Button, Card, ErrorNote, Input, Label } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Učitel se hlásí e-mailem a heslem.
 *
 * Magic link by potřeboval funkční SMTP a na bezplatném tarifu Supabase je
 * odesílání e-mailů přísně omezené – učitel by se v hodině nemusel dostat dovnitř.
 */
export function TeacherAuth({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const supabase = getSupabaseBrowserClient();

      // Žák může být v prohlížeči přihlášený anonymně – učitelský účet ho nahradí.
      const { data: existing } = await supabase.auth.getUser();
      if (existing.user?.is_anonymous) {
        await supabase.auth.signOut();
      }

      const result =
        mode === "signup"
          ? await supabase.auth.signUp({ email, password })
          : await supabase.auth.signInWithPassword({ email, password });

      if (result.error) {
        setError(translate(result.error.message));
        return;
      }

      const userId = result.data.user?.id;
      if (!userId) {
        setError(
          "Účet vznikl, ale čeká na potvrzení e-mailem. V Supabase vypni Authentication → Email → Confirm email.",
        );
        return;
      }

      await supabase.from("teachers").upsert({ id: userId, email });
      onSignedIn();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <h1 className="text-xl font-semibold text-ink">
        {mode === "signin" ? "Přihlášení učitele" : "Nový účet učitele"}
      </h1>
      <p className="mt-1 text-sm text-ink-2">
        Žáci žádný účet nepotřebují – stačí jim kód projektu.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" hint="aspoň 8 znaků">
            Heslo
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={8}
            required
          />
        </div>

        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending
            ? "Chvilku…"
            : mode === "signin"
              ? "Přihlásit se"
              : "Založit účet"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
        }}
        className="mt-4 w-full text-sm text-accent hover:underline"
      >
        {mode === "signin"
          ? "Ještě nemám účet – založit"
          : "Účet už mám – přihlásit se"}
      </button>
    </Card>
  );
}

function translate(message: string): string {
  if (message.includes("Invalid login credentials")) {
    return "Špatný e-mail nebo heslo.";
  }
  if (message.includes("already registered")) {
    return "Tenhle e-mail už je zaregistrovaný. Přihlas se.";
  }
  if (message.includes("Password should be")) {
    return "Heslo musí mít aspoň 8 znaků.";
  }
  if (message.toLowerCase().includes("email") && message.toLowerCase().includes("confirm")) {
    return "Účet čeká na potvrzení e-mailem. V Supabase vypni Authentication → Email → Confirm email.";
  }
  return `Přihlášení se nepovedlo: ${message}`;
}
