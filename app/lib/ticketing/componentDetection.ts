import type { TicketDraft } from "./types";

export type ComponentType =
  | "auth"
  | "frontend"
  | "api"
  | "database"
  | "network"
  | "infra"
  | "data"
  | "unknown";

export function determineComponentType(ticketDraft: TicketDraft): ComponentType {
  const text = [
    ticketDraft.summary || "",
    ticketDraft.description || "",
    ticketDraft.error_condition || "",
    ticketDraft.error_description || "",
    ticketDraft.metadata?.affected_system || "",
    ticketDraft.category || "",
    ticketDraft.subcategory || "",
  ]
    .join(" ")
    .toLowerCase();

  if (
    text.includes("login") ||
    text.includes("password") ||
    text.includes("mfa") ||
    text.includes("sso") ||
    text.includes("entra") ||
    text.includes("azure ad") ||
    text.includes("authentication") ||
    text.includes("authorization")
  ) {
    return "auth";
  }

  if (
    text.includes("ui") ||
    text.includes("frontend") ||
    text.includes("page") ||
    text.includes("portal") ||
    text.includes("button") ||
    text.includes("screen") ||
    text.includes("browser")
  ) {
    return "frontend";
  }

  if (
    text.includes("api") ||
    text.includes("endpoint") ||
    text.includes("gateway") ||
    text.includes("service call") ||
    text.includes("backend")
  ) {
    return "api";
  }

  if (
    text.includes("database") ||
    text.includes("sql") ||
    text.includes("rds") ||
    text.includes("postgres") ||
    text.includes("mysql") ||
    text.includes("query failed") ||
    text.includes("db")
  ) {
    return "database";
  }

  if (
    text.includes("alb") ||
    text.includes("load balancer") ||
    text.includes("dns") ||
    text.includes("network") ||
    text.includes("vpn") ||
    text.includes("timeout") ||
    text.includes("connection refused")
  ) {
    return "network";
  }

  if (
    text.includes("ecs") ||
    text.includes("eks") ||
    text.includes("ec2") ||
    text.includes("cloudfront") ||
    text.includes("deployment") ||
    text.includes("container") ||
    text.includes("infra") ||
    text.includes("aws")
  ) {
    return "infra";
  }

  if (
    text.includes("etl") ||
    text.includes("pipeline") ||
    text.includes("warehouse") ||
    text.includes("dashboard") ||
    text.includes("report") ||
    text.includes("data")
  ) {
    return "data";
  }

  return "unknown";
}