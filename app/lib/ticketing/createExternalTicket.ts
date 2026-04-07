import { ticketProviderRegistry } from "./providerRegistry";
import type {
  TicketDraft,
  TicketResult,
  ScreenshotPayload,
  TicketingSystem,
} from "./types";

export async function createExternalTicket(
  system: string,
  ticketDraft: TicketDraft,
  screenshotFile?: ScreenshotPayload | null,
): Promise<TicketResult> {
  const normalizedSystem = ((system || "jira").toLowerCase() as TicketingSystem);

  const provider =
    ticketProviderRegistry[normalizedSystem] || ticketProviderRegistry.jira;

  return provider(ticketDraft, screenshotFile);
}