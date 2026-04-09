import { z } from "zod";
import { retrieveContext, RAGSource } from "@/app/lib/rag";
import crypto from "crypto";
import customerSupportCategories from "@/app/lib/customer_support_categories.json";
import { createExternalTicket } from "@/app/lib/ticketing/createExternalTicket";
import { determineAssignmentGroup } from "@/app/lib/ticketing/routing";
import { sendTeamsAlert } from "@/app/lib/ticketing/teams";
import { determineCloudProvider } from "@/app/lib/ticketing/cloudRouting";
import { determineSeverity } from "@/app/lib/ticketing/severity";
import {
  getRoutingConfidence,
  getCloudConfidence,
  getTicketingSystemConfidence,
  getSeverityConfidence,
} from "@/app/lib/ticketing/confidence";
import { addDecisionLog } from "@/app/lib/ticketing/decisionLog";
import { evaluateWorkflow } from "@/app/lib/ticketing/workflowEngine";

const responseSchema = z.object({
  response: z.string(),
  thinking: z.string(),
  user_mood: z.enum([
    "positive",
    "neutral",
    "negative",
    "curious",
    "frustrated",
    "confused",
  ]),
  suggested_questions: z.array(z.string()).default([]),
  debug: z.object({
    context_used: z.boolean(),
    after_hours: z.boolean(),
  }),
  matched_categories: z.array(z.string()).optional().default([]),
  redirect_to_agent: z
    .object({
      should_redirect: z.boolean(),
      reason: z.string().optional().default(""),
    })
    .default({
      should_redirect: false,
      reason: "",
    }),
  support_workflow: z.object({
    intent: z.enum([
      "question",
      "issue",
      "troubleshooting",
      "ticket_request",
      "other",
    ]),
    issue_type: z.string().default("general"),
    ticketing_system: z.string().optional(),
    cloud_provider: z.enum(["aws", "azure", "gcp", "unknown"]).default("unknown"),
    target_system: z.enum(["jira", "servicenow", "zendesk", "none"]).default("none"),
    action_type: z.enum([
      "troubleshoot",
      "create_ticket",
      "notify",
      "cloud_request",
      "none",
    ]).default("none"),
    after_hours: z.boolean(),
    business_hours: z.boolean(),
    needs_follow_up: z.boolean(),
    follow_up_questions: z.array(z.string()).default([]),
    troubleshooting_steps: z.array(z.string()).default([]),
    attempted_resolution: z.boolean(),
    resolution_status: z.enum([
      "resolved",
      "unresolved",
      "needs_more_info",
      "unknown",
    ]),
    should_create_ticket: z.boolean(),
    escalation_reason: z.string().default(""),
    ticket_draft: z.object({
      summary: z.string().default(""),
      description: z.string().default(""),
      priority: z.string().default("Medium"),
      issue_type: z.string().default("Support"),
      labels: z.array(z.string()).default([]),
      assignment_group: z.string().default("General Support"),
      assignment_reason: z.string().default(""),
      category: z.string().default("general"),
      subcategory: z.string().default("general"),
    
      severity: z.enum(["sev1", "sev2", "sev3", "sev4"]).optional(),
      impact: z
        .enum([
          "single_user",
          "team",
          "department",
          "customer_facing",
          "production",
        ])
        .optional(),
      urgency: z.enum(["low", "medium", "high", "critical"]).optional(),
      affected_service: z.string().optional(),
      component_type: z
        .enum([
          "api",
          "frontend",
          "database",
          "auth",
          "network",
          "infra",
          "unknown",
        ])
        .optional(),
    
      contact: z
        .object({
          name: z.string().default(""),
          email: z.string().default(""),
          phone: z.string().default(""),
        })
        .default({
          name: "",
          email: "",
          phone: "",
        }),
    
      error_condition: z.string().default(""),
      error_description: z.string().default(""),
    
      metadata: z
        .object({
          affected_system: z.string().default(""),
          environment: z.string().default(""),
          timestamp: z.string().default(""),
          after_hours: z.boolean().default(false),
          cloud_provider: z
            .enum(["aws", "azure", "gcp", "unknown"])
            .default("unknown"),
        })
        .default({
          affected_system: "",
          environment: "",
          timestamp: "",
          after_hours: false,
          cloud_provider: "unknown",
        }),
    
      screenshot_attachment: z
        .object({
          file_name: z.string().default(""),
          file_type: z.string().default(""),
          attached: z.boolean().default(false),
        })
        .default({
          file_name: "",
          file_type: "",
          attached: false,
        }),
    
      confidence: z
        .object({
          routing: z.number().optional(),
          ticketing_system: z.number().optional(),
          cloud_provider: z.number().optional(),
          severity: z.number().optional(),
          resolution: z.number().optional(),
        })
        .optional(),
    
      decision_log: z
        .array(
          z.object({
            step: z.string(),
            reason: z.string(),
            value: z.string().optional(),
            confidence: z.number().optional(),
            timestamp: z.string().optional(),
          }),
        )
        .optional(),
    }),  // closes ticket_draft
    
    }),  // closes support_workflow
    
    jira_ticket: z
      .object({
        attempted: z.boolean(),
        created: z.boolean(),
        key: z.string().optional().default(""),
        url: z.string().optional().default(""),
        error: z.string().optional().default(""),
      })
      .optional(),
    });

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[^\x00-\x7F]/g, "");
}

const debugMessage = (msg: string, data: any = {}) => {
  console.log(msg, data);
  const timestamp = new Date().toISOString().replace(/[^\x20-\x7E]/g, "");
  const safeData = JSON.parse(JSON.stringify(data));
  return JSON.stringify({ msg, data: safeData, timestamp });
};

const logTimestamp = (label: string, start: number) => {
  const timestamp = new Date().toISOString();
  const time = ((performance.now() - start) / 1000).toFixed(2);
  console.log(`⏱️ [${timestamp}] ${label}: ${time}s`);
};

function cleanJsonResponse(text: string) {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function sanitizeAndParseJSON(jsonString: string) {
  const cleaned = cleanJsonResponse(jsonString);

  try {
    return JSON.parse(cleaned);
  } catch {
    const sanitized = cleaned.replace(
      /(?<=:\s*")(.|\n)*?(?=")/g,
      (match) => match.replace(/\n/g, "\\n"),
    );
    return JSON.parse(sanitized);
  }
}

function getEasternHourAndWindow() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hour12: false,
  });

  const hour = Number(formatter.format(new Date()));
  const afterHours = hour >= 17 || hour < 9;

  return {
    hour,
    afterHours,
    businessHours: !afterHours,
  };
}

