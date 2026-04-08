import { ticketProviderRegistry } from "./providerRegistry";
import type {
  ScreenshotPayload,
  TicketDraft,
  TicketResult,
  TicketingSystem,
} from "./types";

export async function createExternalTicket(
  system: string,
  ticketDraft: TicketDraft,
  screenshotFile?: ScreenshotPayload | null,
): Promise<TicketResult> {
  const normalizedSystem = (system || "jira").toLowerCase() as TicketingSystem;

  const provider = ticketProviderRegistry[normalizedSystem];

  if (!provider) {
    return {
      attempted: false,
      created: false,
      key: "",
      url: "",
      error: `No ticket provider is configured for system: ${system}`,
    };
  }

  return provider(ticketDraft, screenshotFile);
}