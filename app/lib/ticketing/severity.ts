import type { TicketDraft } from "./types";

export function determineSeverity(ticketDraft: TicketDraft): {
  severity: "sev1" | "sev2" | "sev3" | "sev4";
  impact: "single_user" | "team" | "department" | "customer_facing" | "production";
  urgency: "low" | "medium" | "high" | "critical";
} {
  const text = [
    ticketDraft.summary || "",
    ticketDraft.description || "",
    ticketDraft.error_condition || "",
    ticketDraft.error_description || "",
    ticketDraft.metadata?.affected_system || "",
  ]
    .join(" ")
    .toLowerCase();

  const environment = ticketDraft.metadata?.environment || "unknown";

  const isOutage =
    text.includes("production is down") ||
    text.includes("prod is down") ||
    text.includes("outage") ||
    text.includes("customers cannot access") ||
    text.includes("portal is down") ||
    text.includes("service down") ||
    text.includes("503") ||
    text.includes("504");

  if (isOutage && environment === "prod") {
    return {
      severity: "sev1",
      impact: "production",
      urgency: "critical",
    };
  }

  if (
    isOutage &&
    (environment === "stage" || environment === "uat")
  ) {
    return {
      severity: "sev2",
      impact: "department",
      urgency: "high",
    };
  }

  if (
    text.includes("critical") ||
    text.includes("multiple users") ||
    text.includes("department") ||
    text.includes("system unavailable") ||
    text.includes("degraded")
  ) {
    return {
      severity: "sev2",
      impact: "department",
      urgency: "high",
    };
  }

  if (
    text.includes("single user") ||
    text.includes("access issue") ||
    text.includes("login issue") ||
    text.includes("intermittent")
  ) {
    return {
      severity: "sev3",
      impact: "team",
      urgency: "medium",
    };
  }

  return {
    severity: "sev4",
    impact: "single_user",
    urgency: "low",
  };
}