function extractAssistantText(content: string): string {
  try {
    const parsed = JSON.parse(content);
    if (parsed?.response && typeof parsed.response === "string") {
      return parsed.response;
    }
    return content;
  } catch {
    return content;
  }
}

function normalizeMessagesForModel(messages: any[]) {
  return messages
    .filter((msg) => msg?.role === "user" || msg?.role === "assistant")
    .map((msg) => ({
      role: msg.role,
      content:
        msg.role === "assistant"
          ? extractAssistantText(String(msg.content || ""))
          : String(msg.content || ""),
    }));
}

function determineTicketingSystem(ticketDraft: any) {
  const summary = String(ticketDraft?.summary || "").toLowerCase();
  const description = String(ticketDraft?.description || "").toLowerCase();
  const category = String(ticketDraft?.category || "").toLowerCase();
  const subcategory = String(ticketDraft?.subcategory || "").toLowerCase();
  const assignmentGroup = String(
    ticketDraft?.assignment_group || "",
  ).toLowerCase();

  const combinedText = [
    summary,
    description,
    category,
    subcategory,
    assignmentGroup,
  ].join(" ");

  if (
    assignmentGroup.includes("cloudops") ||
    assignmentGroup.includes("security") ||
    assignmentGroup.includes("data") ||
    category.includes("infrastructure") ||
    subcategory.includes("cloudops") ||
    subcategory.includes("incident")
  ) {
    return "jira";
  }

  if (
    assignmentGroup.includes("iam") ||
    category.includes("access") ||
    subcategory.includes("login")
  ) {
    return "servicenow";
  }

  if (
    combinedText.includes("billing") ||
    combinedText.includes("subscription") ||
    combinedText.includes("refund") ||
    combinedText.includes("invoice") ||
    combinedText.includes("product support") ||
    combinedText.includes("external user") ||
    combinedText.includes("customer support")
  ) {
    return "zendesk";
  }

  if (
    combinedText.includes("login") ||
    combinedText.includes("password") ||
    combinedText.includes("mfa") ||
    combinedText.includes("employee") ||
    combinedText.includes("laptop") ||
    combinedText.includes("onboarding") ||
    combinedText.includes("service desk")
  ) {
    return "servicenow";
  }

  return "jira";
}

