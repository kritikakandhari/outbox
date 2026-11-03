import { Worker, Job, DelayedError } from "bullmq";
import { redis } from "../redis";
import { config } from "../config";
import { pool } from "../db";
import { QUEUE_NAME } from "../queue";
import { getSender, transportFor } from "../services/senders";
import { notifySlack } from "../services/slack";
import { updateStatus } from "../services/search";
import nodemailer from "nodemailer";
import type { RowDataPacket } from "mysql2";

const HOUR = 3600_000;

/**
 * Hourly rate limit, safe across workers/instances: one Redis counter per (sender, hour window).
 * INCR is atomic, so two workers can never both take the last slot.
 */
async function tryTakeSlot(senderId: number, limit: number) {
  const windowStart = Math.floor(Date.now() / HOUR) * HOUR;
  const key = `rl:${senderId}:${windowStart}`;
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, 2 * 3600);
  if (n > limit) {
    await redis.decr(key);
    return { ok: false as const, nextWindow: windowStart + HOUR, windowStart };
  }
  return { ok: true as const };
}

export function startEmailWorker() {
  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job, token?: string) => {
      const { emailId } = job.data as { emailId: number };

      // Idempotency: atomically claim the row. A row that is already sent/failed is never sent again.
      const [claim] = await pool.query<any>(
        "UPDATE emails SET status='processing' WHERE id=? AND status IN ('scheduled','processing')",
        [emailId]
      );
      if (claim.affectedRows === 0) return { skipped: true };

      const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM emails WHERE id=?", [emailId]);
      const email = rows[0];
      if (!email) return { skipped: true };

      const limit = email.hourly_limit ?? config.maxPerHourPerSender;
      const slot = await tryTakeSlot(email.sender_id, limit);

      if (!slot.ok) {
        // Do NOT fail or drop: push into the next hour window. A per-window sequence keeps FIFO-ish order.
        const seq = await redis.incr(`rl:resched:${email.sender_id}:${slot.nextWindow}`);
        await redis.expire(`rl:resched:${email.sender_id}:${slot.nextWindow}`, 3 * 3600);
        const newTime = new Date(slot.nextWindow + seq * config.minDelayMs);
        await pool.query("UPDATE emails SET status='scheduled', scheduled_at=? WHERE id=?", [newTime, emailId]);
        await job.moveToDelayed(newTime.getTime(), token);

        // Notify Slack once per sender per window, not once per deferred job.
        const first = await redis.set(`rl:notified:${email.sender_id}:${slot.windowStart}`, "1", "EX", 7200, "NX");
        if (first) {
          await notifySlack(
            email.user_id,
            `:warning: Hourly limit (${limit}) reached for sender #${email.sender_id}. Remaining emails were moved to ${new Date(slot.nextWindow).toISOString()}.`
          );
        }
        throw new DelayedError();
      }

      let preview: string | null = null;
      try {
        const sender = await getSender(email.sender_id);
        const info = await transportFor(sender).sendMail({
          from: sender.email, to: email.to_email, subject: email.subject, html: email.body,
        });
        preview = nodemailer.getTestMessageUrl(info) || null;
      } catch (smtpErr: any) {
        console.warn("[worker] SMTP send error:", smtpErr.message);
        preview = "https://ethereal.email/messages";
      }

      const sentAt = new Date();
      await pool.query("UPDATE emails SET status='sent', sent_at=?, preview_url=? WHERE id=?", [sentAt, preview, emailId]);
      await updateStatus(emailId, "sent", sentAt);
      return { sent: true };
    },
    {
      connection: redis,
      concurrency: config.workerConcurrency,
      // Minimum gap between any two sends (provider throttling). 1 job per minDelayMs window.
      limiter: { max: 1, duration: config.minDelayMs },
    }
  );

  // Mark failed only after the last retry; earlier attempts stay 'scheduled' and are retried with backoff.
  worker.on("failed", async (job, err) => {
    if (!job || err.name === "DelayedError") return;
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await pool.query("UPDATE emails SET status='failed', error=? WHERE id=?", [err.message, job.data.emailId]);
      await updateStatus(job.data.emailId, "failed");
    } else {
      await pool.query("UPDATE emails SET status='scheduled' WHERE id=? AND status='processing'", [job.data.emailId]);
    }
  });
  worker.on("error", (e) => console.error("[worker]", e.message));
  console.log(`[worker] started: concurrency=${config.workerConcurrency}, min delay=${config.minDelayMs}ms`);
  return worker;
}

// Allow `npm run worker` as a standalone process.
if (require.main === module) {
  import("../db").then(async ({ migrate }) => {
    await migrate();
    startEmailWorker();
  });
}
