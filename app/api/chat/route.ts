import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { retrieveContext, RAGSource } from "@/app/lib/rag";
import crypto from "crypto";
import customerSupportCategories from "@/app/lib/customer_support_categories.json";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Debug message helper function
// Input: message string and optional data object
// Output: JSON string with message, sanitized data, and timestamp
const debugMessage = (msg: string, data: any = {}) => {
  console.log(msg, data);
  const timestamp = new Date().toISOString().replace(/[^\x20-\x7E]/g, "");
  const safeData = JSON.parse(JSON.stringify(data));
  return JSON.stringify({ msg, data: safeData, timestamp });
};

// Define the schema for the AI response using Zod
// This ensures type safety and validation for the AI's output
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
  suggested_questions: z.array(z.string()),
  debug: z.object({
    context_used: z.boolean(),
  }),
  matched_categories: z.array(z.string()).optional(),
  redirect_to_agent: z
    .object({
      should_redirect: z.boolean(),
      reason: z.string().optional(),
    })
    .optional(),
});

// Helper function to sanitize header values
// Input: string value
// Output: sanitized string (ASCII characters only)
function sanitizeHeaderValue(value: string): string {
  return value.replace(/[^\x00-\x7F]/g, "");
}

// Helper function to log timestamps for performance measurement
// Input: label string and start time
// Output: Logs the duration for the labeled operation
const logTimestamp = (label: string, start: number) => {
  const timestamp = new Date().toISOString();
  const time = ((performance.now() - start) / 1000).toFixed(2);
  console.log(`⏱️ [${timestamp}] ${label}: ${time}s`);
};

function sanitizeAndParseJSON(jsonString: string) {
  // Replace newlines within string values
  const sanitized = jsonString.replace(
    /(?<=:\s*")(.|\n)*?(?=")/g,
    (match) => match.replace(/\n/g, "\\n"),
  );

  try {
    return JSON.parse(sanitized);
  } catch (parseError) {
    console.error("Error parsing JSON response:", parseError);
    throw new Error("Invalid JSON response from AI");
  }
}

