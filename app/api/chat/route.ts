import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { retrieveContext, RAGSource } from "@/app/lib/rag";
import crypto from "crypto";
import customerSupportCategories from "@/app/lib/customer_support_categories.json";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
    }),
  }),
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

async function createJiraTicket(ticketDraft: {
  summary: string;
  description: string;
  priority: string;
  issue_type: string;
  labels: string[];
}) {
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;
  const projectKey = process.env.JIRA_PROJECT_KEY;

  if (!baseUrl || !email || !apiToken || !projectKey) {
    return {
      attempted: false,
      created: false,
      key: "",
      url: "",
      error: "Jira environment variables are not fully configured.",
    };
  }

  try {
    const response = await fetch(`${baseUrl}/rest/api/2/issue`, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${email}:${apiToken}`).toString("base64"),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        fields: {
          project: {
            key: projectKey,
          },
          summary: ticketDraft.summary || "After-hours support issue",
          description:
            ticketDraft.description || "Issue reported through support agent.",
          issuetype: {
            name: ticketDraft.issue_type || "Support",
          },
          priority: {
            name: ticketDraft.priority || "Medium",
          },
          labels: Array.isArray(ticketDraft.labels) ? ticketDraft.labels : [],
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        attempted: true,
        created: false,
        key: "",
        url: "",
        error:
          data?.errors
            ? JSON.stringify(data.errors)
            : data?.errorMessages?.join(", ") || "Unknown Jira error",
      };
    }

    return {
      attempted: true,
      created: true,
      key: data?.key || "",
      url: data?.key ? `${baseUrl}/browse/${data.key}` : "",
      error: "",
    };
  } catch (error: any) {
    return {
      attempted: true,
      created: false,
      key: "",
      url: "",
      error: error?.message || "Failed to create Jira ticket.",
    };
  }
}

export async function POST(req: Request) {
  console.log("API KEY EXISTS:", !!process.env.ANTHROPIC_API_KEY);
  const apiStart = performance.now();
  const measureTime = (label: string) => logTimestamp(label, apiStart);

  const { messages = [], model, knowledgeBaseId } = await req.json();
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

  const MAX_DEBUG_LENGTH = 1000;
  const debugData = sanitizeHeaderValue(
    debugMessage("🚀 API route called", {
      messagesReceived: messages?.length || 0,
      latestMessageLength: latestMessage.length,
      anthropicKeyPresent: !!process.env.ANTHROPIC_API_KEY,
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
- Be practical, concise, and support-oriented.

Knowledge usage rules:
- Use the knowledge base content below whenever it is relevant.
- Do not invent Fortellar-specific policies, URLs, internal procedures, or system details that are not in the knowledge base.
- When knowledge base support is weak or missing, you may still give safe, generic Tier 1 troubleshooting guidance for low-risk issues such as password/login/access troubleshooting.
- If something requires organization-specific steps that are not in the knowledge base, say so clearly and move toward follow-up questions or ticket creation.

Knowledge Base:
${isRagWorking ? retrievedContext : "No information available."}

${categoriesContext}

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
      "labels": ["after-hours", "support-agent"]
    }
  }
}

Response style rules:
- Keep the response clear and actionable.
- For troubleshooting, use short numbered steps.
- If you need follow-up details, ask for them directly.
- If a ticket is being created or should be created, say that clearly in the response.
- Never include markdown code fences around the JSON.
`;

  try {
    console.log("🚀 Query Processing");
    measureTime("Claude Generation Start");

    const anthropicMessages = normalizeMessagesForModel(messages);

    anthropicMessages.push({
      role: "assistant",
      content: "{",
    });

    const response = await anthropic.messages.create({
      model: model || "claude-3-5-haiku-latest",
      max_tokens: 1400,
      messages: anthropicMessages as any,
      system: systemPrompt,
      temperature: 0.2,
    });

    measureTime("Claude Generation Complete");

    const textContent =
      "{" +
      response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block: Anthropic.TextBlock) => block.text)
        .join(" ");

    let parsedResponse;
    try {
      parsedResponse = sanitizeAndParseJSON(textContent);
    } catch (parseError) {
      console.error("Error parsing JSON response:", parseError);
      throw new Error("Invalid JSON response from AI");
    }

    const validatedResponse = responseSchema.parse(parsedResponse);

    let jiraTicket = {
      attempted: false,
      created: false,
      key: "",
      url: "",
      error: "",
    };

    if (
      validatedResponse.support_workflow.should_create_ticket &&
      validatedResponse.support_workflow.resolution_status !== "resolved"
    ) {
      jiraTicket = await createJiraTicket(
        validatedResponse.support_workflow.ticket_draft,
      );
    }

    const responseWithId = {
      id: crypto.randomUUID(),
      ...validatedResponse,
      jira_ticket: jiraTicket,
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
      error?.error?.error?.message || error?.message || "Unknown error";

    let userMessage =
      "The support assistant is temporarily unavailable right now. Please try again later.";
    let thinkingMessage = "Error occurred during message generation.";

    if (
      typeof errorMessage === "string" &&
      errorMessage.toLowerCase().includes("credit balance is too low")
    ) {
      userMessage =
        "The support assistant is temporarily unavailable right now due to a service billing issue. Please try again later.";
      thinkingMessage = "Anthropic API billing or credit issue.";
    } else if (
      typeof errorMessage === "string" &&
      errorMessage.toLowerCase().includes("invalid x-api-key")
    ) {
      userMessage =
        "The support assistant is temporarily unavailable due to an authentication issue. Please try again later.";
      thinkingMessage = "Anthropic API key issue.";
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
          },
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
