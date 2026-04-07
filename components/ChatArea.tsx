"use client";

import { useEffect, useRef, useState } from "react";
import config from "@/config";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import {
  HandHelping,
  WandSparkles,
  LifeBuoyIcon,
  BookOpenText,
  ChevronDown,
} from "lucide-react";
import "highlight.js/styles/atom-one-dark.css";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TypedText = ({ text = "", delay = 5 }) => {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    if (!text) return;
    const timer = setTimeout(() => {
      setDisplayedText(text.substring(0, displayedText.length + 1));
    }, delay);
    return () => clearTimeout(timer);
  }, [text, displayedText, delay]);

  return <>{displayedText}</>;
};

type ThinkingContent = {
  id: string;
  content: string;
  user_mood: string;
  debug: any;
  matched_categories?: string[];
};

type Model = {
  id: string;
  name: string;
};

type KnowledgeBase = {
  id: string;
  name: string;
};

interface Message {
  id: string;
  role: string;
  content: string;
  attachment?: {
    file_name: string;
    file_type: string;
    attached: boolean;
  };
}

interface ConversationHeaderProps {
  selectedModel: string;
  setSelectedModel: (modelId: string) => void;
  models: Model[];
  showAvatar: boolean;
  selectedKnowledgeBase: string;
  setSelectedKnowledgeBase: (knowledgeBaseId: string) => void;
  knowledgeBases: KnowledgeBase[];
}

const UISelector = ({
  redirectToAgent,
}: {
  redirectToAgent: { should_redirect: boolean; reason: string };
}) => {
  if (redirectToAgent.should_redirect) {
    return (
      <Button
        size="sm"
        className="mt-2 flex items-center space-x-2"
        onClick={() => {
          console.log("🔥 Human Agent Connection Requested!", redirectToAgent);
          const event = new CustomEvent("humanAgentRequested", {
            detail: {
              reason: redirectToAgent.reason || "Unknown",
              mood: "frustrated",
              timestamp: new Date().toISOString(),
            },
          });
          window.dispatchEvent(event);
        }}
      >
        <LifeBuoyIcon className="w-4 h-4" />
        <small className="text-sm leading-none">Talk to a human</small>
      </Button>
    );
  }

  return null;
};

const SuggestedQuestions = ({
  questions,
  onQuestionClick,
  isLoading,
}: {
  questions: string[];
  onQuestionClick: (question: string) => void;
  isLoading: boolean;
}) => {
  if (!questions || questions.length === 0) return null;

  return (
    <div className="mt-2 pl-10 flex flex-wrap gap-2">
      {questions.map((question, index) => (
        <Button
          key={index}
          className="text-sm text-gray-500 shadow-sm"
          variant="outline"
          size="sm"
          onClick={() => onQuestionClick(question)}
          disabled={isLoading}
        >
          {question}
        </Button>
      ))}
    </div>
  );
};