// Main POST request handler
export async function POST(req: Request) {
  const apiStart = performance.now();
  const measureTime = (label: string) => logTimestamp(label, apiStart);

  // Extract data from the request body
  const { messages = [], model, knowledgeBaseId } = await req.json();
  const latestMessage = messages?.[messages.length - 1]?.content || "";

  if (!latestMessage) {
    return new Response(
      JSON.stringify({
        response: "Please enter a message.",
        thinking: "No user message was provided.",
        user_mood: "neutral",
        suggested_questions: [
          "What does Fortellar do?",
          "How do you support HIPAA compliance?",
          "What are your CloudOps services?"
        ],
        debug: { context_used: false },
        matched_categories: [],
        redirect_to_agent: {
          should_redirect: false,
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

  // Prepare debug data
  const MAX_DEBUG_LENGTH = 1000;
  const debugData = sanitizeHeaderValue(
    debugMessage("🚀 API route called", {
      messagesReceived: messages?.length || 0,
      latestMessageLength: latestMessage.length,
      anthropicKeySlice: process.env.ANTHROPIC_API_KEY?.slice(0, 4) + "****",
    }),
  ).slice(0, MAX_DEBUG_LENGTH);

  // Initialize variables for RAG retrieval
  let retrievedContext = "";
  let isRagWorking = false;
  let ragSources: RAGSource[] = [];

  // Attempt to retrieve context from RAG
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
    console.log(
      "✅ RAG retrieval completed successfully. Context:",
      retrievedContext.slice(0, 100) + "...",
    );
  } catch (error) {
    console.error("💀 RAG Error:", error);
    console.error("❌ RAG retrieval failed for query:", latestMessage);
    retrievedContext = "";
    isRagWorking = false;
    ragSources = [];
  }

  measureTime("RAG Total Duration");

  // Prepare categories context for the system prompt
  const USE_CATEGORIES = true;
  const categoryListString = customerSupportCategories.categories
    .map((c) => c.id)
    .join(", ");

  const categoriesContext = USE_CATEGORIES
    ? `
    To help with our internal classification of inquiries, we would like you to categorize inquiries in addition to answering them. We have provided you with ${customerSupportCategories.categories.length} customer support categories.
    Check if your response fits into any category and include the category IDs in your "matched_categories" array.
    The available categories are: ${categoryListString}
    If multiple categories match, include multiple category IDs. If no categories match, return an empty array.
  `
    : "";

  // Fortellar-specific system prompt
  const systemPrompt = `You are the Fortellar Support Assistant.

  You help users understand Fortellar services and capabilities, especially in:
  - CloudOps
  - Security & Compliance
  - Disaster Recovery & Resilience
  - AI Readiness & Adoption
  
  Your tone should be professional, clear, helpful, and confident. Sound like a knowledgeable Fortellar consultant or support engineer.
  
  Use ONLY the knowledge base content provided below. Do not make up facts, services, certifications, or capabilities that are not explicitly included.
  
  Knowledge Base:
  ${isRagWorking ? retrievedContext : "No information available."}
  
  Rules:
  - If the answer is in the knowledge base, answer clearly and directly.
  - If the answer is only partially supported by the knowledge base, say what you can confirm and note what is not available.
  - If the answer is not found in the knowledge base, say you do not have that information and offer to connect the user with a human.
  - If the question is unrelated to Fortellar services or support, redirect to a human agent.
  - Keep answers concise but useful.
  - Suggest relevant follow-up questions when appropriate.
  
  ${categoriesContext}
  
  You must ALWAYS return a valid JSON object in exactly this format:
  {
    "thinking": "Brief reasoning about how to answer the question",
    "response": "Final answer to the user",
    "user_mood": "positive|neutral|negative|curious|frustrated|confused",
    "suggested_questions": ["Question 1?", "Question 2?", "Question 3?"],
    "debug": {
      "context_used": true|false
    },
    ${USE_CATEGORIES ? '"matched_categories": ["category_id1", "category_id2"],' : ""}
    "redirect_to_agent": {
      "should_redirect": boolean,
      "reason": "Reason for redirection if applicable"
    }
  }
`;

  try {
    console.log("🚀 Query Processing");
    measureTime("Claude Generation Start");

    const anthropicMessages = messages.map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }));

    anthropicMessages.push({
      role: "assistant",
      content: "{",
    });

    const response = await anthropic.messages.create({
      model: model || "claude-3-5-haiku-latest",
      max_tokens: 1000,
      messages: anthropicMessages,
      system: systemPrompt,
      temperature: 0.3,
    });

    measureTime("Claude Generation Complete");
    console.log("✅ Message generation completed");

    // Extract text content from the response
    const textContent =
      "{" +
      response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join(" ");

    // Parse the JSON response
    let parsedResponse;
    try {
      parsedResponse = sanitizeAndParseJSON(textContent);
    } catch (parseError) {
      console.error("Error parsing JSON response:", parseError);
      throw new Error("Invalid JSON response from AI");
    }

    const validatedResponse = responseSchema.parse(parsedResponse);

    const responseWithId = {
      id: crypto.randomUUID(),
      ...validatedResponse,
    };

    // Check if redirection to a human agent is needed
    if (responseWithId.redirect_to_agent?.should_redirect) {
      console.log("🚨 AGENT REDIRECT TRIGGERED!");
      console.log("Reason:", responseWithId.redirect_to_agent.reason);
    }

    // Prepare the response object
    const apiResponse = new Response(JSON.stringify(responseWithId), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Add RAG sources to the response headers if available
    if (ragSources.length > 0) {
      apiResponse.headers.set(
        "x-rag-sources",
        sanitizeHeaderValue(JSON.stringify(ragSources)),
      );
    }

    // Add debug data to the response headers
    apiResponse.headers.set("X-Debug-Data", sanitizeHeaderValue(debugData));

    measureTime("API Complete");

    return apiResponse;
  } catch (error: any) {
    console.error("💥 Error in message generation:", error);

    let userMessage =
      "The AI assistant is temporarily unavailable right now. Please try again later.";
    let thinkingMessage = "Error occurred during message generation.";

    const errorMessage =
      error?.error?.error?.message || error?.message || "Unknown error";

    if (
      typeof errorMessage === "string" &&
      errorMessage.toLowerCase().includes("credit balance is too low")
    ) {
      userMessage =
        "The AI assistant is temporarily unavailable right now due to a service billing issue. Please try again later.";
      thinkingMessage = "Anthropic API billing or credit issue.";
    } else if (
      typeof errorMessage === "string" &&
      errorMessage.toLowerCase().includes("invalid x-api-key")
    ) {
      userMessage =
        "The AI assistant is temporarily unavailable due to an authentication issue. Please try again later.";
      thinkingMessage = "Anthropic API key issue.";
    }

    const errorResponse = {
      response: userMessage,
      thinking: thinkingMessage,
      user_mood: "neutral" as const,
      suggested_questions: [
        "What does Fortellar do?",
        "How do you support HIPAA compliance?",
        "What are your CloudOps services?"
      ],
      debug: { context_used: false },
      matched_categories: [],
      redirect_to_agent: {
        should_redirect: true,
        reason: "AI service unavailable",
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
