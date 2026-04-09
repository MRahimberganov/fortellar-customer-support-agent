import type { TicketDraft, WorkflowDecision } from "./types";

export function evaluateWorkflow(ticketDraft: TicketDraft): WorkflowDecision {
  const severity = ticketDraft.severity || "sev4";
  const contact = ticketDraft.contact || {};
  const routingConfidence = ticketDraft.confidence?.routing || 0;

  const missingContactInfo =
    !contact.name?.trim() || !contact.email?.trim() || !contact.phone?.trim();

  const should_escalate = severity === "sev1" || severity === "sev2";
  const should_send_alert = severity === "sev1";
  const should_attempt_auto_resolution =
    severity === "sev4" || ticketDraft.category === "access";
  const should_ask_follow_up =
    severity !== "sev1" && (missingContactInfo || routingConfidence < 0.65);

  return {
    should_create_ticket: !should_ask_follow_up,
    should_send_alert,
    should_ask_follow_up,
    should_attempt_auto_resolution,
    should_escalate,
  };
}