const MessageContent = ({
  content,
  role,
}: {
  content: string;
  role: string;
}) => {
  const [thinking, setThinking] = useState(true);
  const [parsed, setParsed] = useState<{
    response?: string;
    thinking?: string;
    user_mood?: string;
    suggested_questions?: string[];
    redirect_to_agent?: { should_redirect: boolean; reason: string };
    debug?: {
      context_used: boolean;
    };
  }>({});
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!content || role !== "assistant") return;

    const timer = setTimeout(() => {
      setError(true);
      setThinking(false);
    }, 30000);

    try {
      const result = JSON.parse(content);
      console.log("🔍 Parsed Result:", result);

      if (
        result.response &&
        result.response.length > 0 &&
        result.response !== "..."
      ) {
        setParsed(result);
        setThinking(false);
        clearTimeout(timer);
      }
    } catch (error) {
      console.error("Error parsing JSON:", error);
      setError(true);
      setThinking(false);
    }

    return () => clearTimeout(timer);
  }, [content, role]);

  if (thinking && role === "assistant") {
    return (
      <div className="flex items-center">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2" />
        <span>Thinking...</span>
      </div>
    );
  }

  if (error && !parsed.response) {
    return (
      <div>The assistant is temporarily unavailable. Please try again later.</div>
    );
  }

  const isTicketConfirmation =
    (parsed.response || "").includes("**Ticket ID:**") &&
    (parsed.response || "").includes("**Routed to:**");

  if (isTicketConfirmation) {
    const responseText = parsed.response || content;

    const ticketIdMatch = responseText.match(/\*\*Ticket ID:\*\*\s*(.+)/);
    const linkMatch = responseText.match(
      /\*\*Link:\*\*\s*\[([^\]]+)\]\(([^)]+)\)/
    );
    const routedToMatch = responseText.match(/\*\*Routed to:\*\*\s*(.+)/);
    const priorityMatch = responseText.match(/\*\*Priority:\*\*\s*(.+)/);

    const ticketId = ticketIdMatch?.[1] || "";
    const linkLabel = linkMatch?.[1] || "Open Jira Ticket";
    const linkUrl = linkMatch?.[2] || "";
    const routedTo = routedToMatch?.[1] || "";
    const priority = priorityMatch?.[1] || "";

    return (
      <>
        <div className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
          <div className="font-semibold text-green-700">
            ✅ Ticket Created Successfully
          </div>

          <div className="space-y-2 text-sm text-black">
            <div>
              <span className="font-semibold">Ticket ID:</span> {ticketId}
            </div>

            <div>
              <span className="font-semibold">Link:</span>{" "}
              {linkUrl ? (
                <a
                  href={linkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                >
                  Open Jira Ticket
                </a>
              ) : (
                linkLabel
              )}
            </div>

            <div>
              <span className="font-semibold">Routed to:</span> {routedTo}
            </div>

            <div>
              <span className="font-semibold">Priority:</span>{" "}
              <span className="text-red-600 font-medium">{priority}</span>
            </div>

            <div>Our team has been notified and is investigating.</div>
          </div>
        </div>

        {parsed.redirect_to_agent && (
          <UISelector redirectToAgent={parsed.redirect_to_agent} />
        )}
      </>
    );
  }

  return (
    <>
      <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-strong:text-black prose-a:text-blue-600 prose-a:underline">
        <ReactMarkdown rehypePlugins={[rehypeRaw, rehypeHighlight]}>
          {parsed.response || content}
        </ReactMarkdown>
      </div>
      {parsed.redirect_to_agent && (
        <UISelector redirectToAgent={parsed.redirect_to_agent} />
      )}
    </>
  );
};