function buildMockResponse(latestMessage: string, afterHours: boolean) {
  const normalized = latestMessage.toLowerCase();

  // ✅ ADD THIS BLOCK HERE (FIRST!)
  if (
    normalized.includes("production is down") ||
    normalized.includes("prod is down") ||
    normalized.includes("service is down") ||
    normalized.includes("portal is down") ||
    normalized.includes("outage") ||
    normalized.includes("deployment") ||
    normalized.includes("ecs") ||
    normalized.includes("eks") ||
    normalized.includes("aws") ||
    normalized.includes("cloudfront") ||
    normalized.includes("load balancer") ||
    normalized.includes("customers cannot access the portal") ||
    normalized.includes("cannot access the portal")
  ) {
    return {
      id: crypto.randomUUID(),
      response: `🚨 This looks like a production outage affecting customers.
    
    Let’s prioritize immediate triage:
    
    1. Check ECS service health in the AWS Console (desired vs running tasks).
    2. Review recent deployment changes (task definition, image, env vars).
    3. Check CloudWatch logs for errors or crashes.
    4. Verify ALB target group health and health check failures.
    5. Roll back to the previous working task definition if needed.
    
    Since this impacts customers, I would create a **high-priority incident ticket** and notify CloudOps immediately.
    
    Can you confirm:
    - Which environment (prod/stage)?
    - Any recent deployment changes?
    - Are all services impacted or just one?`,
      thinking: "Detected production outage / ECS issue — route to CloudOps",
      user_mood: "frustrated",
      suggested_questions: [
        "We just deployed a new version",
        "ALB health checks are failing",
        "Rollback did not fix it",
      ],
      debug: {
        context_used: false,
        after_hours: afterHours,
      },
      matched_categories: ["infrastructure", "incident-support"],
      redirect_to_agent: {
        should_redirect: false,
        reason: "",
      },
      support_workflow: {
        intent: "issue",
        issue_type: "production_outage",
        ticketing_system: "jira",
        cloud_provider: "aws",
        target_system: "jira",
        action_type: "create_ticket",
        after_hours: afterHours,
        business_hours: !afterHours,
        needs_follow_up: false,
        follow_up_questions: [],
        troubleshooting_steps: [
          "Check ECS service health",
          "Review recent deployment changes",
          "Check CloudWatch logs",
          "Verify ALB target health",
          "Rollback if necessary",
        ],
        attempted_resolution: false,
        resolution_status: "unresolved",
        should_create_ticket: true,
        escalation_reason: "Production system is down affecting customers",
        ticket_draft: {
          summary: "[URGENT] Production ECS service down after deployment",
          description:
            "Production ECS service is down after deployment. Customers cannot access the portal. Initial triage steps suggested: ECS health check, logs, ALB verification, rollback.",
          priority: "Critical",
          issue_type: "Incident",
          labels: ["incident", "production", "ecs", "aws", "urgent"],
          assignment_group: "CloudOps Team",
          assignment_reason: "Production outage in AWS ECS",
          category: "infrastructure",
          subcategory: "cloudops",
          contact: {
            name: "",
            email: "",
            phone: "",
          },
          error_condition: "service unavailable",
          error_description: "Customers cannot access portal after deployment",
          metadata: {
            affected_system: "AWS ECS",
            environment: "prod",
            timestamp: new Date().toISOString(),
            after_hours: afterHours,
            cloud_provider: "aws",
          },
          screenshot_attachment: {
            file_name: "",
            file_type: "",
            attached: false,
          },
        },
      },
      jira_ticket: {
        attempted: false,
        created: false,
        key: "",
        url: "",
        error: "",
      },
    };
  }

  // 👇 EXISTING LOGIN BLOCK (KEEP THIS BELOW)
  if (
    normalized.includes("password") ||
    normalized.includes("login") ||
    normalized.includes("log in") ||
    normalized.includes("sign in") ||
    normalized.includes("mfa") ||
    normalized.includes("account locked")
  ) {
    return {
      id: crypto.randomUUID(),
      response: `I can help with that.

1. Please confirm which application or system you are trying to access.
2. Make sure Caps Lock is off and re-enter your username and password manually.
3. If a password reset option is available, try resetting your password and then sign in again.
4. If you already tried that and still cannot log in, reply with **"still not working"** and I’ll prepare a support ticket for follow-up.

Please let me know whether the reset/login steps worked.`,
      thinking: "Mock response for password or access troubleshooting.",
      user_mood: "frustrated" as const,
      suggested_questions: [
        "I reset it and it still does not work",
        "This is for VPN access",
        "I am locked out of my account",
      ],
      debug: {
        context_used: false,
        after_hours: afterHours,
      },
      matched_categories: ["access-management"],
      redirect_to_agent: {
        should_redirect: false,
        reason: "",
      },
      support_workflow: {
        intent: "troubleshooting" as const,
        issue_type: "password_reset",
        ticketing_system: "jira",
        after_hours: afterHours,
        business_hours: !afterHours,
        needs_follow_up: true,
        follow_up_questions: [
          "Which application or system are you trying to access?",
          "Did you already try resetting the password?",
        ],
        troubleshooting_steps: [
          "Confirm the affected application or system.",
          "Check for simple credential entry issues such as Caps Lock.",
          "Attempt a password reset if available.",
          "Try signing in again after the reset.",
        ],
        attempted_resolution: false,
        resolution_status: "needs_more_info" as const,
        should_create_ticket: false,
        escalation_reason: "",
        ticket_draft: {
          summary: "User unable to access system after password/login issue",
          description:
            "User reported a password or login issue. Guided troubleshooting was provided, including credential verification and password reset steps. Awaiting confirmation on whether access was restored.",
          priority: "Medium",
          issue_type: "Support",
          labels: ["after-hours", "support-agent", "access"],
          assignment_group: "IAM Team",
          assignment_reason: "Detected password/login issue.",
          category: "access",
          subcategory: "login",
          contact: {
            name: "",
            email: "",
            phone: "",
          },
          error_condition: "login failure",
          error_description: "User reports password/login is not working.",
          metadata: {
            affected_system: "",
            environment: "",
            timestamp: new Date().toISOString(),
            after_hours: afterHours,
          },
          screenshot_attachment: {
            file_name: "",
            file_type: "",
            attached: false,
          },
        },
      },
      jira_ticket: {
        attempted: false,
        created: false,
        key: "",
        url: "",
        error: "",
      },
    };
  }

  if (
    normalized.includes("still not working") ||
    normalized.includes("didn't work") ||
    normalized.includes("did not work") ||
    normalized.includes("not fixed") ||
    normalized.includes("unresolved")
  ) {
    return {
      id: crypto.randomUUID(),
      response: `Thanks for confirming. Since the troubleshooting steps did not resolve the issue, I would create a Jira ticket for follow-up.

**Mock ticket created:** SUP-123

Summary: User still unable to access system after password reset troubleshooting.

A support engineer would review the issue and follow up based on the contact details and affected system.`,
      thinking: "Mock unresolved issue flow with ticket outcome.",
      user_mood: "frustrated" as const,
      suggested_questions: [
        "This is affecting VPN",
        "The affected system is email",
        "What details will go in the ticket?",
      ],
      debug: {
        context_used: false,
        after_hours: afterHours,
      },
      matched_categories: ["access-management", "incident-support"],
      redirect_to_agent: {
        should_redirect: false,
        reason: "",
      },
      support_workflow: {
        intent: "ticket_request" as const,
        issue_type: "password_reset",
        ticketing_system: "jira",
        after_hours: afterHours,
        business_hours: !afterHours,
        needs_follow_up: false,
        follow_up_questions: [],
        troubleshooting_steps: [
          "Confirmed user attempted the recommended reset/login steps.",
          "Issue remains unresolved.",
        ],
        attempted_resolution: true,
        resolution_status: "unresolved" as const,
        should_create_ticket: true,
        escalation_reason:
          "User confirmed issue remains unresolved after guided troubleshooting.",
        ticket_draft: {
          summary: "User unable to access system after reset attempt",
          description:
            "User reported a password/login issue. Guided troubleshooting was provided, including reset and retry steps. User confirmed the issue remains unresolved. Follow-up required.",
          priority: "High",
          issue_type: "Support",
          labels: ["after-hours", "support-agent", "access", "unresolved"],
          contact: {
            name: "",
            email: "",
            phone: "",
          },
          error_condition: "login failure after reset attempt",
          error_description:
            "User still cannot access the system after trying the recommended reset/login steps.",
          metadata: {
            affected_system: "",
            environment: "",
            timestamp: new Date().toISOString(),
            after_hours: afterHours,
          },
          screenshot_attachment: {
            file_name: "",
            file_type: "",
            attached: false,
          },
        },
      },
      jira_ticket: {
        attempted: true,
        created: true,
        key: "SUP-123",
        url: "",
        error: "",
      },
    };
  }

  if (normalized.includes("vpn")) {
    return {
      id: crypto.randomUUID(),
      response: `I can help troubleshoot VPN access.

1. Confirm whether you are receiving an invalid credentials error or a connection error.
2. If it is a credentials error, try resetting your password first.
3. If it is a connection error, disconnect and reconnect to the VPN client.
4. If the issue continues after both checks, reply with **"still not working"** and I’ll move toward a support ticket.

What error are you seeing right now?`,
      thinking: "Mock VPN troubleshooting response.",
      user_mood: "neutral" as const,
      suggested_questions: [
        "It says invalid credentials",
        "It says connection failed",
        "Still not working",
      ],
      debug: {
        context_used: false,
        after_hours: afterHours,
      },
      matched_categories: ["remote-access"],
      redirect_to_agent: {
        should_redirect: false,
        reason: "",
      },
      support_workflow: {
        intent: "troubleshooting" as const,
        issue_type: "vpn_access",
        ticketing_system: "jira",
        after_hours: afterHours,
        business_hours: !afterHours,
        needs_follow_up: true,
        follow_up_questions: [
          "Are you seeing a credentials error or connection error?",
        ],
        troubleshooting_steps: [
          "Identify whether the error is authentication-related or connectivity-related.",
          "If authentication-related, try password reset.",
          "If connectivity-related, reconnect the VPN client.",
        ],
        attempted_resolution: false,
        resolution_status: "needs_more_info" as const,
        should_create_ticket: false,
        escalation_reason: "",
        ticket_draft: {
          summary: "User unable to access VPN",
          description:
            "User reported VPN access issues. Guided troubleshooting was initiated and more information is being collected.",
          priority: "Medium",
          issue_type: "Support",
          labels: ["after-hours", "support-agent", "vpn"],
          contact: {
            name: "",
            email: "",
            phone: "",
          },
          error_condition: "vpn access failure",
          error_description: "User reports they cannot connect to VPN.",
          metadata: {
            affected_system: "VPN",
            environment: "",
            timestamp: new Date().toISOString(),
            after_hours: afterHours,
          },
          screenshot_attachment: {
            file_name: "",
            file_type: "",
            attached: false,
          },
        },
      },
      jira_ticket: {
        attempted: false,
        created: false,
        key: "",
        url: "",
        error: "",
      },
    };
  }

  return {
    id: crypto.randomUUID(),
    response: `I can help with after-hours support.

Please describe:
1. what system or application is affected
2. what error or issue you are seeing
3. whether you already tried any troubleshooting steps

If the issue cannot be resolved through guided troubleshooting, I can move toward creating a support ticket.`,
    thinking: "Generic mock support response.",
    user_mood: "neutral" as const,
    suggested_questions: [
      "My password does not work",
      "I cannot access VPN",
      "I still need a ticket created",
    ],
    debug: {
      context_used: false,
      after_hours: afterHours,
    },
    matched_categories: ["general-support"],
    redirect_to_agent: {
      should_redirect: false,
      reason: "",
    },
    support_workflow: {
      intent: "issue" as const,
      issue_type: "general_support",
      ticketing_system: "jira",
      after_hours: afterHours,
      business_hours: !afterHours,
      needs_follow_up: true,
      follow_up_questions: [
        "Which system or application is affected?",
        "What exactly is failing?",
        "What have you already tried?",
      ],
      troubleshooting_steps: [],
      attempted_resolution: false,
      resolution_status: "needs_more_info" as const,
      should_create_ticket: false,
      escalation_reason: "",
      ticket_draft: {
        summary: "General after-hours support issue",
        description:
          "User reported a general support issue. Additional details are needed before troubleshooting or ticket creation.",
        priority: "Medium",
        issue_type: "Support",
        labels: ["after-hours", "support-agent"],
        assignment_group: "General Support",
        assignment_reason: "",
        category: "general",
        subcategory: "general",
        contact: {
          name: "",
          email: "",
          phone: "",
        },
        error_condition: "",
        error_description: "",
        metadata: {
          affected_system: "",
          environment: "",
          timestamp: new Date().toISOString(),
          after_hours: afterHours,
        },
        screenshot_attachment: {
          file_name: "",
          file_type: "",
          attached: false,
        },
      },
    },
    jira_ticket: {
      attempted: false,
      created: false,
      key: "",
      url: "",
      error: "",
    },
  };
}

