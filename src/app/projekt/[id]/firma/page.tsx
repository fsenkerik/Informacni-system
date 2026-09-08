"use client";

import { useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input, Label, Select } from "@/components/ui";
import { useSchemaStore, useSnapshot } from "@/lib/er/store";
import { useFirmStore } from "@/lib/firma/store";
import { entityForRole } from "@/lib/sim/requirements";
import { getRole, getScenario } from "@/lib/sim/scenarios";
import { attributesOf, type AttributeRecord } from "@/lib/types";
import type { CatalogItem } from "@/lib/sim/types";
import { formatCurrency } from "@/lib/utils";

/**
 * Karta Firma.
 *
 * Sortiment se vypisuje do tabulky, kterou si žák sám navrhl – políčka
 * odpovídají jeho sloupcům. Kdo nemá sloupec na cenu, nemá kam ji napsat,
 * a hned vidí proč na tom záleží.
 */
export default function FirmPage() {
  const projectId = useSchemaStore((s) => s.projectId);
  const project = useSchemaStore((s) => s.project);
  const canEdit = useSchemaStore((s) => s.canEdit);
  const snapshot = useSnapshot();

  const load = useFirmStore((s) => s.load);
  const loading = useFirmStore((s) => s.loading);
  const error = useFirmStore((s) => s.error);
  const catalog = useFirmStore((s) => s.catalog);
  const settings = useFirmStore((s) => s.settings);
  const addItem = useFirmStore((s) => s.addItem);
  const updateItem = useFirmStore((s) => s.updateItem);
  const removeItem = useFirmStore((s) => s.removeItem);
  const saveSettings = useFirmStore((s) => s.saveSettings);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    async function run() {
      await load(projectId!);
      if (cancelled) return;
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [projectId, load]);

  const scenario = getScenario(project?.scenario_key ?? "eshop");
  const produkt = entityForRole(snapshot, "product");
  const role = getRole(scenario, "product");

  // Primární klíč se generuje sám, ten žák nevyplňuje.
  const sloupce = produkt
    ? attributesOf(snapshot, produkt.id).filter((a) => !a.isPrimaryKey)
    : [];

  const cenaAttr = sloupce.find((a) => a.semanticKey === "price");
  const skladAttr = sloupce.find((a) => a.semanticKey === "stock");

  if (loading) {
    return <p className="p-8 text-sm text-muted">Načítám firmu…</p>;
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-6">
      {error ? (
        <div className="mb-4 rounded-lg border border-bad/30 bg-bad-soft px-3 py-2 text-sm text-bad">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-ink">
                Co vaše firma prodává
              </h1>
              <p className="mt-1 max-w-xl text-sm text-ink-2">
                Tohle jsou řádky vaší tabulky{" "}
                <strong className="text-ink">{produkt?.name ?? role?.label}</strong>.
                Políčka odpovídají sloupcům, které jste si navrhli.
              </p>
            </div>
            {canEdit && produkt ? (
              <Button size="sm" onClick={() => void addItem({})}>
                <Plus size={15} aria-hidden />
                Přidat položku
              </Button>
            ) : null}
          </div>

          {!produkt ? (
            <div className="mt-4">
              <EmptyState
                title={`Nejdřív si vytvořte tabulku „${role?.label ?? "Produkt"}“`}
                description="Sortiment se zapisuje do vaší vlastní tabulky. Až ji na kartě Návrh vytvoříte a přiřadíte jí roli, objeví se tu formulář podle vašich sloupců."
              />
            </div>
          ) : catalog.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="Zatím tu nic není"
                description="Dokud sortiment nevyplníte, vymyslí si simulace vlastní zboží. Napište sem, co vaše firma opravdu prodává."
              />
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {catalog.map((item, index) => (
                <ItemEditor
                  key={item.id}
                  poradi={index + 1}
                  item={item}
                  sloupce={sloupce}
                  cenaAttr={cenaAttr}
                  skladAttr={skladAttr}
                  marze={settings.marginPercent}
                  canEdit={canEdit}
                  onChange={(patch) => void updateItem(item.id, patch)}
                  onRemove={() => void removeItem(item.id)}
                />
              ))}
            </ul>
          )}

          {produkt && !cenaAttr ? (
            <p className="mt-4 rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-sm text-warn">
              Tabulka „{produkt.name}“ nemá sloupec s významem <strong>Cena</strong>.
              Dokud ho nepřidáte, nemá firma za co prodávat a nespočítá tržbu.
            </p>
          ) : null}
        </section>

        <aside className="space-y-4">
          <Card className="space-y-4">
            <h2 className="font-semibold text-ink">Nastavení firmy</h2>

            <Pole
              popis="Marže"
              napoveda="kolik vám zůstane z prodejní ceny"
              jednotka="%"
              hodnota={settings.marginPercent}
              disabled={!canEdit}
              onChange={(v) => void saveSettings({ marginPercent: v })}
            />
            <p className="-mt-2 text-xs text-muted">
              Nákupní cena se dopočítá jako prodejní × {(1 - settings.marginPercent / 100).toFixed(2)}.
              U jednotlivé položky ji lze přepsat.
            </p>

            <div className="border-t border-border pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                Zaměstnanci
              </p>
              <div className="space-y-3">
                <Pole
                  popis="Počet lidí"
                  hodnota={settings.employees}
                  disabled={!canEdit}
                  onChange={(v) => void saveSettings({ employees: Math.max(0, Math.round(v)) })}
                />
                <Pole
                  popis="Mzda za hodinu"
                  jednotka="Kč"
                  hodnota={settings.hourlyWage}
                  disabled={!canEdit}
                  onChange={(v) => void saveSettings({ hourlyWage: Math.max(0, v) })}
                />
              </div>
              <p className="mt-2 text-xs text-ink-2">
                Otevřeno je 12 hodin denně, mzdy tedy dělají{" "}
                <strong className="text-ink">
                  {formatCurrency(settings.employees * settings.hourlyWage * 12)}
                </strong>{" "}
                za den. Strhávají se průběžně po hodinách.
              </p>
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <Pole
                popis="Nájem a energie"
                napoveda="za den"
                jednotka="Kč"
                hodnota={settings.rentPerDay}
                disabled={!canEdit}
                onChange={(v) => void saveSettings({ rentPerDay: Math.max(0, v) })}
              />
              <Pole
                popis="Počáteční kapitál"
                napoveda="s čím firma začíná"
                jednotka="Kč"
                hodnota={settings.startingCapital}
                disabled={!canEdit}
                onChange={(v) => void saveSettings({ startingCapital: Math.max(0, v) })}
              />
            </div>

            <div className="border-t border-border pt-4">
              <Label htmlFor="auto">Doplňování skladu</Label>
              <Select
                id="auto"
                className="mt-1.5"
                disabled={!canEdit}
                value={settings.autoRestock ? "auto" : "rucne"}
                onChange={(e) => void saveSettings({ autoRestock: e.target.value === "auto" })}
              >
                <option value="auto">Automaticky podle pravidla u položky</option>
                <option value="rucne">Ručně – nakupuji sám během provozu</option>
              </Select>
              <p className="mt-1.5 text-xs text-muted">
                {settings.autoRestock
                  ? "Každé ráno se doobjedná zboží, které kleslo pod nastavenou hranici."
                  : "Sklad se sám nedoplní. Musíte na kartě Provoz hlídat zásoby a nakupovat tlačítkem."}
              </p>
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-ink">Denní fixní náklady</h2>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">
              {formatCurrency(settings.employees * settings.hourlyWage * 12 + settings.rentPerDay)}
            </p>
            <p className="mt-1 text-xs text-ink-2">
              Tolik firma zaplatí každý den, i kdyby nepřišel jediný zákazník.
              Tolik musíte na tržbách minimálně vydělat.
            </p>
          </Card>
        </aside>
      </div>
    </main>
  );
}

function Pole({
  popis,
  napoveda,
  jednotka,
  hodnota,
  disabled,
  onChange,
}: {
  popis: string;
  napoveda?: string;
  jednotka?: string;
  hodnota: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <Label hint={napoveda}>{popis}</Label>
      <div className="mt-1 flex items-center gap-2">
        <Input
          type="number"
          min={0}
          value={hodnota}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {jednotka ? (
          <span className="shrink-0 text-sm text-muted">{jednotka}</span>
        ) : null}
      </div>
    </div>
  );
}

function ItemEditor({
  poradi,
  item,
  sloupce,
  cenaAttr,
  skladAttr,
  marze,
  canEdit,
  onChange,
  onRemove,
}: {
  poradi: number;
  item: CatalogItem;
  sloupce: AttributeRecord[];
  cenaAttr?: AttributeRecord;
  skladAttr?: AttributeRecord;
  marze: number;
  canEdit: boolean;
  onChange: (patch: Partial<CatalogItem>) => void;
  onRemove: () => void;
}) {
  const prodejni = cenaAttr ? Number(item.data[cenaAttr.name]) : NaN;
  const nakupni =
    item.purchasePrice ??
    (Number.isFinite(prodejni) ? prodejni * (1 - marze / 100) : NaN);
  const zisk = Number.isFinite(prodejni) && Number.isFinite(nakupni) ? prodejni - nakupni : NaN;

  return (
    <li className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="mt-2 w-5 text-center text-sm text-muted">{poradi}.</span>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sloupce.map((attr) => (
              <div key={attr.id}>
                <Label>{attr.name}</Label>
                <Input
                  className="mt-1"
                  disabled={!canEdit}
                  type={
                    attr.dataType === "INTEGER" || attr.dataType === "DECIMAL"
                      ? "number"
                      : "text"
                  }
                  value={String(item.data[attr.name] ?? "")}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const hodnota =
                      attr.dataType === "INTEGER" || attr.dataType === "DECIMAL"
                        ? raw === ""
                          ? ""
                          : Number(raw)
                        : raw;
                    onChange({ data: { ...item.data, [attr.name]: hodnota } });
                  }}
                />
              </div>
            ))}
          </div>

          <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-3">
            <div>
              <Label hint="prázdné = z marže">Nákupní cena</Label>
              <Input
                className="mt-1"
                type="number"
                min={0}
                disabled={!canEdit}
                placeholder={Number.isFinite(nakupni) ? String(Math.round(nakupni)) : ""}
                value={item.purchasePrice ?? ""}
                onChange={(e) =>
                  onChange({
                    purchasePrice: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <Label hint="kdy doobjednat">Hranice zásob</Label>
              <Input
                className="mt-1"
                type="number"
                min={0}
                disabled={!canEdit}
                value={item.reorderLevel}
                onChange={(e) => onChange({ reorderLevel: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label hint="kolik kusů">Doobjednat</Label>
              <Input
                className="mt-1"
                type="number"
                min={0}
                disabled={!canEdit}
                value={item.reorderQty}
                onChange={(e) => onChange({ reorderQty: Number(e.target.value) })}
              />
            </div>
          </div>

          {Number.isFinite(zisk) ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge tone="neutral">
                Nákup {formatCurrency(nakupni)}
                {item.purchasePrice === null ? " (z marže)" : ""}
              </Badge>
              <Badge tone={zisk > 0 ? "ok" : "bad"}>
                Zisk z kusu {formatCurrency(zisk)}
              </Badge>
              {skladAttr && Number(item.data[skladAttr.name]) > 0 ? (
                <Badge tone="neutral">
                  První nákup{" "}
                  {formatCurrency(nakupni * Number(item.data[skladAttr.name]))}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>

        {canEdit ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Smazat položku ${poradi}`}
            className="shrink-0 rounded p-1.5 text-muted transition hover:bg-bad-soft hover:text-bad"
          >
            <Trash2 size={15} aria-hidden />
          </button>
        ) : null}
      </div>
    </li>
  );
}
