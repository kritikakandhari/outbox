export interface User { id: number; email: string; name: string; avatar: string | null }

export type EmailStatus = "scheduled" | "processing" | "sent" | "failed";

export interface EmailRow {
  id: number;
  to: string;
  subject: string;
  scheduledAt: string;
  sentAt: string | null;
  status: EmailStatus;
  previewUrl: string | null;
}

export interface ScheduleInput {
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delaySeconds: number;
  hourlyLimit?: number;
}

export interface SlackStatus { connected: boolean; team: string | null; channel: string | null }
