import type { TicketDraft, TicketResult } from "./types";

function mapZendeskPriority(priority: string) {
  const normalized = String(priority || "").toLowerCase();

  if (normalized === "critical") return "urgent";
  if (normalized === "high") return "high";
  if (normalized === "medium") return "normal";
  return "low";
}

export async function createZendeskTicket(
  ticketDraft: TicketDraft,
): Promise<TicketResult> {
  const subdomain = process.env.ZENDESK_SUBDOMAIN;
  const email = process.env.ZENDESK_EMAIL;
  const apiToken = process.env.ZENDESK_API_TOKEN;

  if (!subdomain || !email || !apiToken) {
    return {
      attempted: false,
      created: false,
      key: "",
      url: "",
      error: "Zendesk environment variables are not fully configured.",
    };
  }

  try {
    const auth = Buffer.from(`${email}/token:${apiToken}`).toString("base64");

    const response = await fetch(
      `https://${subdomain}.zendesk.com/api/v2/tickets.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
        },
        body: JSON.stringify({
          ticket: {
            subject: ticketDraft.summary || "Support issue",
            comment: {
              body: `${ticketDraft.description || "Issue reported through support agent."}

Assignment Group: ${ticketDraft.assignment_group || "General Support"}
Assignment Reason: ${ticketDraft.assignment_reason || "N/A"}
Category: ${ticketDraft.category || "general"}
Subcategory: ${ticketDraft.subcategory || "general"}

Contact Name: ${ticketDraft.contact?.name || "N/A"}
Contact Email: ${ticketDraft.contact?.email || "N/A"}
Contact Phone: ${ticketDraft.contact?.phone || "N/A"}

Error Condition: ${ticketDraft.error_condition || "N/A"}
Error Description: ${ticketDraft.error_description || "N/A"}

Affected System: ${ticketDraft.metadata?.affected_system || "N/A"}
Environment: ${ticketDraft.metadata?.environment || "N/A"}
Timestamp: ${ticketDraft.metadata?.timestamp || "N/A"}
After Hours: ${ticketDraft.metadata?.after_hours ?? "N/A"}`,
            },
            priority: mapZendeskPriority(ticketDraft.priority),
            tags: Array.isArray(ticketDraft.labels) ? ticketDraft.labels : [],
            requester: {
              name: ticketDraft.contact?.name || "Unknown User",
              email: ticketDraft.contact?.email || undefined,
            },
          },
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        attempted: true,
        created: false,
        key: "",
        url: "",
        error: `Zendesk API error: ${response.status} ${JSON.stringify(data)}`,
      };
    }

    return {
      attempted: true,
      created: true,
      key: String(data?.ticket?.id || ""),
      url: data?.ticket?.url || "",
      error: "",
    };
  } catch (error: any) {
    return {
      attempted: true,
      created: false,
      key: "",
      url: "",
      error: error?.message || "Failed to create Zendesk ticket.",
    };
  }
}