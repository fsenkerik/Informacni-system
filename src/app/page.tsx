import Link from "next/link";
import { ArrowRight, GraduationCap, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui";
import { SCENARIOS } from "@/lib/sim/scenarios";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-16">
      <Badge tone="accent" className="mb-6 self-start">
        Výuka informačních systémů
      </Badge>

      <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-ink sm:text-5xl">
        Navrhni databázi své firmy a pusť do ní zákazníky.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-2">
        Nakreslíš ER diagram, zmáčkneš <strong className="text-ink">Spustit</strong> a do
        firmy začnou chodit zákazníci. Když ti chybí vazba mezi objednávkou a zákazníkem,
        uvidíš to hned – objednávka nebude mít ke komu patřit.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link
          href="/pripojit"
          className="group rounded-card border border-border bg-surface p-6 transition hover:border-accent hover:shadow-md"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <KeyRound size={20} aria-hidden />
          </div>
          <p className="mt-4 text-lg font-semibold text-ink">Mám kód projektu</p>
          <p className="mt-1 text-sm text-ink-2">
            Zadáš kód od učitele a přezdívku. Nic víc – žádný e-mail, žádné heslo.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent">
            Připojit se
            <ArrowRight size={16} className="transition group-hover:translate-x-0.5" aria-hidden />
          </span>
        </Link>

        <Link
          href="/ucitel"
          className="group rounded-card border border-border bg-surface p-6 transition hover:border-accent hover:shadow-md"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-3 text-ink-2">
            <GraduationCap size={20} aria-hidden />
          </div>
          <p className="mt-4 text-lg font-semibold text-ink">Jsem učitel</p>
          <p className="mt-1 text-sm text-ink-2">
            Založíš třídu, rozdáš kódy skupinám a sleduješ, jak se jim daří.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent">
            Přihlásit se
            <ArrowRight size={16} className="transition group-hover:translate-x-0.5" aria-hidden />
          </span>
        </Link>
      </div>

      <section className="mt-14">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Obory, ve kterých se dá podnikat
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SCENARIOS.map((scenario) => (
            <li
              key={scenario.key}
              className="rounded-card border border-border bg-surface px-4 py-3"
            >
              <span className="text-xl" aria-hidden>
                {scenario.emoji}
              </span>
              <p className="mt-1 font-medium text-ink">{scenario.name}</p>
              <p className="text-sm text-ink-2">{scenario.tagline}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
