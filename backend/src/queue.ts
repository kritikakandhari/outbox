import { Queue } from "bullmq";
import { redis } from "./redis";

export const QUEUE_NAME = "email-queue";

export const emailQueue = new Queue(QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 24 * 3600, count: 5000 },
    removeOnFail: false,
  },
});

/** jobId = email row id -> adding the same email twice is a no-op (idempotent scheduling). */
export const jobIdFor = (emailId: number | string) => `email-${emailId}`;

export async function enqueueEmail(emailId: number, scheduledAt: Date) {
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());
  await emailQueue.add("send", { emailId }, { jobId: jobIdFor(emailId), delay });
}
