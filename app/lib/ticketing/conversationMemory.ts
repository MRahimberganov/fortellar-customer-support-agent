import type { TicketDraft } from "./types";

export type ConversationMemory = {
  latest_user_message: string;
  prior_user_messages: string[];
  prior_assistant_messages: string[];
  user_said_still_not_working: boolean;
  collected_contact: {
    name?: string;
    email?: string;
    phone?: string;
  };
  inferred_ticket_updates: Partial<TicketDraft>;
};

function extractEmail(text: string): string | undefined {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0];
}

function extractPhone(text: string): string | undefined {
  const match = text.match(
    /(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/,
  );
  return match?.[0];
}

export function buildConversationMemory(messages: any[]): ConversationMemory {
  const normalizedMessages = (messages || []).filter(
    (msg) => msg?.role === "user" || msg?.role === "assistant",
  );

  const userMessages = normalizedMessages
    .filter((msg) => msg.role === "user")
    .map((msg) => String(msg.content || "").trim());

  const assistantMessages = normalizedMessages
    .filter((msg) => msg.role === "assistant")
    .map((msg) => String(msg.content || "").trim());

  const latestUserMessage = userMessages[userMessages.length - 1] || "";
  const priorUserMessages = userMessages.slice(0, -1);

  const allUserText = userMessages.join("\n").toLowerCase();

  const email =
    [...userMessages]
      .reverse()
      .map(extractEmail)
      .find(Boolean) || undefined;

  const phone =
    [...userMessages]
      .reverse()
      .map(extractPhone)
      .find(Boolean) || undefined;

  const userSaidStillNotWorking =
    allUserText.includes("still not working") ||
    allUserText.includes("didn't work") ||
    allUserText.includes("did not work") ||
    allUserText.includes("not fixed") ||
    allUserText.includes("unresolved");

  const inferredTicketUpdates: Partial<TicketDraft> = {};

  if (allUserText.includes("prod") || allUserText.includes("production")) {
    inferredTicketUpdates.metadata = {
      ...(inferredTicketUpdates.metadata || {}),
      environment: "prod",
    };
  } else if (allUserText.includes("uat")) {
    inferredTicketUpdates.metadata = {
      ...(inferredTicketUpdates.metadata || {}),
      environment: "uat",
    };
  } else if (
    allUserText.includes("stage") ||
    allUserText.includes("staging")
  ) {
    inferredTicketUpdates.metadata = {
      ...(inferredTicketUpdates.metadata || {}),
      environment: "stage",
    };
  } else if (allUserText.includes("dev")) {
    inferredTicketUpdates.metadata = {
      ...(inferredTicketUpdates.metadata || {}),
      environment: "dev",
    };
  }

  if (allUserText.includes("aws")) {
    inferredTicketUpdates.metadata = {
      ...(inferredTicketUpdates.metadata || {}),
      cloud_provider: "aws",
    };
  } else if (allUserText.includes("azure")) {
    inferredTicketUpdates.metadata = {
      ...(inferredTicketUpdates.metadata || {}),
      cloud_provider: "azure",
    };
  } else if (allUserText.includes("gcp")) {
    inferredTicketUpdates.metadata = {
      ...(inferredTicketUpdates.metadata || {}),
      cloud_provider: "gcp",
    };
  }

  return {
    latest_user_message: latestUserMessage,
    prior_user_messages: priorUserMessages,
    prior_assistant_messages: assistantMessages,
    user_said_still_not_working: userSaidStillNotWorking,
    collected_contact: {
      email,
      phone,
    },
    inferred_ticket_updates: inferredTicketUpdates,
  };
}