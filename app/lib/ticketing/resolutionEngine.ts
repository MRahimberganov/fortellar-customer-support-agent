import type { TicketDraft, ResolutionSuggestion } from "./types";

export function determineResolutionSuggestion(
  ticketDraft: TicketDraft,
): ResolutionSuggestion {
  const text = [
    ticketDraft.summary || "",
    ticketDraft.description || "",
    ticketDraft.error_condition || "",
    ticketDraft.error_description || "",
    ticketDraft.category || "",
    ticketDraft.subcategory || "",
    ticketDraft.component_type || "",
  ]
    .join(" ")
    .toLowerCase();

  const severity = ticketDraft.severity || "sev4";
  const environment = ticketDraft.metadata?.environment || "unknown";

  const isHighRisk =
    severity === "sev1" ||
    severity === "sev2" ||
    environment === "prod" ||
    text.includes("outage") ||
    text.includes("service down") ||
    text.includes("production") ||
    text.includes("customers cannot access") ||
    text.includes("unauthorized access") ||
    text.includes("breach") ||
    text.includes("malware") ||
    text.includes("phishing");

  if (isHighRisk) {
    return {
      should_attempt_resolution: false,
      resolution_type: "unknown",
      suggested_steps: [],
      confidence: 0.95,
    };
  }

  if (
    text.includes("password") ||
    text.includes("reset password") ||
    text.includes("account locked")
  ) {
    return {
      should_attempt_resolution: true,
      resolution_type: "password_reset",
      suggested_steps: [
        "Confirm the affected application or system.",
        "Make sure Caps Lock is off and re-enter your credentials manually.",
        "Use the password reset option if available.",
        "After resetting, try signing in again.",
      ],
      confidence: 0.92,
    };
  }

  if (
    text.includes("mfa") ||
    text.includes("multi-factor") ||
    text.includes("authenticator") ||
    text.includes("verification code")
  ) {
    return {
      should_attempt_resolution: true,
      resolution_type: "mfa",
      suggested_steps: [
        "Verify that your authenticator app time is synced correctly.",
        "Retry the MFA prompt or request a new verification code.",
        "If available, use an alternate MFA method.",
        "If the issue continues, re-enroll MFA based on your organization process.",
      ],
      confidence: 0.9,
    };
  }

  if (
    text.includes("vpn") ||
    text.includes("connection failed") ||
    text.includes("remote access")
  ) {
    return {
      should_attempt_resolution: true,
      resolution_type: "vpn",
      suggested_steps: [
        "Disconnect and reconnect the VPN client.",
        "Confirm whether the error is credentials-related or network-related.",
        "If credentials-related, try resetting your password.",
        "Retry from a stable network connection.",
      ],
      confidence: 0.88,
    };
  }

  if (
    text.includes("browser") ||
    text.includes("cache") ||
    text.includes("cookies") ||
    text.includes("page not loading") ||
    text.includes("portal page")
  ) {
    return {
      should_attempt_resolution: true,
      resolution_type: "browser",
      suggested_steps: [
        "Refresh the page and try again.",
        "Clear browser cache and cookies.",
        "Try an incognito/private window.",
        "Retry using a different supported browser if possible.",
      ],
      confidence: 0.82,
    };
  }

  if (
    text.includes("onboarding") ||
    text.includes("new laptop") ||
    text.includes("laptop setup") ||
    text.includes("new hire")
  ) {
    return {
      should_attempt_resolution: true,
      resolution_type: "onboarding",
      suggested_steps: [
        "Confirm which setup step is failing.",
        "Verify account access and required applications.",
        "Retry the setup process after signing out and back in.",
        "Document any exact error message shown during setup.",
      ],
      confidence: 0.8,
    };
  }

  return {
    should_attempt_resolution: false,
    resolution_type: "unknown",
    suggested_steps: [],
    confidence: 0.5,
  };
}