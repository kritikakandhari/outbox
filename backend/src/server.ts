import express from "express";
import cookieParser from "cookie-parser";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { config } from "./config";
import { migrate } from "./db";
import { emailQueue } from "./queue";
import { requireAuth } from "./auth";
import { ensureSenders } from "./services/senders";
import { initSearch } from "./services/search";
import { reconcilePending } from "./services/reconcile";
import { startEmailWorker } from "./workers/emailWorker";
import authRoutes from "./routes/auth";
import emailRoutes from "./routes/emails";
import slackRoutes from "./routes/slack";

async function main() {
  await migrate();
  await ensureSenders();
  await initSearch();

  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/auth", authRoutes);
  app.use("/api/emails", emailRoutes);
  app.use("/api/slack", slackRoutes);

  // Live BullMQ dashboard (login required)
  const board = new ExpressAdapter();
  board.setBasePath("/admin/queues");
  createBullBoard({ queues: [new BullMQAdapter(emailQueue)], serverAdapter: board });
  app.use("/admin/queues", requireAuth, board.getRouter());

  if (config.runWorkerInApi) startEmailWorker();
  await reconcilePending();

  app.listen(config.port, () => console.log(`API on ${config.backendUrl}  |  Queue dashboard: ${config.backendUrl}/admin/queues`));
}

main().catch((e) => { console.error(e); process.exit(1); });
