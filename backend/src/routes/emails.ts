import { Router } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { pool } from "../db";
import { config } from "../config";
import { requireAuth, userOf } from "../auth";
import { emailQueue, jobIdFor } from "../queue";
import { ensureSenders } from "../services/senders";
import { indexEmails, searchEmails } from "../services/search";
import type { RowDataPacket } from "mysql2";

const router = Router();
router.use(requireAuth);

const scheduleSchema = z.object({
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  recipients: z.array(z.string().email()).min(1).max(50_000),
  startTime: z.string().datetime({ offset: true }),
  delaySeconds: z.number().min(0).default(2),
  hourlyLimit: z.number().int().min(1).optional(),
});

router.post("/schedule", async (req, res) => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  const { subject, body, recipients, startTime, delaySeconds, hourlyLimit } = parsed.data;
  const user = userOf(req);

  const senders = await ensureSenders();
  const start = new Date(startTime).getTime();
  const batchId = randomUUID();

  // Spread across senders round-robin; each email i goes out at start + i * delay.
  const values = recipients.map((to, i) => [
    user.id, senders[i % senders.length].id, batchId, to, subject, body,
    new Date(start + i * delaySeconds * 1000), hourlyLimit ?? config.maxPerHourPerSender,
  ]);

  // Chunked bulk insert: 1000+ emails is one round trip per 500 rows, not one per email.
  const ids: number[] = [];
  for (let i = 0; i < values.length; i += 500) {
    const chunk = values.slice(i, i + 500);
    const [r] = await pool.query<any>(
      "INSERT INTO emails (user_id, sender_id, batch_id, to_email, subject, body, scheduled_at, hourly_limit) VALUES ?",
      [chunk]
    );
    for (let k = 0; k < chunk.length; k++) ids.push(r.insertId + k);
  }

  // Delayed jobs with deterministic jobId: persisted in Redis, survive restarts, never duplicated.
  await emailQueue.addBulk(
    ids.map((id, i) => ({
      name: "send",
      data: { emailId: id },
      opts: { jobId: jobIdFor(id), delay: Math.max(0, (values[i][6] as Date).getTime() - Date.now()) },
    }))
  );

  await indexEmails(ids.map((id, i) => ({
    id, userId: user.id, to: recipients[i], subject, body, status: "scheduled", scheduledAt: values[i][6] as Date,
  })));

  res.status(201).json({ batchId, count: ids.length });
});

router.get("/", async (req, res) => {
  const user = userOf(req);
  const q = String(req.query.q ?? "").trim();
  const view = req.query.status === "sent" ? "sent" : "scheduled";
  const statuses = view === "sent" ? ["sent", "failed"] : ["scheduled", "processing"];

  let idFilter: number[] | null = null;
  if (q) {
    try {
      const results = await searchEmails(user.id, q);
      idFilter = results.map((d) => d.id);
    } catch {
      idFilter = null;
    }
  }

  const params: any[] = [user.id, statuses];
  let sql = `SELECT id, to_email AS \`to\`, subject, scheduled_at AS scheduledAt, sent_at AS sentAt, status, preview_url AS previewUrl
             FROM emails WHERE user_id=? AND status IN (?)`;
  if (idFilter !== null) {
    if (!idFilter.length) return res.json([]);
    sql += " AND id IN (?)";
    params.push(idFilter);
  } else if (q) {
    sql += " AND (subject LIKE ? OR to_email LIKE ? OR body LIKE ?)";
    const pattern = `%${q}%`;
    params.push(pattern, pattern, pattern);
  }
  sql += view === "sent" ? " ORDER BY sent_at DESC, id DESC LIMIT 500" : " ORDER BY scheduled_at ASC LIMIT 500";
  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  res.json(rows);
});

export default router;
