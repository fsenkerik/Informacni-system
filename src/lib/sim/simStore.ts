"use client";

import { create } from "zustand";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { DEMO_PROJECT_ID } from "@/lib/er/demo";
import type { SchemaSnapshot, SizePreset } from "@/lib/types";
import { SIZE_PRESET_INFO } from "@/lib/types";
import { SimEngine, type IssueTally } from "./engine";
import { getScenario } from "./scenarios";
import type { SimEvent, SimMetrics, SimRecord } from "./types";

/**
 * Simulaci točí prohlížeč toho, kdo ji spustil (host).
 *
 * Výsledky se dávkují do databáze a lehký stav se posílá spolužákovi přes
 * Realtime Broadcast. Díky tomu nepotřebujeme běžící server, a zůstáváme
 * tak na bezplatném tarifu.
 */

/** Kolik herních minut uběhne za jednu skutečnou sekundu. */
export const SPEEDS = [
  { value: 10, label: "10×", hint: "den trvá 72 s" },
  { value: 30, label: "30×", hint: "den trvá 24 s" },
  { value: 60, label: "60×", hint: "den trvá 12 s" },
  { value: 300, label: "300×", hint: "přeskočit dopředu" },
] as const;

const LOG_LIMIT = 60;
const RECORDS_PER_TABLE = 40;
/** Kolik řádků se z běhu uloží do databáze, aby projekt nepřerostl free tier. */
const PERSIST_RECORD_CAP = 300;
const FRAME_MS = 50;
const BROADCAST_MS = 250;
const PERSIST_MS = 3000;

export interface ActiveCustomer {
  id: string;
  name: string;
  entityId: string | null;
  stepKey: string | null;
  message: string;
  state: "walking" | "written" | "lost";
  at: number;
}

interface SimState {
  status: "idle" | "running" | "paused";
  isHost: boolean;
  runId: string | null;
  speed: number;
  clock: number;
  day: number;
  minuteOfDay: number;
  isOpen: boolean;
  metrics: SimMetrics;
  issues: IssueTally[];
  log: SimEvent[];
  records: Record<string, SimRecord[]>;
  activeCustomer: ActiveCustomer | null;
  flashes: Record<string, number>;

  start(input: {
    projectId: string;
    snapshot: SchemaSnapshot;
    scenarioKey: string;
    sizePreset: SizePreset;
  }): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): Promise<void>;
  setSpeed(speed: number): void;
  /** Schéma se změnilo v editoru – engine musí pracovat s novou verzí. */
  syncSchema(snapshot: SchemaSnapshot): void;
  /** Připojí se jako divák k běhu, který točí spolužák. */
  watch(projectId: string): () => void;
}

const EMPTY_METRICS: SimMetrics = {
  customersArrived: 0,
  customersServed: 0,
  customersLost: 0,
  ordersCreated: 0,
  revenue: 0,
  dataIntegrity: 100,
  recordsWritten: 0,
  integrityViolations: 0,
  daysElapsed: 0,
};

let engine: SimEngine | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let channel: RealtimeChannel | null = null;
let lastBroadcast = 0;
let lastPersist = 0;
let persistedRecords = 0;
let pendingRecords: { entityId: string; record: SimRecord }[] = [];
let currentProjectId: string | null = null;

function stopTimer() {
  if (timer) clearInterval(timer);
  timer = null;
}

