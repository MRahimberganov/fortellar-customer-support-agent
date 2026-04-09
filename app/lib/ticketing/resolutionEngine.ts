import type { TicketDraft, ResolutionSuggestion } from "./types";

export function determineResolutionSuggestion(
  ticketDraft: TicketDraft,
  userMessage: string,
): ResolutionSuggestion {
  const text = [
    userMessage || "",
    ticketDraft.summary || "",
    ticketDraft.description || "",
    ticketDraft.error_condition || "",
    ticketDraft.error_description || "",
    ticketDraft.category || "",
    ticketDraft.subcategory || "",
    ticketDraft.component_type || "",
    ticketDraft.assignment_group || "",
  ]
    .join(" ")
    .toLowerCase();

  // Debug logs
  console.log("RESOLUTION ENGINE TEXT:", text);
  console.log("RESOLUTION ENGINE INPUT:", {
    summary: ticketDraft.summary,
    description: ticketDraft.description,
    category: ticketDraft.category,
    subcategory: ticketDraft.subcategory,
    component_type: ticketDraft.component_type,
    assignment_group: ticketDraft.assignment_group,
  });

  const severity = ticketDraft.severity || "sev4";
  const environment = ticketDraft.metadata?.environment || "unknown";

  const isHighRisk =
    severity === "sev1" ||
    severity === "sev2" ||
    text.includes("outage") ||
    text.includes("service down") ||
    text.includes("production outage") ||
    text.includes("customers cannot access") ||
    text.includes("unauthorized access") ||
    text.includes("breach") ||
    text.includes("malware") ||
    text.includes("phishing");

  // 🚨 High-risk issues → skip resolution
  if (isHighRisk) {
    return {
      should_attempt_resolution: false,
      resolution_type: "unknown",
      suggested_steps: [],
      confidence: 0.95,
    };
  }

  // 🔐 Password reset
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

  // 🌐 VPN / Remote access (IMPORTANT: comes before MFA)
  if (
    text.includes("vpn") ||
    text.includes("connection failed") ||
    text.includes("remote access") ||
    text.includes("cannot connect remotely")
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

  // 🔐 MFA / Auth / Login
  if (
    text.includes("mfa") ||
    text.includes("multi-factor") ||
    text.includes("authenticator") ||
    text.includes("verification code") ||
    text.includes("login") ||
    text.includes("log in") ||
    text.includes("sign in") ||
    text.includes("access") ||
    text.includes("auth") ||
    text.includes("iam")
  ) {
    return {
      should_attempt_resolution: true,
      resolution_type: "mfa",
      suggested_steps: [
        "Check your MFA device for proper function and time settings.",
        "Re-enter your credentials to ensure there are no typos.",
        "Try a different MFA method if one is available.",
        "Clear your browser cache and cookies.",
        "Try a different browser or device.",
      ],
      confidence: 0.9,
    };
  }

  // 🌍 Browser issues
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

  // 💻 Onboarding / device setup
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

  // ❓ Default fallback
  return {
    should_attempt_resolution: false,
    resolution_type: "unknown",
    suggested_steps: [],
    confidence: 0.5,
  };
}