const ConversationHeader: React.FC<ConversationHeaderProps> = ({
  selectedModel,
  setSelectedModel,
  models,
  showAvatar,
  selectedKnowledgeBase,
  setSelectedKnowledgeBase,
  knowledgeBases,
}) => (
  <div className="flex flex-col gap-2 p-0 pb-2 animate-fade-in">
    <div className="flex items-center space-x-4 mb-2 sm:mb-0">
      {showAvatar && (
        <>
          <Avatar className="w-10 h-10 border">
            <AvatarImage
              src="/ant-logo.svg"
              alt="AI Assistant Avatar"
              width={40}
              height={40}
            />
            <AvatarFallback>AI</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-sm font-medium leading-none">
              Fortellar Assistant
            </h3>
            <p className="text-sm text-muted-foreground">Customer support</p>
          </div>
        </>
      )}
    </div>
    <div className="flex w-full gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="min-w-0 flex-1 justify-between overflow-hidden text-muted-foreground"
          >
            <span className="truncate">
              {models.find((m) => m.id === selectedModel)?.name}
            </span>
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {models.map((model) => (
            <DropdownMenuItem
              key={model.id}
              onSelect={() => setSelectedModel(model.id)}
            >
              {model.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="min-w-0 flex-1 justify-between overflow-hidden text-muted-foreground"
          >
            <span className="truncate">
              {knowledgeBases.find((kb) => kb.id === selectedKnowledgeBase)
                ?.name || "Select KB"}
            </span>
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {knowledgeBases.map((kb) => (
            <DropdownMenuItem
              key={kb.id}
              onSelect={() => setSelectedKnowledgeBase(kb.id)}
            >
              {kb.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
);

async function fileToBase64(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.split(",")[1] || "";
      resolve(base64);
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ChatArea() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedScreenshot, setSelectedScreenshot] = useState<File | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [showHeader, setShowHeader] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini");
  const [showAvatar, setShowAvatar] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState(
    "your-knowledge-base-id"
  );

  const handleScreenshotChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0] || null;
    setSelectedScreenshot(file);
  };

  const knowledgeBases: KnowledgeBase[] = [
    { id: "your-knowledge-base-id", name: "Knowledge Base" },
  ];

  const models = [{ id: "gpt-4o-mini", name: "GPT-4o Mini" }];

  useEffect(() => {
    console.log("🔍 Messages changed! Count:", messages.length);

    const scrollToNewestMessage = () => {
      if (messagesEndRef.current) {
        console.log("📜 Scrolling to newest message...");
        const behavior = messages.length <= 2 ? "auto" : "smooth";
        messagesEndRef.current.scrollIntoView({ behavior, block: "end" });
      } else {
        console.log("❌ No scroll anchor found!");
      }
    };

    if (messages.length > 0) {
      setTimeout(scrollToNewestMessage, 100);
    }
  }, [messages]);

  useEffect(() => {
    if (!config.includeLeftSidebar) {
      const handleUpdateSidebar = (event: CustomEvent<ThinkingContent>) => {
        console.log("LeftSidebar not included. Event data:", event.detail);
      };

      window.addEventListener(
        "updateSidebar" as any,
        handleUpdateSidebar as EventListener
      );
      return () =>
        window.removeEventListener(
          "updateSidebar" as any,
          handleUpdateSidebar as EventListener
        );
    }
  }, []);

  useEffect(() => {
    if (!config.includeRightSidebar) {
      const handleUpdateRagSources = (event: CustomEvent) => {
        console.log("RightSidebar not included. RAG sources:", event.detail);
      };

      window.addEventListener(
        "updateRagSources" as any,
        handleUpdateRagSources as EventListener
      );
      return () =>
        window.removeEventListener(
          "updateRagSources" as any,
          handleUpdateRagSources as EventListener
        );
    }
  }, []);

  const decodeDebugData = (response: Response) => {
    const debugData = response.headers.get("X-Debug-Data");
    if (debugData) {
      try {
        const parsed = JSON.parse(debugData);
        console.log("🔍 Server Debug:", parsed.msg, parsed.data);
      } catch (e) {
        console.error("Debug decode failed:", e);
      }
    }
  };

  const logDuration = (label: string, duration: number) => {
    console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement> | string
  ) => {
    if (typeof event !== "string") {
      event.preventDefault();
    }
    if (!showHeader) setShowHeader(true);
    if (!showAvatar) setShowAvatar(true);
    setIsLoading(true);

    const clientStart = performance.now();
    console.log("🔄 Starting request: " + new Date().toISOString());

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: typeof event === "string" ? event : input,
      attachment: selectedScreenshot
        ? {
            file_name: selectedScreenshot.name,
            file_type: selectedScreenshot.type,
            attached: true,
          }
        : {
            file_name: "",
            file_type: "",
            attached: false,
          },
    };

    const placeholderMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: JSON.stringify({
        response: "",
        thinking: "AI is processing...",
        user_mood: "neutral",
        debug: {
          context_used: false,
        },
      }),
    };

    let screenshotPayload = null;

    if (selectedScreenshot) {
      screenshotPayload = {
        file_name: selectedScreenshot.name,
        file_type: selectedScreenshot.type,
        content_base64: await fileToBase64(selectedScreenshot),
      };
    }

    setMessages((prevMessages) => [
      ...prevMessages,
      userMessage,
      placeholderMessage,
    ]);
    setInput("");
    setSelectedScreenshot(null);

    const placeholderDisplayed = performance.now();
    logDuration("Perceived Latency", placeholderDisplayed - clientStart);

    try {
      console.log("➡️ Sending message to API:", userMessage.content);
      const startTime = performance.now();
      console.log("FRONTEND SCREENSHOT PAYLOAD:", {
        hasScreenshot: !!screenshotPayload,
        fileName: screenshotPayload?.file_name || "",
        fileType: screenshotPayload?.file_type || "",
        hasBase64: !!screenshotPayload?.content_base64,
      });

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          model: selectedModel,
          knowledgeBaseId: selectedKnowledgeBase,
          screenshot: screenshotPayload
            ? {
                file_name: screenshotPayload.file_name,
                file_type: screenshotPayload.file_type,
                attached: true,
              }
            : {
                file_name: "",
                file_type: "",
                attached: false,
              },
          screenshot_file: screenshotPayload,
        }),
      });

      const responseReceived = performance.now();
      logDuration("Full Round Trip", responseReceived - startTime);
      logDuration("Network Duration", responseReceived - startTime);

      decodeDebugData(response);

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      const endTime = performance.now();
      logDuration("JSON Parse Duration", endTime - responseReceived);
      logDuration("Total API Duration", endTime - startTime);
      console.log("⬅️ Received response from API:", data);

      const suggestedQuestionsHeader = response.headers.get(
        "x-suggested-questions"
      );
      if (suggestedQuestionsHeader) {
        data.suggested_questions = JSON.parse(suggestedQuestionsHeader);
      }

      const ragHeader = response.headers.get("x-rag-sources");
      if (ragHeader) {
        const ragProcessed = performance.now();
        logDuration("🔍 RAG Processing Duration", ragProcessed - responseReceived);
        const sources = JSON.parse(ragHeader);
        window.dispatchEvent(
          new CustomEvent("updateRagSources", {
            detail: {
              sources,
              query: userMessage.content,
              debug: data.debug,
            },
          })
        );
      }

      const readyToRender = performance.now();
      logDuration("Response Processing", readyToRender - responseReceived);

      setMessages((prevMessages) => {
        const newMessages = [...prevMessages];
        const lastIndex = newMessages.length - 1;
        newMessages[lastIndex] = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: JSON.stringify(data),
        };
        return newMessages;
      });

      const sidebarEvent = new CustomEvent("updateSidebar", {
        detail: {
          id: data.id,
          content: data.thinking?.trim(),
          user_mood: data.user_mood,
          debug: data.debug,
          matched_categories: data.matched_categories,
        },
      });
      window.dispatchEvent(sidebarEvent);

      if (data.redirect_to_agent && data.redirect_to_agent.should_redirect) {
        window.dispatchEvent(
          new CustomEvent("agentRedirectRequested", {
            detail: data.redirect_to_agent,
          })
        );
      }
    } catch (error) {
      console.error("Error fetching chat response:", error);
      console.error("Failed to process message:", userMessage.content);
    } finally {
      setIsLoading(false);
      const clientEnd = performance.now();
      logDuration("Total Client Operation", clientEnd - clientStart);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() !== "") {
        handleSubmit(e as any);
      }
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = event.target;
    setInput(textarea.value);

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 300)}px`;
  };

  const handleSuggestedQuestionClick = (question: string) => {
    handleSubmit(question);
  };

  useEffect(() => {
    const handleToolExecution = (event: Event) => {
      const customEvent = event as CustomEvent<{
        ui: { type: string; props: any };
      }>;
      console.log("Tool execution event received:", customEvent.detail);
    };

    window.addEventListener("toolExecution", handleToolExecution);
    return () =>
      window.removeEventListener("toolExecution", handleToolExecution);
  }, []);

  return (
    <Card className="m-4 flex h-full min-h-0 flex-col">
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pt-4 pb-0">
        <ConversationHeader
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          models={models}
          showAvatar={showAvatar}
          selectedKnowledgeBase={selectedKnowledgeBase}
          setSelectedKnowledgeBase={setSelectedKnowledgeBase}
          knowledgeBases={knowledgeBases}
        />
        <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full animate-fade-in-up">
              <Avatar className="w-10 h-10 mb-4 border">
                <AvatarImage
                  src="/ant-logo.svg"
                  alt="AI Assistant Avatar"
                  width={40}
                  height={40}
                />
                <AvatarFallback>AI</AvatarFallback>
              </Avatar>
              <h2 className="text-2xl font-semibold mb-8">
                Here&apos;s how I can help
              </h2>
              <div className="space-y-4 text-sm">
                <div className="flex items-center gap-3">
                  <HandHelping className="text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Need guidance? I&apos;ll help navigate tasks using internal
                    resources.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <WandSparkles className="text-muted-foreground" />
                  <p className="text-muted-foreground">
                    I&apos;m a whiz at finding information! I can dig through
                    your knowledge base.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <BookOpenText className="text-muted-foreground" />
                  <p className="text-muted-foreground">
                    I&apos;m always learning! The more you share, the better I
                    can assist you.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div key={message.id}>
                  <div
                    className={`flex items-start gap-2 ${
                      message.role === "user" ? "justify-end" : ""
                    } ${
                      index === messages.length - 1 ? "animate-fade-in-up" : ""
                    }`}
                    style={{
                      animationDuration: "300ms",
                      animationFillMode: "backwards",
                    }}
                  >
                    {message.role === "assistant" && (
                      <Avatar className="w-8 h-8 border shrink-0">
                        <AvatarImage
                          src="/ant-logo.svg"
                          alt="AI Assistant Avatar"
                        />
                        <AvatarFallback>AI</AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={`p-3 rounded-md text-sm max-w-[75%] ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted border"
                      }`}
                    >
                      <MessageContent
                        content={message.content}
                        role={message.role}
                      />
                    </div>
                  </div>
                  {message.role === "assistant" &&
                    (() => {
                      try {
                        const parsed = JSON.parse(message.content);
                        console.log(
                          "💡 Suggested Questions:",
                          parsed.suggested_questions
                        );

                        return (
                          <SuggestedQuestions
                            questions={parsed.suggested_questions || []}
                            onQuestionClick={handleSuggestedQuestionClick}
                            isLoading={isLoading}
                          />
                        );
                      } catch (e) {
                        console.warn(
                          "❌ Failed to parse suggested questions",
                          e
                        );
                        return null;
                      }
                    })()}
                </div>
              ))}
              <div ref={messagesEndRef} style={{ height: "1px" }} />
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <form
          onSubmit={handleSubmit}
          className="relative flex w-full flex-col overflow-hidden rounded-xl border bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
        >
          <Textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your message here..."
            disabled={isLoading}
            className="min-h-[44px] resize-none rounded-xl border-0 bg-background p-3 shadow-none focus-visible:ring-0"
            rows={1}
          />

          {selectedScreenshot && (
            <div className="px-3 pb-1 text-xs text-muted-foreground">
              Attached: {selectedScreenshot.name}
            </div>
          )}

          <div className="flex items-center justify-between px-3 pb-3 pt-2">
            <label className="cursor-pointer rounded-md border px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-muted">
              📎 Attach Screenshot
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleScreenshotChange}
              />
            </label>

            <Button
              type="submit"
              disabled={isLoading || input.trim() === ""}
              className="shrink-0 px-4"
              size="sm"
            >
              {isLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-t-2 border-white" />
              ) : (
                <>Send</>
              )}
            </Button>
          </div>
        </form>
      </CardFooter>
    </Card>
  );
}

export default ChatArea;