export const useSimStore = create<SimState>((set, get) => ({
  status: "idle",
  isHost: false,
  runId: null,
  speed: 30,
  clock: 8 * 60,
  day: 0,
  minuteOfDay: 8 * 60,
  isOpen: true,
  metrics: EMPTY_METRICS,
  issues: [],
  log: [],
  records: {},
  activeCustomer: null,
  flashes: {},

  setSpeed(speed) {
    set({ speed });
  },

  syncSchema(snapshot) {
    engine?.updateSnapshot(snapshot);
  },

  async start({ projectId, snapshot, scenarioKey, sizePreset }) {
    const demo = projectId === DEMO_PROJECT_ID;
    const scenario = getScenario(scenarioKey);
    const customersPerDay = SIZE_PRESET_INFO[sizePreset].customersPerDay;
    const seed = Math.floor(Math.random() * 2_000_000_000) + 1;

    currentProjectId = projectId;
    persistedRecords = 0;
    pendingRecords = [];
    engine = new SimEngine({ snapshot, scenario, seed, customersPerDay });

    let runId: string | null = null;
    if (!demo) {
      const supabase = getSupabaseBrowserClient();
      const { data: user } = await supabase.auth.getUser();
      const { data: run } = await supabase
        .from("sim_runs")
        .insert({
          project_id: projectId,
          scenario_key: scenarioKey,
          seed,
          speed: get().speed,
          customers_per_day: customersPerDay,
          host_user_id: user.user?.id ?? null,
        })
        .select()
        .single();
      runId = run?.id ?? null;
    }

    set({
      status: "running",
      isHost: true,
      runId,
      metrics: EMPTY_METRICS,
      issues: [],
      log: [],
      records: {},
      activeCustomer: null,
      clock: 8 * 60,
    });

    if (!demo) ensureChannel(projectId);
    startLoop(set, get);
  },

  pause() {
    stopTimer();
    set({ status: "paused" });
  },

  resume() {
    if (!engine) return;
    set({ status: "running" });
    startLoop(set, get);
  },

  async stop() {
    stopTimer();
    const { runId, metrics } = get();
    if (runId) {
      const supabase = getSupabaseBrowserClient();
      await supabase
        .from("sim_runs")
        .update({ status: "finished", metrics: metricsToJson(metrics) })
        .eq("id", runId);
    }
    engine = null;
    set({ status: "idle", isHost: false, runId: null, activeCustomer: null });
  },

  watch(projectId) {
    if (projectId === DEMO_PROJECT_ID) return () => {};
    const supabase = getSupabaseBrowserClient();
    const watchChannel = supabase
      .channel(`sim:${projectId}`)
      .on("broadcast", { event: "tick" }, ({ payload }) => {
        const state = payload as BroadcastPayload;
        if (get().isHost) return;
        set({
          status: state.status,
          clock: state.clock,
          day: state.day,
          minuteOfDay: state.minuteOfDay,
          isOpen: state.isOpen,
          metrics: state.metrics,
          issues: state.issues,
          activeCustomer: state.activeCustomer,
          log: [...state.events, ...get().log].slice(0, LOG_LIMIT),
        });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(watchChannel);
    };
  },
}));

interface BroadcastPayload {
  status: "idle" | "running" | "paused";
  clock: number;
  day: number;
  minuteOfDay: number;
  isOpen: boolean;
  metrics: SimMetrics;
  issues: IssueTally[];
  events: SimEvent[];
  activeCustomer: ActiveCustomer | null;
}

function ensureChannel(projectId: string) {
  if (channel) return;
  const supabase = getSupabaseBrowserClient();
  channel = supabase.channel(`sim:${projectId}`).subscribe();
}

function metricsToJson(metrics: SimMetrics): Record<string, number> {
  return { ...metrics };
}

type SetState = (
  partial: Partial<SimState> | ((state: SimState) => Partial<SimState>),
) => void;

function startLoop(set: SetState, get: () => SimState) {
  stopTimer();

  timer = setInterval(() => {
    if (!engine) return;
    const { speed } = get();

    // Kolik herních minut se má odbavit v tomhle snímku.
    const budget = Math.max(1, Math.round((speed * FRAME_MS) / 1000));
    const frameEvents: SimEvent[] = [];
    let last = null as ReturnType<SimEngine["tick"]> | null;

    for (let i = 0; i < budget; i += 1) {
      last = engine.tick();
      frameEvents.push(...last.events);
    }
    if (!last) return;

    const active = deriveActiveCustomer(frameEvents, get().activeCustomer);
    const flashes = { ...get().flashes };
    const records = { ...get().records };

    for (const event of frameEvents) {
      if (event.type === "RECORD_INSERTED" && event.entityId) {
        flashes[event.entityId] = Date.now();
        const fromEngine = engine.getRecords(event.entityId);
        records[event.entityId] = fromEngine.slice(-RECORDS_PER_TABLE);
        const fresh = fromEngine[fromEngine.length - 1];
        if (fresh && persistedRecords < PERSIST_RECORD_CAP) {
          pendingRecords.push({ entityId: event.entityId, record: fresh });
          persistedRecords += 1;
        }
      }
    }

    set({
      clock: last.clock,
      day: last.day,
      minuteOfDay: last.minuteOfDay,
      isOpen: last.isOpen,
      metrics: last.metrics,
      issues: engine.getIssues(),
      activeCustomer: active,
      flashes,
      records,
      log: [...frameEvents.filter(isLoggable).reverse(), ...get().log].slice(0, LOG_LIMIT),
    });

    const now = Date.now();
    if (channel && now - lastBroadcast > BROADCAST_MS) {
      lastBroadcast = now;
      const state = get();
      void channel.send({
        type: "broadcast",
        event: "tick",
        payload: {
          status: state.status,
          clock: state.clock,
          day: state.day,
          minuteOfDay: state.minuteOfDay,
          isOpen: state.isOpen,
          metrics: state.metrics,
          issues: state.issues,
          events: frameEvents.filter(isLoggable).slice(0, 10),
          activeCustomer: state.activeCustomer,
        } satisfies BroadcastPayload,
      });
    }

    if (now - lastPersist > PERSIST_MS) {
      lastPersist = now;
      void persist(get());
    }
  }, FRAME_MS);
}

/** Do logu patří jen to, čemu žák rozumí – ne každý interní krok. */
function isLoggable(event: SimEvent): boolean {
  return (
    event.type === "CUSTOMER_LOST" ||
    event.type === "CUSTOMER_LEFT" ||
    event.type === "STEP_FAILED" ||
    event.type === "DAY_ENDED" ||
    event.type === "RECORD_INSERTED"
  );
}

function deriveActiveCustomer(
  events: SimEvent[],
  previous: ActiveCustomer | null,
): ActiveCustomer | null {
  let current = previous;

  for (const event of events) {
    if (event.type === "CUSTOMER_ARRIVED" && event.customerId) {
      current = {
        id: event.customerId,
        name: event.message.replace("Přišel zákazník ", "").replace(".", ""),
        entityId: null,
        stepKey: null,
        message: "přichází",
        state: "walking",
        at: Date.now(),
      };
    } else if (event.type === "RECORD_INSERTED" && current) {
      current = {
        ...current,
        entityId: event.entityId ?? current.entityId,
        message: event.message,
        state: "written",
        at: Date.now(),
      };
    } else if (event.type === "STEP_FAILED" && event.severity === "error" && current) {
      current = {
        ...current,
        entityId: event.entityId ?? current.entityId,
        stepKey: event.stepKey ?? null,
        message: event.message,
        state: "lost",
        at: Date.now(),
      };
    }
  }

  return current;
}

async function persist(state: SimState) {
  const supabase = getSupabaseBrowserClient();
  const { runId, metrics, issues } = state;
  if (!runId || !currentProjectId || currentProjectId === DEMO_PROJECT_ID) return;

  await supabase
    .from("sim_runs")
    .update({
      metrics: metricsToJson(metrics),
      sim_clock: state.clock,
      heartbeat_at: new Date().toISOString(),
    })
    .eq("id", runId);

  if (pendingRecords.length > 0) {
    const batch = pendingRecords.splice(0, pendingRecords.length);
    await supabase.from("sim_records").insert(
      batch.map(({ entityId, record }) => ({
        run_id: runId,
        entity_id: entityId,
        data: record.data,
        created_tick: record.tick,
      })),
    );
  }

  if (issues.length > 0) {
    await supabase.from("sim_issues").upsert(
      issues.map((issue) => ({
        run_id: runId,
        code: issue.code,
        entity_id: issue.entityId ?? null,
        relationship_id: issue.relationshipId ?? null,
        message: issue.message,
        count: issue.count,
        first_seen_tick: issue.firstSeenTick,
        last_seen_tick: issue.lastSeenTick,
      })),
      { onConflict: "run_id,code,entity_id" },
    );
  }
}
