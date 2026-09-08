"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, ErrorNote, Input, Label } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/** Překlad chyb z RPC do věty, které rozumí patnáctiletý žák. */
function humanError(message: string): string {
  if (message.includes("NEPLATNY_KOD")) {
    return "Takový kód neexistuje. Zkontroluj ho na tabuli – písmena O a číslici 0 se v kódech nepoužívají.";
  }
  if (message.includes("CHYBI_PREZDIVKA")) {
    return "Vyplň přezdívku, ať spolužák pozná, kdo v projektu pracuje.";
  }
  if (message.includes("NEPRIHLASEN")) {
    return "Přihlášení se nepovedlo. Zkus stránku načíst znovu.";
  }
  return "Připojení se nepovedlo. Zkus to prosím ještě jednou.";
}

export function JoinForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const supabase = getSupabaseBrowserClient();

      // Anonymní přihlášení dá žákovi skutečnou identitu pro RLS,
      // ale nechce po něm e-mail ani heslo.
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const { error: authError } = await supabase.auth.signInAnonymously();
        if (authError) {
          setError(
            "Anonymní přihlášení není v Supabase povolené. Učiteli: zapni ho v Authentication → Sign In / Providers.",
          );
          return;
        }
      }

      const { data, error: rpcError } = await supabase.rpc("join_project", {
        p_code: code.trim().toUpperCase(),
        p_nickname: nickname.trim(),
      });

      if (rpcError || !data) {
        setError(humanError(rpcError?.message ?? ""));
        return;
      }

      router.push(`/projekt/${data}/navrh`);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="code">Kód projektu</Label>
        <Input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={6}
          required
          className="text-center font-mono text-xl tracking-[0.3em] uppercase"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="nickname" hint="uvidí ji spolužák">
          Tvoje přezdívka
        </Label>
        <Input
          id="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Filip"
          maxLength={40}
          required
        />
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Připojuji…" : "Vstoupit do firmy"}
      </Button>
    </form>
  );
}
