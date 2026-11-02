import type { EmailRow, ScheduleInput, SlackStatus, User } from "./types";

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  }
  return res.json();
}

export const api = {
  me: () => request<User>("/auth/me"),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  emails: (status: "scheduled" | "sent", q = "") =>
    request<EmailRow[]>(`/api/emails?status=${status}${q ? `&q=${encodeURIComponent(q)}` : ""}`),
  schedule: (input: ScheduleInput) =>
    request<{ batchId: string; count: number }>("/api/emails/schedule", { method: "POST", body: JSON.stringify(input) }),
  slackStatus: () => request<SlackStatus>("/api/slack/status"),
  slackDisconnect: () => request<{ ok: true }>("/api/slack/disconnect", { method: "POST" }),
};
