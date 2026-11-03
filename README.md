# Outbox Scheduler — [Outbox Labs](https://www.outboxlabs.ai/)

Full-Stack Email Job Scheduler built for **[Outbox Labs](https://www.outboxlabs.ai/)**. Schedules emails through a clean dashboard and sends them on time with **BullMQ delayed jobs + Redis** (no cron), through **Ethereal SMTP**. Emails live in **MySQL** (TiDB Cloud Serverless), are searchable in **Elasticsearch**, and queue execution is monitored live via **Bull Board**.

## 🌐 Live Hosted Deployment
- **Frontend Dashboard**: [https://outbox-ebon.vercel.app/](https://outbox-ebon.vercel.app/)
- **Backend API**: [https://outbox-ky91.onrender.com](https://outbox-ky91.onrender.com)
- **Live BullMQ Queue Monitor**: [https://outbox-ky91.onrender.com/admin/queues](https://outbox-ky91.onrender.com/admin/queues)

*(Includes a **One-Click Demo Login** on the login screen for instant evaluation without requiring Google Cloud OAuth credentials).*

## Run it

Prerequisites: Node 20+, Docker.

```bash
docker compose up -d            # Redis, MySQL, Elasticsearch

cd backend
cp .env.example .env            # fill Google + Slack credentials (below)
npm install
npm run dev                     # API + worker on :4000

cd ../frontend
npm install
npm run dev                     # dashboard on :5173
```

Open http://localhost:5173. Queue monitor: http://localhost:4000/admin/queues (login required).

To run the worker as a separate process: set `RUN_WORKER_IN_API=false`, then `npm run worker` in `backend/`.

### Ethereal (fake SMTP)
Nothing to configure. On first start the backend calls `nodemailer.createTestAccount()` `SENDER_COUNT` times and stores the accounts in the `senders` table, so restarts reuse the same senders. Each sent row stores a **preview URL** (shown as "preview" in the Sent tab) to open the message on ethereal.email.

### Google login
Google Cloud Console -> OAuth client (Web). Authorized redirect URI: `http://localhost:4000/auth/google/callback`. Put the ID/secret in `.env`.

### Slack
api.slack.com/apps -> create app -> OAuth & Permissions. Redirect URL: `http://localhost:4000/api/slack/callback`. Bot-less scope: `incoming-webhook` (user scope not needed). Put client ID/secret in `.env`. Slack may require an HTTPS redirect URL; use a tunnel such as ngrok and set `BACKEND_URL` to it.

## Configuration (all via `.env`)
| Variable | Meaning |
|---|---|
| `WORKER_CONCURRENCY` | Parallel jobs per worker |
| `MIN_DELAY_BETWEEN_EMAILS_MS` | Minimum gap between sends (default **2000 ms**) |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | Default hourly cap per sender (default **200**); the compose form can override per batch |
| `SENDER_COUNT` | Number of Ethereal senders (default 3) |

## Architecture

**Scheduling.** `POST /api/emails/schedule` bulk-inserts rows (status `scheduled`) in MySQL, assigns senders round-robin, then adds one BullMQ **delayed job** per email (`delay = scheduledAt - now`). Email *i* of a batch is scheduled at `start + i * delay`.

**Persistence on restart.** Delayed jobs live in Redis (AOF enabled in `docker-compose.yml`), the source of truth for content/status is MySQL. After a restart the worker reconnects and the delayed jobs fire at the original time. On boot, `reconcilePending()` re-adds jobs for any `scheduled`/`processing` row that has no job (for example if Redis was wiped). Nothing restarts from scratch.

**Idempotency (no duplicates).**
1. `jobId = email-<rowId>`: adding the same email twice is a no-op in BullMQ.
2. The worker claims the row with `UPDATE ... WHERE status IN ('scheduled','processing')`; rows already `sent`/`failed` are skipped.
3. Status moves to `sent` right after SMTP accepts the message.

**Concurrency.** `WORKER_CONCURRENCY` jobs run in parallel. All shared state is in Redis/MySQL (atomic `INCR`, atomic `UPDATE`), so multiple workers/instances are safe.

**Delay between emails.** BullMQ worker `limiter: { max: 1, duration: MIN_DELAY_BETWEEN_EMAILS_MS }` (default 1 send per 2 s across the queue).

**Hourly rate limit.** Redis counter per `(sender, hour window)`: key `rl:<senderId>:<windowStartMs>`, `INCR` is atomic. If the count exceeds the limit the slot is returned (`DECR`) and the job is **moved to the next hour window** with `job.moveToDelayed(...)`: never dropped or failed. Order is preserved approximately with a per-window sequence (`next window + seq * minDelay`). The DB `scheduled_at` is updated so the dashboard shows the new time.

**Slack alert.** On the first limit hit per sender per window, the backend posts to the user's Slack incoming webhook (obtained through real OAuth). One message per sender per window, not one per deferred job. If Slack isn't connected the call is skipped silently; connecting later works immediately (webhook is read from the DB at notify time).

**Behavior under load (1000+ emails at the same time).** Inserts are chunked (500 rows/query) and jobs added with `addBulk`. The limiter and per-sender hourly counters throttle sending; the overflow is rolled into later hour windows instead of failing.

**Search.** Each email is indexed in Elasticsearch on schedule and updated when sent/failed. The dashboard search box queries `GET /api/emails?q=...`. Indexing is fail-soft: if Elasticsearch is down, sending continues.

## Features
Backend: scheduler (delayed jobs, no cron) · restart persistence + reconcile · idempotency · worker concurrency · min delay · per-sender hourly limit (Redis) · multiple Ethereal senders · Elasticsearch search · Bull Board · Google OAuth + JWT cookie · Slack OAuth + alert.
Frontend: Google login · header (name, email, avatar, logout) · Scheduled / Sent tabs · Compose modal with CSV/text lead upload (shows detected count), start time, delay, hourly limit · loading skeletons, empty states, toasts · reusable UI components, typed API layer.

## Assumptions and trade-offs
- The Figma file wasn't available to me, so the UI follows the stated requirements; adjust spacing/colors to match the design.
- Sent status is written after SMTP success. If the process crashes in the tiny window between SMTP accept and the DB write, that one email can be retried (at-least-once for that edge case). A stronger guarantee would need an SMTP-side idempotency key.
- The limiter is global (queue-wide) for the minimum delay; the hourly limit is per sender.
- Retries: 3 attempts with exponential backoff, then `failed`.

## Demo checklist (5 min)
1. Log in with Google, connect Slack.
2. Compose: upload a CSV, set start in 2 min, delay 2 s, hourly limit 3 -> Schedule.
3. Show the Scheduled tab and http://localhost:4000/admin/queues.
4. Stop the backend, start it again -> emails still send on time; open the Sent tab and a preview link.
5. Show the Slack message when the hourly limit of 3 is reached and the remaining jobs moving to the next hour.
