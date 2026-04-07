import type { CloudProvider, TicketDraft } from "./types";

export function determineCloudProvider(ticketDraft: TicketDraft): CloudProvider {
  const summary = String(ticketDraft?.summary || "").toLowerCase();
  const description = String(ticketDraft?.description || "").toLowerCase();
  const affectedSystem = String(
    ticketDraft?.metadata?.affected_system || "",
  ).toLowerCase();
  const errorCondition = String(
    ticketDraft?.error_condition || "",
  ).toLowerCase();
  const errorDescription = String(
    ticketDraft?.error_description || "",
  ).toLowerCase();

  const combinedText = [
    summary,
    description,
    affectedSystem,
    errorCondition,
    errorDescription,
  ].join(" ");

  if (
    combinedText.includes("aws") ||
    combinedText.includes("ec2") ||
    combinedText.includes("eks") ||
    combinedText.includes("ecs") ||
    combinedText.includes("lambda") ||
    combinedText.includes("rds") ||
    combinedText.includes("cloudfront") ||
    combinedText.includes("s3") ||
    combinedText.includes("iam role") ||
    combinedText.includes("bedrock")
  ) {
    return "aws";
  }

  if (
    combinedText.includes("azure") ||
    combinedText.includes("entra") ||
    combinedText.includes("aad") ||
    combinedText.includes("azure devops") ||
    combinedText.includes("aks") ||
    combinedText.includes("app service") ||
    combinedText.includes("function app") ||
    combinedText.includes("blob storage")
  ) {
    return "azure";
  }

  if (
    combinedText.includes("gcp") ||
    combinedText.includes("google cloud") ||
    combinedText.includes("gke") ||
    combinedText.includes("cloud run") ||
    combinedText.includes("bigquery") ||
    combinedText.includes("pub/sub") ||
    combinedText.includes("cloud storage")
  ) {
    return "gcp";
  }

  return "unknown";
}