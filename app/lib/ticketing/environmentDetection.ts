import type { TicketDraft } from "./types";

export type EnvironmentType = "prod" | "stage" | "uat" | "dev" | "unknown";

export function determineEnvironment(ticketDraft: TicketDraft): EnvironmentType {
  const text = [
    ticketDraft.summary || "",
    ticketDraft.description || "",
    ticketDraft.error_condition || "",
    ticketDraft.error_description || "",
    ticketDraft.metadata?.affected_system || "",
    ticketDraft.metadata?.environment || "",
  ]
    .join(" ")
    .toLowerCase();

  if (
    text.includes("production") ||
    text.includes("prod") ||
    text.includes("live environment")
  ) {
    return "prod";
  }

  if (
    text.includes("stage") ||
    text.includes("staging") ||
    text.includes("preprod") ||
    text.includes("pre-prod")
  ) {
    return "stage";
  }

  if (text.includes("uat") || text.includes("user acceptance")) {
    return "uat";
  }

  if (
    text.includes("dev") ||
    text.includes("development") ||
    text.includes("sandbox") ||
    text.includes("test environment")
  ) {
    return "dev";
  }

  return "unknown";
}