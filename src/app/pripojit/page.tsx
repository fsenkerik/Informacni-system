import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { JoinForm } from "./JoinForm";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SetupNotice } from "@/components/SetupNotice";

export const metadata = { title: "Připojit se k projektu – DataFirma" };

export default function JoinPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"
      >
        <ArrowLeft size={16} aria-hidden />
        Zpět
      </Link>

      <h1 className="text-2xl font-semibold text-ink">Připojit se k projektu</h1>
      <p className="mt-2 text-sm text-ink-2">
        Kód dostaneš od učitele. Když ho zadáte ve dvojici oba, budete pracovat na
        stejné firmě a uvidíte změny toho druhého.
      </p>

      <div className="mt-8">
        {isSupabaseConfigured ? <JoinForm /> : <SetupNotice />}
      </div>
    </main>
  );
}
