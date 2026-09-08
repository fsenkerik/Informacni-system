import { AlertTriangle } from "lucide-react";

/**
 * Když někdo naklonuje repozitář a spustí ho bez Supabase, musí hned vidět,
 * co udělat – ne bílou stránku s chybou v konzoli.
 */
export function SetupNotice() {
  return (
    <div className="rounded-card border border-warn/30 bg-warn-soft p-5">
      <div className="flex items-center gap-2 text-warn">
        <AlertTriangle size={18} aria-hidden />
        <p className="font-semibold">Aplikace ještě není propojená s databází</p>
      </div>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-ink-2">
        <li>
          Založ si zdarma projekt na <span className="font-medium text-ink">supabase.com</span>.
        </li>
        <li>
          V SQL editoru spusť soubory <code className="font-mono">supabase/migrations/0001_init.sql</code>{" "}
          a <code className="font-mono">0002_rls.sql</code>.
        </li>
        <li>
          V Authentication → Sign In / Providers zapni <strong>Anonymous sign-ins</strong>.
        </li>
        <li>
          Zkopíruj <code className="font-mono">.env.local.example</code> na{" "}
          <code className="font-mono">.env.local</code> a doplň URL a anon klíč.
        </li>
      </ol>
    </div>
  );
}
