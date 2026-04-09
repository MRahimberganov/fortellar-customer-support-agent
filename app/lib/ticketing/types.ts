export type ScreenshotPayload = {
  file_name: string;
  file_type: string;
  content_base64: string;
};

export type TicketingSystem = "jira" | "servicenow" | "zendesk" | "other";
export type CloudProvider = "aws" | "azure" | "gcp" | "unknown";

export type ConfidenceScores = {
  routing?: number;
  ticketing_system?: number;
  cloud_provider?: number;
  severity?: number;
  resolution?: number;
};

export type DecisionLogEntry = {
  step: string;
  reason: string;
  value?: string;
  confidence?: number;
  timestamp?: string;
};

export type WorkflowDecision = {
  should_create_ticket: boolean;
  should_send_alert: boolean;
  should_ask_follow_up: boolean;
  should_attempt_auto_resolution: boolean;
  should_escalate: boolean;
};

export type TicketDraft = {
  summary: string;
  description: string;
  priority: string;
  issue_type: string;
  labels: string[];
  assignment_group?: string;
  assignment_reason?: string;
  category?: string;
  subcategory?: string;

  severity?: "sev1" | "sev2" | "sev3" | "sev4";
  impact?: "single_user" | "team" | "department" | "customer_facing" | "production";
  urgency?: "low" | "medium" | "high" | "critical";
  affected_service?: string;
  component_type?: "api" | "frontend" | "database" | "auth" | "network" | "infra" | "data" | "unknown";

  contact?: {
    name?: string;
    email?: string;
    phone?: string;
  };

  error_condition?: string;
  error_description?: string;

  metadata?: {
    affected_system?: string;
    environment?: "prod" | "stage" | "uat" | "dev" | "unknown";
    timestamp?: string;
    after_hours?: boolean;
    cloud_provider?: CloudProvider;
  };

  screenshot_attachment?: {
    file_name?: string;
    file_type?: string;
    attached?: boolean;
  };

  confidence?: ConfidenceScores;
  decision_log?: DecisionLogEntry[];
};

export type TicketResult = {
  attempted: boolean;
  created: boolean;
  key: string;
  url: string;
  error: string;
};

export type TicketProviderHandler = (
  ticketDraft: TicketDraft,
  screenshotFile?: ScreenshotPayload | null,
) => Promise<TicketResult>;

export type ResolutionType =
  | "password_reset"
  | "mfa"
  | "vpn"
  | "browser"
  | "onboarding"
  | "unknown";

export type ResolutionSuggestion = {
  should_attempt_resolution: boolean;
  resolution_type: ResolutionType;
  suggested_steps: string[];
  confidence: number;
};