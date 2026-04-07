import type { TicketDraft, TicketResult } from "./types";

function mapServiceNowPriority(priority: string) {
  const normalized = String(priority || "").toLowerCase();

  if (normalized === "critical") return "1";
  if (normalized === "high") return "2";
  if (normalized === "medium") return "3";
  return "4";
}

export async function createServiceNowTicket(
  ticketDraft: TicketDraft,
): Promise<TicketResult> {
  const instanceUrl = process.env.SERVICENOW_INSTANCE_URL;
  const username = process.env.SERVICENOW_USERNAME;
  const password = process.env.SERVICENOW_PASSWORD;
  const table = process.env.SERVICENOW_TABLE || "incident";

  if (!instanceUrl || !username || !password) {
    return {
      attempted: false,
      created: false,
      key: "",
      url: "",
      error: "ServiceNow environment variables are not fully configured.",
    };
  }

  try {
    const response = await fetch(`${instanceUrl}/api/now/table/${table}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "Basic " + Buffer.from(`${username}:${password}`).toString("base64"),
        Accept: "application/json",
      },
      body: JSON.stringify({
        short_description: ticketDraft.summary || "Support issue",
        description: `${ticketDraft.description || "Issue reported through support agent."}

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
        category: ticketDraft.category || "inquiry",
        subcategory: ticketDraft.subcategory || "general",
        urgency: mapServiceNowPriority(ticketDraft.priority),
        impact: mapServiceNowPriority(ticketDraft.priority),
        contact_type: "virtual_agent",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        attempted: true,
        created: false,
        key: "",
        url: "",
        error: `ServiceNow API error: ${response.status} ${JSON.stringify(data)}`,
      };
    }

    return {
      attempted: true,
      created: true,
      key: data?.result?.number || "",
      url: instanceUrl,
      error: "",
    };
  } catch (error: any) {
    return {
      attempted: true,
      created: false,
      key: "",
      url: "",
      error: error?.message || "Failed to create ServiceNow ticket.",
    };
  }
}