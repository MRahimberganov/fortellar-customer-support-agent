import type { DecisionLogEntry } from "./types";

export function addDecisionLog(
  existing: DecisionLogEntry[] = [],
  step: string,
  reason: string,
  value?: string,
  confidence?: number,
): DecisionLogEntry[] {
  return [
    ...existing,
    {
      step,
      reason,
      value,
      confidence,
      timestamp: new Date().toISOString(),
    },
  ];
}