export async function POST(req: Request) {
  console.log("API KEY EXISTS:", !!process.env.OPENAI_API_KEY);
  const apiStart = performance.now();
  const measureTime = (label: string) => logTimestamp(label, apiStart);

  const {
    messages = [],
    model,
    knowledgeBaseId,
    screenshot,
    screenshot_file,
  } = await req.json();
  const latestMessage = messages?.[messages.length - 1]?.content || "";

  console.log("LATEST MESSAGE RECEIVED:", latestMessage);

  if (!latestMessage) {
    return new Response(
      JSON.stringify({
        response: "Please enter a message.",
        thinking: "No user message was provided.",
        user_mood: "neutral",
        suggested_questions: [
          "What issue are you running into?",
          "Which system or application is affected?",
          "Would you like troubleshooting help before a ticket is created?",
        ],
        debug: { context_used: false, after_hours: false },
        matched_categories: [],
        redirect_to_agent: {
          should_redirect: false,
          reason: "",
        },
        support_workflow: {
          intent: "other",
          issue_type: "general",
          ticketing_system: "jira",
          after_hours: false,
          business_hours: true,
          needs_follow_up: true,
          follow_up_questions: ["Please describe the issue you need help with."],
          troubleshooting_steps: [],
          attempted_resolution: false,
          resolution_status: "needs_more_info",
          should_create_ticket: false,
          escalation_reason: "",
          ticket_draft: {
            summary: "",
            description: "",
            priority: "Medium",
            issue_type: "Support",
            labels: [],
            contact: {
              name: "",
              email: "",
              phone: "",
            },
            error_condition: "",
            error_description: "",
            metadata: {
              affected_system: "",
              environment: "",
              timestamp: "",
              after_hours: false,
            },
            screenshot_attachment: {
              file_name: "",
              file_type: "",
              attached: false,
            },
          },
        },
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  console.log("📝 Latest Query:", latestMessage);
  measureTime("User Input Received");

  const { afterHours, businessHours, hour } = getEasternHourAndWindow();

  const mockMode = process.env.MOCK_SUPPORT_AGENT === "true";

  if (mockMode) {
    return new Response(
      JSON.stringify(buildMockResponse(latestMessage, afterHours)),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const MAX_DEBUG_LENGTH = 1000;
  const debugData = sanitizeHeaderValue(
    debugMessage("🚀 API route called", {
      messagesReceived: messages?.length || 0,
      latestMessageLength: latestMessage.length,
      openaiKeyPresent: !!process.env.OPENAI_API_KEY,
      easternHour: hour,
      afterHours,
    }),
  ).slice(0, MAX_DEBUG_LENGTH);

  let retrievedContext = "";
  let isRagWorking = false;
  let ragSources: RAGSource[] = [];

  try {
    console.log("🔍 Initiating RAG retrieval for query:", latestMessage);
    measureTime("RAG Start");

    const result = await retrieveContext(latestMessage, knowledgeBaseId);
    retrievedContext = result.context;
    isRagWorking = result.isRagWorking;
    ragSources = result.ragSources || [];

    if (!result.isRagWorking) {
      console.warn("🚨 RAG Retrieval failed but did not throw!");
    }

    measureTime("RAG Complete");
    console.log("🔍 RAG Retrieved:", isRagWorking ? "YES" : "NO");
  } catch (error) {
    console.error("💀 RAG Error:", error);
    retrievedContext = "";
    isRagWorking = false;
    ragSources = [];
  }

  measureTime("RAG Total Duration");

  const USE_CATEGORIES = true;
  const categoryListString = customerSupportCategories.categories
    .map((c) => c.id)
    .join(", ");

  const categoriesContext = USE_CATEGORIES
    ? `
To help with internal classification, match the inquiry to any relevant category IDs.
Available category IDs: ${categoryListString}
Return multiple IDs if needed, or [] if none match.
`
    : "";

  const systemPrompt = `You are the Fortellar After-Hours Support Assistant.

You help users with support issues, troubleshooting, and ticket intake.
You should behave like a Tier 1 support assistant:
- troubleshoot first
- ask follow-up questions when key details are missing
- confirm whether the issue is resolved
- create or recommend a Jira ticket only when the issue remains unresolved, needs escalation, or clearly requires human follow-up

Time window context:
- Current support window is based on Eastern Time.
- After-hours is 5:00 PM through 9:00 AM EST/ET.
- Right now, after_hours = ${afterHours}.
- Right now, business_hours = ${businessHours}.

Important operating rules:
- During after-hours, prioritize guided troubleshooting and create a Jira ticket when unresolved.
- During business hours, you may still troubleshoot and may still create a Jira ticket when needed.
- For common issues like password/login/access problems, guide the user step by step.
- If the user has not yet tried the most likely safe troubleshooting steps, do NOT jump straight to a ticket.
- If the issue appears resolved, do not create a ticket.
- If details are missing, ask concise follow-up questions.
- When a ticket is needed, prepare a concise Jira-ready summary and description.
- Include any troubleshooting already attempted in the ticket description.
- If the issue is unresolved and should_create_ticket = true, you must collect contact information before finalizing ticket creation whenever it is missing:
  - name
  - email
  - phone number
- If any contact fields are missing, ask for them explicitly in follow_up_questions.
- Do not assume contact information unless the user provided it.
- Capture the error condition when available (for example: invalid credentials, timeout, access denied, VPN connection failed).
- Capture a short but useful error description in plain language.
- Populate metadata when available, including:
  - affected system/application
  - environment
  - timestamp
  - after-hours status
- If a screenshot is mentioned or attached, note that in the ticket draft.
- If screenshot metadata is provided in the request, populate:
  - screenshot_attachment.file_name
  - screenshot_attachment.file_type
  - screenshot_attachment.attached = true
- If required ticket fields are missing, ask follow-up questions before moving to escalation.
- If should_create_ticket is true and any contact information is missing (name, email, or phone), you must ask for it in follow_up_questions.
- Do not proceed as if the ticket is complete until contact information is collected.
- Production outages, deployment failures, ALB 502/503/504 errors, and customer-facing service downtime should be treated as Critical infrastructure incidents unless the user clearly indicates otherwise.
- Be practical, concise, and support-oriented.

Knowledge usage rules:
- Use the knowledge base content below whenever it is relevant.
- Do not invent Fortellar-specific policies, URLs, internal procedures, or system details that are not in the knowledge base.
- When knowledge base support is weak or missing, you may still give safe, generic Tier 1 troubleshooting guidance for low-risk identity issues such as password reset, MFA, account lockout, or login troubleshooting.
- Do NOT treat generic availability phrases like "cannot access portal", "site is down", "service unavailable", or "customers cannot reach the app" as password/login issues unless the user clearly describes an authentication problem.
- If something requires organization-specific steps that are not in the knowledge base, say so clearly and move toward follow-up questions or ticket creation.

Routing rules:
- When knowledge base support is weak or missing, you may still give safe, generic Tier 1 troubleshooting guidance for low-risk identity issues such as password reset, MFA, account lockout, or login troubleshooting.
- Route login, password, MFA, account lockout, and explicit authentication/identity issues to IAM Team
- Route "portal down", "site unavailable", "customers cannot reach app", deployment failures, ECS/EKS/Lambda/API outages, AWS/Azure/GCP platform issues, and production availability incidents to CloudOps Team
- Route infrastructure, deployment, AWS, cloud, DNS, network, and outage issues to CloudOps Team
- Route phishing, suspicious activity, unauthorized access, malware, breach, and compliance issues to Security Team
- Route reporting, dashboard, ETL, pipeline, warehouse, and data issues to Data Team
- If the issue is unclear, use General Support

When populating ticket_draft, always include:
- assignment_group
- assignment_reason
- category
- subcategory

Knowledge Base:
${isRagWorking ? retrievedContext : "No information available."}

Screenshot Attachment:
${screenshot ? JSON.stringify(screenshot) : "No screenshot attached."}

${categoriesContext}

If the message mentions AWS, ECS, EKS, deployment, outage, production down, portal unavailable, or customers unable to reach the application, classify it as an infrastructure/cloud incident, not a password/login issue.
You must ALWAYS return valid JSON in exactly this shape:
{
  "thinking": "brief internal reasoning",
  "response": "final response to the user in a helpful support tone",
  "user_mood": "positive|neutral|negative|curious|frustrated|confused",
  "suggested_questions": ["...", "..."],
  "debug": {
    "context_used": true,
    "after_hours": ${afterHours}
  },
  "matched_categories": ["category_id1"],
  "redirect_to_agent": {
    "should_redirect": false,
    "reason": ""
  },
  "support_workflow": {
    "intent": "question|issue|troubleshooting|ticket_request|other",
    "issue_type": "short issue type like password_reset, login_issue, vpn_access, billing_question",
    "ticketing_system": "jira|servicenow|zendesk",
    "after_hours": ${afterHours},
    "business_hours": ${businessHours},
    "needs_follow_up": true,
    "follow_up_questions": ["..."],
    "troubleshooting_steps": ["step 1", "step 2"],
    "attempted_resolution": true,
    "resolution_status": "resolved|unresolved|needs_more_info|unknown",
    "should_create_ticket": false,
    "escalation_reason": "",
    "ticket_draft": {
      "summary": "short Jira summary",
      "description": "detailed Jira description including issue details and attempted troubleshooting",
      "priority": "Low|Medium|High|Critical",
      "issue_type": "Support",
      "labels": ["after-hours", "support-agent"],
      "assignment_group": "IAM Team|CloudOps Team|Security Team|Data Team|General Support",
      "assignment_reason": "short explanation of why the issue was routed there",
      "category": "access|infrastructure|security|data|general",
      "subcategory": "login|cloudops|incident|pipeline|general",
      "contact": {
        "name": "caller name if known",
        "email": "caller email if known",
        "phone": "caller phone if known"
      },
      "error_condition": "short condition like invalid credentials, timeout, access denied",
      "error_description": "plain language description of the error",
      "metadata": {
        "affected_system": "system or application name",
        "environment": "prod|uat|stage|dev or other value if known",
        "timestamp": "ISO timestamp if known",
        "after_hours": ${afterHours},
        "cloud_provider": "aws|azure|gcp|unknown"
      },
        "screenshot_attachment": {
        "file_name": "screenshot filename if provided",
        "file_type": "image/png or image/jpeg if provided",
        "attached": false
      }
    }
  }
}

Choose a ticketing_system for the issue:
- Use "jira" for engineering, cloud, infrastructure, security engineering, and data incidents.
- Use "servicenow" for internal ITSM, login, MFA, onboarding, employee access, and laptop issues.
- Use "zendesk" for customer support, billing, external user issues, and product support.
- If the issue mentions AWS, Azure, GCP, ECS, EKS, Azure AD, Entra, GKE, Cloud Run, BigQuery, or similar, populate ticket_draft.metadata.cloud_provider accordingly.

Always include support_workflow.ticketing_system.
If the issue mentions AWS, Azure, GCP, EC2, EKS, Azure AD, Entra, GKE, Cloud Run, S3, BigQuery, or similar cloud services, populate ticket_draft.metadata.cloud_provider accordingly.

Response style rules:
- Keep the response clear and actionable.
- For troubleshooting, use short numbered steps.
- If you need follow-up details, ask for them directly.
- If a ticket is being created or should be created, say that clearly in the response.
- Never include markdown code fences around the JSON.
`;

  try {
    console.log("🚀 Query Processing");
    measureTime("OpenAI Generation Start");

    const modelMessages = normalizeMessagesForModel(messages);

    const openAiResponse = await fetch(
      "https://fortellar.openai.azure.com/openai/deployments/gpt-4o-mini/chat/completions?api-version=2025-01-01-preview",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          max_tokens: 1400,
          temperature: 0.2,
          response_format: {
            type: "json_object",
          },
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            ...modelMessages,
          ],
        }),
      },
    );
    
    measureTime("OpenAI Generation Complete");
    
    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text();
      throw new Error(`OpenAI API error: ${errorText}`);
    }
    
    const openAiData = await openAiResponse.json();
    
    const textContent = String(openAiData?.choices?.[0]?.message?.content || "")
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "");
    
    let parsedResponse;
    try {
      parsedResponse = sanitizeAndParseJSON(textContent);
    } catch (parseError) {
      console.error("Error parsing JSON response:", parseError);
      throw new Error("Invalid JSON response from AI");
    }
    
    const validatedResponse = responseSchema.parse(parsedResponse);
    if (screenshot_file?.file_name) {
      validatedResponse.support_workflow.ticket_draft.screenshot_attachment = {
        file_name: screenshot_file.file_name,
        file_type: screenshot_file.file_type || "",
        attached: true,
      };
    }
    const latestMessageLower = latestMessage.toLowerCase();

    const isUrgent =
      validatedResponse.support_workflow.ticket_draft.priority === "Critical" ||
      validatedResponse.support_workflow.escalation_reason
        ?.toLowerCase()
        .includes("urgent") ||
      latestMessageLower.includes("urgent") ||
      latestMessageLower.includes("asap") ||
      latestMessageLower.includes("production is down") ||
      latestMessageLower.includes("critical");

    const looksLikeProductionOutage =
      latestMessageLower.includes("production is down") ||
      latestMessageLower.includes("prod is down") ||
      latestMessageLower.includes("service is down") ||
      latestMessageLower.includes("portal is down") ||
      latestMessageLower.includes("outage") ||
      latestMessageLower.includes("ecs") ||
      latestMessageLower.includes("eks") ||
      latestMessageLower.includes("aws") ||
      latestMessageLower.includes("502") ||
      latestMessageLower.includes("503") ||
      latestMessageLower.includes("504") ||
      latestMessageLower.includes("bad gateway");
    
    if (looksLikeProductionOutage) {
      validatedResponse.support_workflow.ticket_draft.priority = "Critical";
    }
    
    if (isUrgent) {
      const currentSummary =
        validatedResponse.support_workflow.ticket_draft.summary || "";
    
      // Add [URGENT] prefix
      if (!currentSummary.startsWith("[URGENT]")) {
        validatedResponse.support_workflow.ticket_draft.summary =
          `[URGENT] ${currentSummary}`;
      }
    
      // Add urgent label
      validatedResponse.support_workflow.ticket_draft.labels = Array.from(
        new Set([
          ...(validatedResponse.support_workflow.ticket_draft.labels || []),
          "urgent",
        ]),
      );
    }
    const fallbackRouting = determineAssignmentGroup(
      validatedResponse.support_workflow.ticket_draft,
    );
    
    const looksLikeIAMIssue =
      latestMessageLower.includes("azure ad") ||
      latestMessageLower.includes("entra") ||
      latestMessageLower.includes("mfa") ||
      latestMessageLower.includes("login") ||
      latestMessageLower.includes("log in") ||
      latestMessageLower.includes("sign in") ||
      latestMessageLower.includes("employee") ||
      latestMessageLower.includes("laptop") ||
      latestMessageLower.includes("password") ||
      latestMessageLower.includes("account locked");
    
    if (looksLikeIAMIssue) {
      validatedResponse.support_workflow.ticket_draft.assignment_group = "IAM Team";
      validatedResponse.support_workflow.ticket_draft.assignment_reason =
        "Detected Azure AD, Entra, MFA, employee login, or identity-related issue.";
      validatedResponse.support_workflow.ticket_draft.category = "access";
      validatedResponse.support_workflow.ticket_draft.subcategory = "login";
    } else {
      validatedResponse.support_workflow.ticket_draft.assignment_group =
        validatedResponse.support_workflow.ticket_draft.assignment_group ||
        fallbackRouting.assignment_group;
    
      validatedResponse.support_workflow.ticket_draft.assignment_reason =
        validatedResponse.support_workflow.ticket_draft.assignment_reason ||
        fallbackRouting.assignment_reason;
    
      validatedResponse.support_workflow.ticket_draft.category =
        validatedResponse.support_workflow.ticket_draft.category ||
        fallbackRouting.category;
    
      validatedResponse.support_workflow.ticket_draft.subcategory =
        validatedResponse.support_workflow.ticket_draft.subcategory ||
        fallbackRouting.subcategory;
    }
    
    validatedResponse.support_workflow.ticket_draft.metadata = {
      ...(validatedResponse.support_workflow.ticket_draft.metadata || {}),
      timestamp: new Date().toISOString(),
      cloud_provider:
        validatedResponse.support_workflow.ticket_draft.metadata?.cloud_provider ||
        determineCloudProvider(validatedResponse.support_workflow.ticket_draft),
    };

    const severityInfo = determineSeverity(
      validatedResponse.support_workflow.ticket_draft,
    );
    
    validatedResponse.support_workflow.ticket_draft.severity = severityInfo.severity;
    validatedResponse.support_workflow.ticket_draft.impact = severityInfo.impact;
    validatedResponse.support_workflow.ticket_draft.urgency = severityInfo.urgency;
    
    validatedResponse.support_workflow.ticket_draft.confidence = {
      ...(validatedResponse.support_workflow.ticket_draft.confidence || {}),
      routing: getRoutingConfidence(validatedResponse.support_workflow.ticket_draft),
      cloud_provider: getCloudConfidence(
        validatedResponse.support_workflow.ticket_draft.metadata?.cloud_provider || "unknown",
      ),
      severity: getSeverityConfidence(severityInfo.severity),
    };
    
    const detectedCloudProvider =
      validatedResponse.support_workflow.ticket_draft.metadata?.cloud_provider ||
      "unknown";
    
    validatedResponse.support_workflow.ticket_draft.labels = Array.from(
      new Set([
        ...(validatedResponse.support_workflow.ticket_draft.labels || []),
        validatedResponse.support_workflow.ticket_draft.assignment_group
          .toLowerCase()
          .replace(/\s+/g, "-"),
        validatedResponse.support_workflow.ticket_draft.category
          .toLowerCase()
          .replace(/\s+/g, "-"),
        validatedResponse.support_workflow.ticket_draft.subcategory
          .toLowerCase()
          .replace(/\s+/g, "-"),
        `cloud-${detectedCloudProvider}`,
      ]),
    );

    console.log("SUPPORT WORKFLOW DEBUG:", validatedResponse.support_workflow);
    const contact = validatedResponse.support_workflow.ticket_draft.contact || {};

    const missingContactInfo =
      !contact.name?.trim() ||
      !contact.email?.trim() ||
      !contact.phone?.trim();
    
    // Determine ticketing system
    const ticketingSystem =
      validatedResponse.support_workflow.ticketing_system ||
      determineTicketingSystem(validatedResponse.support_workflow.ticket_draft);
    
    validatedResponse.support_workflow.ticketing_system = ticketingSystem;
    
    // Evaluate workflow decisions
    const workflowDecision = evaluateWorkflow(
      validatedResponse.support_workflow.ticket_draft,
    );
    
    validatedResponse.support_workflow.should_create_ticket =
      workflowDecision.should_create_ticket;
    
    validatedResponse.support_workflow.needs_follow_up =
      workflowDecision.should_ask_follow_up;
    
    if (
      workflowDecision.should_ask_follow_up ||
      (validatedResponse.support_workflow.should_create_ticket && missingContactInfo)
    ) {
      validatedResponse.support_workflow.needs_follow_up = true;
      validatedResponse.support_workflow.follow_up_questions = [
        "What is your name?",
        "What is your email address?",
        "What is your phone number?",
      ];
      validatedResponse.support_workflow.should_create_ticket = false;
    }
    
    let externalTicket = {
      attempted: false,
      created: false,
      key: "",
      url: "",
      error: "",
    };
    
    if (validatedResponse.support_workflow.should_create_ticket) {
      externalTicket = await createExternalTicket(
        validatedResponse.support_workflow.ticketing_system,
        validatedResponse.support_workflow.ticket_draft,
        screenshot_file,
      );
    }
    
    validatedResponse.support_workflow.ticketing_system = ticketingSystem;

    validatedResponse.support_workflow.ticket_draft.confidence = {
      ...(validatedResponse.support_workflow.ticket_draft.confidence || {}),
      ticketing_system: getTicketingSystemConfidence(
        validatedResponse.support_workflow.ticketing_system as any,
      ),
    };

    validatedResponse.support_workflow.ticket_draft.decision_log = addDecisionLog(
      validatedResponse.support_workflow.ticket_draft.decision_log,
      "routing",
      validatedResponse.support_workflow.ticket_draft.assignment_reason || "Fallback routing applied",
      validatedResponse.support_workflow.ticket_draft.assignment_group,
      validatedResponse.support_workflow.ticket_draft.confidence?.routing,
    );

    validatedResponse.support_workflow.ticket_draft.decision_log = addDecisionLog(
      validatedResponse.support_workflow.ticket_draft.decision_log,
      "cloud_detection",
      "Detected cloud provider from issue text and metadata",
      validatedResponse.support_workflow.ticket_draft.metadata?.cloud_provider,
      validatedResponse.support_workflow.ticket_draft.confidence?.cloud_provider,
    );

    validatedResponse.support_workflow.ticket_draft.decision_log = addDecisionLog(
      validatedResponse.support_workflow.ticket_draft.decision_log,
      "ticketing_system",
      "Selected external system based on routing, category, and support context",
      validatedResponse.support_workflow.ticketing_system,
      validatedResponse.support_workflow.ticket_draft.confidence?.ticketing_system,
    );

    validatedResponse.support_workflow.ticket_draft.decision_log = addDecisionLog(
      validatedResponse.support_workflow.ticket_draft.decision_log,
      "severity",
      "Calculated business severity and urgency from issue language",
      validatedResponse.support_workflow.ticket_draft.severity,
      validatedResponse.support_workflow.ticket_draft.confidence?.severity,
    );
        
    console.log(
      "SELECTED TICKETING SYSTEM:",
      validatedResponse.support_workflow.ticketing_system,
    );
    
    if (
      validatedResponse.support_workflow.should_create_ticket &&
      validatedResponse.support_workflow.resolution_status !== "resolved" &&
      !missingContactInfo
    ) {
      console.log("ABOUT TO CREATE EXTERNAL TICKET");
      console.log("SCREENSHOT FILE RECEIVED:", {
        hasScreenshotFile: !!screenshot_file,
        fileName: screenshot_file?.file_name || "",
        fileType: screenshot_file?.file_type || "",
      });
    
      externalTicket = await createExternalTicket(
        validatedResponse.support_workflow.ticketing_system,
        validatedResponse.support_workflow.ticket_draft,
        screenshot_file,
      );
    
      if (externalTicket.created) {
        const ticketSystemLabel =
          validatedResponse.support_workflow.ticketing_system === "servicenow"
            ? "Open ServiceNow Ticket"
            : validatedResponse.support_workflow.ticketing_system === "zendesk"
            ? "Open Zendesk Ticket"
            : "Open Jira Ticket";
      
        validatedResponse.response = [
          `**Ticket ID:** ${externalTicket.key}`,
          `**Link:** [${ticketSystemLabel}](${externalTicket.url})`,
          ``,
          `**Routed to:** ${validatedResponse.support_workflow.ticket_draft.assignment_group}`,
          `**Priority:** ${validatedResponse.support_workflow.ticket_draft.priority}`,
          `**Ticketing System:** ${validatedResponse.support_workflow.ticketing_system}`,
          `**Cloud Provider:** ${validatedResponse.support_workflow.ticket_draft.metadata?.cloud_provider || "unknown"}`,
          ``,
          `Our team has been notified and is investigating.`,
        ].join("\n");
      
        validatedResponse.support_workflow.needs_follow_up = false;
        validatedResponse.support_workflow.follow_up_questions = [];
      }
    
      console.log("EXTERNAL TICKET RESULT:", externalTicket);
    }
    
    validatedResponse.support_workflow.should_create_ticket =
      workflowDecision.should_create_ticket;
    
    validatedResponse.support_workflow.needs_follow_up =
      workflowDecision.should_ask_follow_up;
    
    if (workflowDecision.should_ask_follow_up) {
      validatedResponse.support_workflow.follow_up_questions = [
        "What is your name?",
        "What is your email address?",
        "What is your phone number?",
      ];
    }
    
    const priority =
      validatedResponse.support_workflow.ticket_draft.priority;
    
    const shouldSendTeamsAlert =
      externalTicket.created &&
      (workflowDecision.should_send_alert || priority === "Critical");
    
    console.log("SHOULD SEND TEAMS ALERT:", shouldSendTeamsAlert);
    
    if (shouldSendTeamsAlert) {
      console.log("SENDING TEAMS ALERT...");
      
      validatedResponse.support_workflow.should_create_ticket =
        workflowDecision.should_create_ticket;
      
      validatedResponse.support_workflow.needs_follow_up =
        workflowDecision.should_ask_follow_up;
      
      if (workflowDecision.should_ask_follow_up) {
        validatedResponse.support_workflow.follow_up_questions = [
          "What is your name?",
          "What is your email address?",
          "What is your phone number?",
        ];
      }
      
      const teamsResult = await sendTeamsAlert({
        title: "🚨 Urgent Support Ticket Created",
        summary: validatedResponse.support_workflow.ticket_draft.summary,
        priority: validatedResponse.support_workflow.ticket_draft.priority,
        assignmentGroup:
          validatedResponse.support_workflow.ticket_draft.assignment_group || "General Support",
        jiraKey: externalTicket.key,
        jiraUrl: externalTicket.url,
        reporterName:
          validatedResponse.support_workflow.ticket_draft.contact?.name || "",
        reporterEmail:
          validatedResponse.support_workflow.ticket_draft.contact?.email || "",
        reporterPhone:
          validatedResponse.support_workflow.ticket_draft.contact?.phone || "",
        screenshotAttached:
          validatedResponse.support_workflow.ticket_draft.screenshot_attachment?.attached || false,
      });
    
      console.log("TEAMS ALERT RESULT:", teamsResult);
    }
    
    const responseWithId = {
      id: crypto.randomUUID(),
      ...validatedResponse,
      jira_ticket: externalTicket,
    };
    
    const apiResponse = new Response(JSON.stringify(responseWithId), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
    
    if (ragSources.length > 0) {
      apiResponse.headers.set(
        "x-rag-sources",
        sanitizeHeaderValue(JSON.stringify(ragSources)),
      );
    }
    
    apiResponse.headers.set("X-Debug-Data", sanitizeHeaderValue(debugData));
    
    measureTime("API Complete");
    
    return apiResponse;
    } catch (error: any) {
    console.error("💥 Error in message generation:", error);
    
    const errorMessage =
      error?.message || "Unknown error";
    
    let userMessage =
      "The support assistant is temporarily unavailable right now. Please try again later.";
    let thinkingMessage = "Error occurred during message generation.";
    
    if (
      typeof errorMessage === "string" &&
      errorMessage.toLowerCase().includes("insufficient_quota")
    ) {
      userMessage =
        "The support assistant is temporarily unavailable right now due to an API quota issue. Please try again later.";
      thinkingMessage = "OpenAI API quota issue.";
    } else if (
      typeof errorMessage === "string" &&
      errorMessage.toLowerCase().includes("invalid_api_key")
    ) {
      userMessage =
        "The support assistant is temporarily unavailable due to an authentication issue. Please try again later.";
      thinkingMessage = "OpenAI API key issue.";
    } else if (
      typeof errorMessage === "string" &&
      errorMessage.toLowerCase().includes("openai api error")
    ) {
      userMessage =
        "The support assistant is temporarily unavailable due to an OpenAI service issue. Please try again later.";
      thinkingMessage = "OpenAI API request failed.";
    }
    
    return new Response(
      JSON.stringify({
        response: userMessage,
        thinking: thinkingMessage,
        user_mood: "neutral",
        suggested_questions: [
          "What issue are you running into?",
          "Which system is affected?",
          "Would you like me to help troubleshoot first?",
        ],
        debug: { context_used: false, after_hours: false },
        matched_categories: [],
        redirect_to_agent: {
          should_redirect: true,
          reason: "AI service unavailable",
        },
        support_workflow: {
          intent: "other",
          issue_type: "general",
          ticketing_system: "jira",
          after_hours: false,
          business_hours: true,
          needs_follow_up: true,
          follow_up_questions: [],
          troubleshooting_steps: [],
          attempted_resolution: false,
          resolution_status: "unknown",
          should_create_ticket: false,
          escalation_reason: "AI service unavailable",
          ticket_draft: {
            summary: "",
            description: "",
            priority: "Medium",
            issue_type: "Support",
            labels: [],
            contact: {
              name: "",
              email: "",
              phone: "",
            },
            error_condition: "",
            error_description: "",
            metadata: {
              affected_system: "",
              environment: "",
              timestamp: "",
              after_hours: false,
            },
            screenshot_attachment: {
              file_name: "",
              file_type: "",
              attached: false,
            },
          }
        },
        jira_ticket: {
          attempted: false,
          created: false,
          key: "",
          url: "",
          error: "",
        },
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
