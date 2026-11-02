import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { config } from "../config";
import { pool } from "../db";
import { requireAuth, signToken, userOf } from "../auth";
import type { RowDataPacket } from "mysql2";

const router = Router();
const client = new OAuth2Client(
  config.google.clientId,
  config.google.clientSecret,
  `${config.backendUrl}/auth/google/callback`
);

router.get("/google", (_req, res) => {
  const url = client.generateAuthUrl({ scope: ["openid", "email", "profile"], prompt: "select_account" });
  res.redirect(url);
});

router.get("/dev-login", async (_req, res) => {
  try {
    const demoEmail = "demo@reachinbox.ai";
    const demoName = "ReachInbox Demo";
    await pool.query(
      `INSERT INTO users (google_id, email, name, avatar) VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE email=VALUES(email), name=VALUES(name)`,
      ["demo-user-id", demoEmail, demoName, null]
    );
    const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM users WHERE google_id=?", ["demo-user-id"]);
    const u = rows[0];
    const token = signToken({ id: u.id, email: u.email, name: u.name, avatar: u.avatar });
    res.cookie("token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 86400_000 });
    res.redirect(`${config.frontendUrl}/dashboard`);
  } catch (e) {
    console.error("[dev-auth]", e);
    res.redirect(`${config.frontendUrl}/?error=dev_login_failed`);
  }
});

router.get("/google/callback", async (req, res) => {
  try {
    const { tokens } = await client.getToken(String(req.query.code));
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token!, audience: config.google.clientId });
    const p = ticket.getPayload()!;
    await pool.query(
      `INSERT INTO users (google_id, email, name, avatar) VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE email=VALUES(email), name=VALUES(name), avatar=VALUES(avatar)`,
      [p.sub, p.email, p.name, p.picture ?? null]
    );
    const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM users WHERE google_id=?", [p.sub]);
    const u = rows[0];
    const token = signToken({ id: u.id, email: u.email, name: u.name, avatar: u.avatar });
    res.cookie("token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 86400_000 });
    res.redirect(`${config.frontendUrl}/dashboard`);
  } catch (e) {
    console.error("[auth]", e);
    res.redirect(`${config.frontendUrl}/?error=login_failed`);
  }
});

router.get("/me", requireAuth, (req, res) => res.json(userOf(req)));

router.post("/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

export default router;
