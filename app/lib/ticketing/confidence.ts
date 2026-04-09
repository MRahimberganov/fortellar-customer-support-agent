import type { TicketDraft, TicketingSystem, CloudProvider } from "./types";

export function getRoutingConfidence(ticketDraft: TicketDraft): number {
  const text = [
    ticketDraft.summary || "",
    ticketDraft.description || "",
    ticketDraft.error_condition || "",
    ticketDraft.error_description || "",
  ]
    .join(" ")
    .toLowerCase();

  if (
    text.includes("login") ||
    text.includes("password") ||
    text.includes("mfa") ||
    text.includes("outage") ||
    text.includes("ecs") ||
    text.includes("aws") ||
    text.includes("security") ||
    text.includes("phishing")
  ) {
    return 0.9;
  }

  if (text.length > 30) return 0.75;
  return 0.5;
}

export function getCloudConfidence(provider: CloudProvider): number {
  if (provider === "unknown") return 0.4;
  return 0.9;
}

export function getTicketingSystemConfidence(system: TicketingSystem): number {
  if (system === "other") return 0.4;
  return 0.88;
}

export function getSeverityConfidence(severity: string): number {
  if (severity === "sev1" || severity === "sev2") return 0.9;
  if (severity === "sev3") return 0.75;
  return 0.65;
}