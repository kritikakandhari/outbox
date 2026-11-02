import { Router } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { pool } from "../db";
import { requireAuth, userOf } from "../auth";
import type { RowDataPacket } from "mysql2";

const router = Router();
const redirectUri = `${config.backendUrl}/api/slack/callback`;

router.get("/status", requireAuth, async (req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT team_name, channel FROM slack_connections WHERE user_id=?", [userOf(req).id]
  );
  res.json({ connected: rows.length > 0, team: rows[0]?.team_name ?? null, channel: rows[0]?.channel ?? null });
});

// Real OAuth: send the user to Slack. `state` is a short-lived signed token that carries the user id.
router.get("/connect", requireAuth, (req, res) => {
  const state = jwt.sign({ uid: userOf(req).id }, config.jwtSecret, { expiresIn: "10m" });
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", config.slack.clientId);
  url.searchParams.set("scope", "incoming-webhook");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  res.redirect(url.toString());
});

router.get("/callback", async (req, res) => {
  try {
    const { uid } = jwt.verify(String(req.query.state), config.jwtSecret) as { uid: number };
    const body = new URLSearchParams({
      code: String(req.query.code),
      client_id: config.slack.clientId,
      client_secret: config.slack.clientSecret,
      redirect_uri: redirectUri,
    });
    const r = await fetch("https://slack.com/api/oauth.v2.access", { method: "POST", body });
    const data: any = await r.json();
    if (!data.ok) throw new Error(data.error);
    await pool.query(
      `INSERT INTO slack_connections (user_id, webhook_url, team_name, channel) VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE webhook_url=VALUES(webhook_url), team_name=VALUES(team_name), channel=VALUES(channel)`,
      [uid, data.incoming_webhook.url, data.team?.name ?? null, data.incoming_webhook.channel ?? null]
    );
    res.redirect(`${config.frontendUrl}/dashboard?slack=connected`);
  } catch (e) {
    console.error("[slack]", e);
    res.redirect(`${config.frontendUrl}/dashboard?slack=error`);
  }
});

router.post("/disconnect", requireAuth, async (req, res) => {
  await pool.query("DELETE FROM slack_connections WHERE user_id=?", [userOf(req).id]);
  res.json({ ok: true });
});

export default router;
