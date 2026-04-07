import type {
  TicketDraft,
  TicketResult,
  ScreenshotPayload,
} from "./types";
import { determineAssignmentGroup } from "./routing";

async function uploadJiraAttachment(
  issueKey: string,
  screenshotFile: ScreenshotPayload,
): Promise<void> {
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  if (!baseUrl || !email || !apiToken) {
    throw new Error(
      "Jira attachment upload environment variables are not fully configured.",
    );
  }

  const bytes = Buffer.from(screenshotFile.content_base64, "base64");
  const uint8 = new Uint8Array(bytes);
  
  const blob = new Blob([uint8], {
    type: screenshotFile.file_type || "application/octet-stream",
  });

  const formData = new FormData();
  formData.append(
    "file",
    blob,
    screenshotFile.file_name || "screenshot.png",
  );

  const response = await fetch(
    `${baseUrl}/rest/api/3/issue/${issueKey}/attachments`,
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${email}:${apiToken}`).toString("base64"),
        Accept: "application/json",
        "X-Atlassian-Token": "no-check",
      },
      body: formData,
    },
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      `Jira attachment upload failed: ${response.status} ${JSON.stringify(data)}`,
    );
  }
}

function mapJiraPriority(ticketDraft: TicketDraft) {
  const summary = String(ticketDraft?.summary || "").toLowerCase();
  const description = String(ticketDraft?.description || "").toLowerCase();
  const errorCondition = String(
    ticketDraft?.error_condition || "",
  ).toLowerCase();
  const errorDescription = String(
    ticketDraft?.error_description || "",
  ).toLowerCase();

  const combinedText = [
    summary,
    description,
    errorCondition,
    errorDescription,
  ].join(" ");

  const afterHours = Boolean(ticketDraft?.metadata?.after_hours);

  if (
    afterHours ||
    combinedText.includes("urgent") ||
    combinedText.includes("critical") ||
    combinedText.includes("production") ||
    combinedText.includes("cannot log in") ||
    combinedText.includes("can't log in") ||
    combinedText.includes("unable to log in") ||
    combinedText.includes("login failure") ||
    combinedText.includes("outage") ||
    combinedText.includes("down")
  ) {
    return "High";
  }

  if (
    combinedText.includes("slow") ||
    combinedText.includes("intermittent") ||
    combinedText.includes("degraded") ||
    combinedText.includes("warning")
  ) {
    return "Medium";
  }

  return "Low";
}

function mapJiraAssignee(ticketDraft: TicketDraft) {
  const routing = determineAssignmentGroup(ticketDraft);

  const iamAssignee = process.env.JIRA_IAM_ASSIGNEE_ACCOUNT_ID;
  const cloudOpsAssignee = process.env.JIRA_CLOUDOPS_ASSIGNEE_ACCOUNT_ID;
  const securityAssignee = process.env.JIRA_SECURITY_ASSIGNEE_ACCOUNT_ID;
  const dataAssignee = process.env.JIRA_DATA_ASSIGNEE_ACCOUNT_ID;

  if (routing.assignment_group === "IAM Team" && iamAssignee) {
    return { accountId: iamAssignee };
  }

  if (routing.assignment_group === "CloudOps Team" && cloudOpsAssignee) {
    return { accountId: cloudOpsAssignee };
  }

  if (routing.assignment_group === "Security Team" && securityAssignee) {
    return { accountId: securityAssignee };
  }

  if (routing.assignment_group === "Data Team" && dataAssignee) {
    return { accountId: dataAssignee };
  }

  return undefined;
}

export async function createJiraTicket(
  ticketDraft: TicketDraft,
  screenshotFile?: ScreenshotPayload | null,
): Promise<TicketResult> {
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;
  const projectKey = process.env.JIRA_PROJECT_KEY;

  const routing = determineAssignmentGroup(ticketDraft);

  ticketDraft.assignment_group =
    ticketDraft.assignment_group || routing.assignment_group;
  ticketDraft.assignment_reason =
    ticketDraft.assignment_reason || routing.assignment_reason;
  ticketDraft.category = ticketDraft.category || routing.category;
  ticketDraft.subcategory = ticketDraft.subcategory || routing.subcategory;

  ticketDraft.labels = Array.from(
    new Set([
      ...(Array.isArray(ticketDraft.labels) ? ticketDraft.labels : []),
      "support-agent",
      ticketDraft.assignment_group.toLowerCase().replace(/\s+/g, "-"),
      ticketDraft.category.toLowerCase().replace(/\s+/g, "-"),
      ticketDraft.subcategory.toLowerCase().replace(/\s+/g, "-"),
    ]),
  );

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
    const jiraAssignee = mapJiraAssignee(ticketDraft);

    console.log("FINAL ASSIGNEE SENT TO JIRA:", jiraAssignee);

    const response = await fetch(`${baseUrl}/rest/api/3/issue`, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${email}:${apiToken}`).toString("base64"),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        fields: {
          project: { key: projectKey },
          priority: { name: mapJiraPriority(ticketDraft) },
          assignee: jiraAssignee,
          summary: ticketDraft.summary || "Support issue",
          description: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: `${ticketDraft.description || "Issue reported through support agent."}

Routing Details:
Assignment Group: ${ticketDraft.assignment_group || "General Support"}
Assignment Reason: ${ticketDraft.assignment_reason || "N/A"}
Category: ${ticketDraft.category || "general"}
Subcategory: ${ticketDraft.subcategory || "general"}

Contact Information:
Contact Name: ${ticketDraft.contact?.name || "N/A"}
Contact Email: ${ticketDraft.contact?.email || "N/A"}
Contact Phone: ${ticketDraft.contact?.phone || "N/A"}

Issue Details:
Error Condition: ${ticketDraft.error_condition || "N/A"}
Error Description: ${ticketDraft.error_description || "N/A"}

Metadata:
Affected System: ${ticketDraft.metadata?.affected_system || "N/A"}
Environment: ${ticketDraft.metadata?.environment || "N/A"}
Cloud Provider: ${ticketDraft.metadata?.cloud_provider || "unknown"}
Timestamp: ${ticketDraft.metadata?.timestamp || "N/A"}
After Hours: ${ticketDraft.metadata?.after_hours ?? "N/A"}

Attachments:
Screenshot Attached: ${ticketDraft.screenshot_attachment?.attached ? "Yes" : "No"}
Screenshot File: ${ticketDraft.screenshot_attachment?.file_name || "N/A"}`,
                  },
                ],
              },
            ],
          },
          issuetype: {
            id: process.env.JIRA_ISSUE_TYPE_ID || "10298",
          },
          labels: Array.from(
            new Set(Array.isArray(ticketDraft.labels) ? ticketDraft.labels : []),
          ),
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

    if (data?.key && screenshotFile?.content_base64) {
      try {
        await uploadJiraAttachment(data.key, screenshotFile);
        console.log("JIRA ATTACHMENT UPLOAD SUCCESS:", {
          issueKey: data.key,
          fileName: screenshotFile.file_name,
        });
      } catch (attachmentError: any) {
        console.error("JIRA ATTACHMENT UPLOAD FAILED:", {
          issueKey: data.key,
          error: attachmentError?.message || String(attachmentError),
        });
      }
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