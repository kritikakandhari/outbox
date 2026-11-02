import { pool } from "../db";
import { emailQueue, enqueueEmail, jobIdFor } from "../queue";
import type { RowDataPacket } from "mysql2";

/**
 * Safety net after a crash / Redis flush: re-add jobs for rows still pending.
 * Same jobId => BullMQ ignores duplicates, so this can never double-schedule.
 */
export async function reconcilePending() {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, scheduled_at FROM emails WHERE status IN ('scheduled','processing')"
  );
  let readded = 0;
  for (const r of rows) {
    const existing = await emailQueue.getJob(jobIdFor(r.id));
    if (!existing) {
      await enqueueEmail(r.id, new Date(r.scheduled_at));
      readded++;
    }
  }
  if (readded) console.log(`[reconcile] re-queued ${readded} pending emails`);
}
