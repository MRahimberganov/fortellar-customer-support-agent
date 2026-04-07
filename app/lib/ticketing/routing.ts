import type { TicketDraft } from "./types";

export function determineAssignmentGroup(ticketDraft: TicketDraft) {
  const summary = String(ticketDraft?.summary || "").toLowerCase();
  const description = String(ticketDraft?.description || "").toLowerCase();
  const errorCondition = String(ticketDraft?.error_condition || "").toLowerCase();
  const errorDescription = String(ticketDraft?.error_description || "").toLowerCase();

  const combinedText = [
    summary,
    description,
    errorCondition,
    errorDescription,
  ].join(" ");

  if (
    combinedText.includes("log in") ||
    combinedText.includes("login") ||
    combinedText.includes("sign in") ||
    combinedText.includes("password") ||
    combinedText.includes("access denied") ||
    combinedText.includes("account locked") ||
    combinedText.includes("mfa")
  ) {
    return {
      assignment_group: "IAM Team",
      assignment_reason: "Detected login, password, MFA, or access-related issue.",
      category: "access",
      subcategory: "login",
    };
  }

  if (
    combinedText.includes("outage") ||
    combinedText.includes("deployment") ||
    combinedText.includes("server") ||
    combinedText.includes("aws") ||
    combinedText.includes("cloud") ||
    combinedText.includes("infrastructure") ||
    combinedText.includes("infra") ||
    combinedText.includes("dns") ||
    combinedText.includes("network") ||
    combinedText.includes("container") ||
    combinedText.includes("kubernetes") ||
    combinedText.includes("service down")
  ) {
    return {
      assignment_group: "CloudOps Team",
      assignment_reason: "Detected infrastructure, cloud platform, deployment, or outage issue.",
      category: "infrastructure",
      subcategory: "cloudops",
    };
  }

  if (
    combinedText.includes("security") ||
    combinedText.includes("phishing") ||
    combinedText.includes("malware") ||
    combinedText.includes("breach") ||
    combinedText.includes("unauthorized") ||
    combinedText.includes("suspicious") ||
    combinedText.includes("vpn compromise") ||
    combinedText.includes("compliance")
  ) {
    return {
      assignment_group: "Security Team",
      assignment_reason: "Detected security, suspicious activity, or compliance-related issue.",
      category: "security",
      subcategory: "incident",
    };
  }

  if (
    combinedText.includes("data") ||
    combinedText.includes("pipeline") ||
    combinedText.includes("etl") ||
    combinedText.includes("dashboard") ||
    combinedText.includes("report") ||
    combinedText.includes("warehouse") ||
    combinedText.includes("job failed") ||
    combinedText.includes("report failed")
  ) {
    return {
      assignment_group: "Data Team",
      assignment_reason: "Detected data, reporting, ETL, or pipeline issue.",
      category: "data",
      subcategory: "pipeline",
    };
  }

  return {
    assignment_group: "General Support",
    assignment_reason: "No strong routing keyword detected.",
    category: "general",
    subcategory: "general",
  };
}