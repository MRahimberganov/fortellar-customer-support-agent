type TeamsAlertPayload = {
  title: string;
  summary: string;
  priority: string;
  assignmentGroup: string;
  assignee?: string;
  jiraKey?: string;
  jiraUrl?: string;
  reporterName?: string;
  reporterEmail?: string;
  reporterPhone?: string;
  screenshotAttached?: boolean;
};

export async function sendTeamsAlert(
  payload: TeamsAlertPayload,
): Promise<{ sent: boolean; error?: string }> {
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;

  if (!webhookUrl) {
    return {
      sent: false,
      error: "TEAMS_WEBHOOK_URL is not configured.",
    };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        summary: payload.title,
        themeColor: "FF0000",
        title: payload.title,
        sections: [
          {
            facts: [
              { name: "Summary", value: payload.summary },
              { name: "Priority", value: payload.priority },
              { name: "Assignment", value: payload.assignmentGroup },
              { name: "Reporter", value: payload.reporterName || "N/A" },
              { name: "Email", value: payload.reporterEmail || "N/A" },
              { name: "Phone", value: payload.reporterPhone || "N/A" },
              {
                name: "Screenshot Attached",
                value: payload.screenshotAttached ? "Yes" : "No",
              },
              { name: "Jira", value: payload.jiraKey || "N/A" },
            ],
            markdown: true,
          },
        ],
        potentialAction: payload.jiraUrl
          ? [
              {
                "@type": "OpenUri",
                name: "View Jira Ticket",
                targets: [
                  {
                    os: "default",
                    uri: payload.jiraUrl,
                  },
                ],
              },
            ]
          : [],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        sent: false,
        error: `Teams webhook failed: ${response.status} ${errorText}`,
      };
    }

    return { sent: true };
  } catch (error: any) {
    return {
      sent: false,
      error: error?.message || "Unknown Teams webhook error.",
    };
  }
}