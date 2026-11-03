import type { EmailRow, ScheduleInput, SlackStatus, User } from "./types";

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  }
  return res.json();
}

export const api = {
  me: () => request<User>("/auth/me"),
  logout: () => {
    if (typeof window !== "undefined") localStorage.removeItem("auth_token");
    return request<{ ok: true }>("/auth/logout", { method: "POST" });
  },
  emails: (status: "scheduled" | "sent", q = "") =>
    request<EmailRow[]>(`/api/emails?status=${status}${q ? `&q=${encodeURIComponent(q)}` : ""}`),
  schedule: (input: ScheduleInput) =>
    request<{ batchId: string; count: number }>("/api/emails/schedule", { method: "POST", body: JSON.stringify(input) }),
  slackStatus: () => request<SlackStatus>("/api/slack/status"),
  slackDisconnect: () => request<{ ok: true }>("/api/slack/disconnect", { method: "POST" }),
  slackConnectWebhook: (webhookUrl: string) =>
    request<{ ok: true }>("/api/slack/webhook", { method: "POST", body: JSON.stringify({ webhookUrl }) }),
};
