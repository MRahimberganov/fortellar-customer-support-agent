import type { TicketDraft } from "./types";

export function mergeTicketDraft(
  baseDraft: TicketDraft,
  updates: Partial<TicketDraft>,
): TicketDraft {
  return {
    ...baseDraft,
    ...updates,
    contact: {
      ...(baseDraft.contact || {}),
      ...(updates.contact || {}),
    },
    metadata: {
      ...(baseDraft.metadata || {}),
      ...(updates.metadata || {}),
    },
    screenshot_attachment: {
      ...(baseDraft.screenshot_attachment || {}),
      ...(updates.screenshot_attachment || {}),
    },
    confidence: {
      ...(baseDraft.confidence || {}),
      ...(updates.confidence || {}),
    },
    labels: Array.from(
      new Set([...(baseDraft.labels || []), ...(updates.labels || [])]),
    ),
    decision_log: [
      ...(baseDraft.decision_log || []),
      ...(updates.decision_log || []),
    ],
  };
}