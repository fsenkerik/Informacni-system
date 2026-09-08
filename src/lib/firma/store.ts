"use client";

import { create } from "zustand";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { DEMO_PROJECT_ID } from "@/lib/er/demo";
import type { CatalogItemRow, ProjectSettingsRow } from "@/lib/supabase/types";
import { DEFAULT_FIRM_SETTINGS, type CatalogItem, type FirmSettings } from "@/lib/sim/types";

/**
 * Sortiment a nastavení firmy.
 *
 * Sortiment se drží zvlášť od schématu, ale jeho hodnoty odpovídají sloupcům,
 * které si žák navrhl v tabulce s rolí Produkt – tabulka je jeho, my do ní
 * jen zapisujeme řádky.
 */

interface FirmState {
  projectId: string | null;
  settings: FirmSettings;
  catalog: CatalogItem[];
  loading: boolean;
  error: string | null;

  load(projectId: string): Promise<void>;
  saveSettings(patch: Partial<FirmSettings>): Promise<void>;
  addItem(data: Record<string, unknown>): Promise<void>;
  updateItem(id: string, patch: Partial<CatalogItem>): Promise<void>;
  removeItem(id: string): Promise<void>;
}

function toSettings(row: ProjectSettingsRow | null): FirmSettings {
  if (!row) return DEFAULT_FIRM_SETTINGS;
  return {
    marginPercent: Number(row.margin_percent),
    employees: row.employees,
    hourlyWage: Number(row.hourly_wage),
    rentPerDay: Number(row.rent_per_day),
    startingCapital: Number(row.starting_capital),
    autoRestock: row.auto_restock,
  };
}

function toItem(row: CatalogItemRow): CatalogItem {
  return {
    id: row.id,
    data: row.data,
    purchasePrice: row.purchase_price === null ? null : Number(row.purchase_price),
    reorderLevel: row.reorder_level,
    reorderQty: row.reorder_qty,
  };
}

export const useFirmStore = create<FirmState>((set, get) => ({
  projectId: null,
  settings: DEFAULT_FIRM_SETTINGS,
  catalog: [],
  loading: true,
  error: null,

  async load(projectId) {
    set({ projectId, loading: true, error: null });

    if (projectId === DEMO_PROJECT_ID) {
      set({ settings: DEFAULT_FIRM_SETTINGS, catalog: [], loading: false });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const [settings, catalog] = await Promise.all([
      supabase.from("project_settings").select("*").eq("project_id", projectId).maybeSingle(),
      supabase
        .from("catalog_items")
        .select("*")
        .eq("project_id", projectId)
        .order("order_index", { ascending: true }),
    ]);

    if (settings.error || catalog.error) {
      set({
        loading: false,
        error:
          "Nastavení firmy se nepodařilo načíst. Spustil jsi v Supabase migraci 0003_firma.sql?",
      });
      return;
    }

    set({
      settings: toSettings(settings.data),
      catalog: (catalog.data ?? []).map(toItem),
      loading: false,
    });
  },

  async saveSettings(patch) {
    const { projectId, settings } = get();
    if (!projectId) return;

    const next = { ...settings, ...patch };
    set({ settings: next });
    if (projectId === DEMO_PROJECT_ID) return;

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("project_settings").upsert(
      {
        project_id: projectId,
        margin_percent: next.marginPercent,
        employees: next.employees,
        hourly_wage: next.hourlyWage,
        rent_per_day: next.rentPerDay,
        starting_capital: next.startingCapital,
        auto_restock: next.autoRestock,
      },
      { onConflict: "project_id" },
    );

    if (error) set({ error: "Nastavení se nepodařilo uložit." });
  },

  async addItem(data) {
    const { projectId, catalog } = get();
    if (!projectId) return;

    if (projectId === DEMO_PROJECT_ID) {
      set({
        catalog: [
          ...catalog,
          {
            id: globalThis.crypto.randomUUID(),
            data,
            purchasePrice: null,
            reorderLevel: 5,
            reorderQty: 20,
          },
        ],
      });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const { data: row, error } = await supabase
      .from("catalog_items")
      .insert({ project_id: projectId, data, order_index: catalog.length, purchase_price: null })
      .select()
      .single();

    if (error || !row) {
      set({ error: "Položku se nepodařilo přidat." });
      return;
    }
    set({ catalog: [...get().catalog, toItem(row)] });
  },

  async updateItem(id, patch) {
    set((s) => ({
      catalog: s.catalog.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
    if (get().projectId === DEMO_PROJECT_ID) return;

    const supabase = getSupabaseBrowserClient();
    const row: Partial<CatalogItemRow> = {};
    if (patch.data !== undefined) row.data = patch.data;
    if (patch.purchasePrice !== undefined) row.purchase_price = patch.purchasePrice;
    if (patch.reorderLevel !== undefined) row.reorder_level = patch.reorderLevel;
    if (patch.reorderQty !== undefined) row.reorder_qty = patch.reorderQty;

    await supabase.from("catalog_items").update(row).eq("id", id);
  },

  async removeItem(id) {
    set((s) => ({ catalog: s.catalog.filter((i) => i.id !== id) }));
    if (get().projectId === DEMO_PROJECT_ID) return;

    const supabase = getSupabaseBrowserClient();
    await supabase.from("catalog_items").delete().eq("id", id);
  },
}));
