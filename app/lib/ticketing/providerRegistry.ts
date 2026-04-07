import { createJiraTicket } from "./jira";
import { createServiceNowTicket } from "./servicenow";
import { createZendeskTicket } from "./zendesk";
import type {
  ScreenshotPayload,
  TicketDraft,
  TicketProviderHandler,
  TicketResult,
  TicketingSystem,
} from "./types";

const jiraProvider: TicketProviderHandler = (
  ticketDraft: TicketDraft,
  screenshotFile?: ScreenshotPayload | null,
): Promise<TicketResult> => {
  return createJiraTicket(ticketDraft, screenshotFile);
};

const serviceNowProvider: TicketProviderHandler = (
  ticketDraft: TicketDraft,
): Promise<TicketResult> => {
  return createServiceNowTicket(ticketDraft);
};

const zendeskProvider: TicketProviderHandler = (
  ticketDraft: TicketDraft,
): Promise<TicketResult> => {
  return createZendeskTicket(ticketDraft);
};

export const ticketProviderRegistry: Record<TicketingSystem, TicketProviderHandler> = {
  jira: jiraProvider,
  servicenow: serviceNowProvider,
  zendesk: zendeskProvider,
  other: async () => ({
    attempted: false,
    created: false,
    key: "",
    url: "",
    error: "No provider handler is configured for 'other'.",
  }),
};