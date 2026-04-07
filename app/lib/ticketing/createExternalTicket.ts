import { createJiraTicket } from "./jira";
import { createServiceNowTicket } from "./servicenow";
import { createZendeskTicket } from "./zendesk";
import type {
  TicketDraft,
  TicketResult,
  ScreenshotPayload,
} from "./types";

export async function createExternalTicket(
  system: string,
  ticketDraft: TicketDraft,
  screenshotFile?: ScreenshotPayload | null,
): Promise<TicketResult> {
  switch ((system || "jira").toLowerCase()) {
    case "servicenow":
      return createServiceNowTicket(ticketDraft);

    case "zendesk":
      return createZendeskTicket(ticketDraft);

    case "jira":
    default:
      return createJiraTicket(ticketDraft, screenshotFile);
  }
}