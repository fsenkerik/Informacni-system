"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { useSnapshot } from "@/lib/er/store";
import { generateSql } from "@/lib/er/sql";

export default function SqlPage() {
  const snapshot = useSnapshot();
  const [copied, setCopied] = useState(false);
  const sql = generateSql(snapshot);

  async function copy() {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">Tvůj návrh jako SQL</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-2">
            Tohle jsou příkazy, kterými by se tvoje databáze doopravdy vytvořila.
            Všimni si, kam se doplnily cizí klíče – vždycky na stranu N.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={copy}>
          {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
          {copied ? "Zkopírováno" : "Kopírovat"}
        </Button>
      </div>

      <Card className="mt-6 overflow-x-auto bg-canvas p-0">
        <pre className="p-5 font-mono text-[13px] leading-relaxed text-canvas-ink">
          {sql}
        </pre>
      </Card>
    </main>
  );
}
