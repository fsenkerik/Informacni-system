import type { RoleDef, Scenario } from "../types";
import { autoservis } from "./autoservis";
import { eshop } from "./eshop";
import { kavarna } from "./kavarna";
import { pujcovna } from "./pujcovna";

export const SCENARIOS: Scenario[] = [eshop, kavarna, autoservis, pujcovna];

export const DEFAULT_SCENARIO_KEY = eshop.key;

export function getScenario(key: string): Scenario {
  return SCENARIOS.find((s) => s.key === key) ?? eshop;
}

export function getRole(scenario: Scenario, key: string | null): RoleDef | undefined {
  if (!key) return undefined;
  return scenario.roles.find((r) => r.key === key);
}

export { autoservis, eshop, kavarna, pujcovna };
