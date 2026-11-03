import { Router, Request } from "express";
import { OAuth2Client } from "google-auth-library";
import { config } from "../config";
import { pool } from "../db";
import { requireAuth, signToken, userOf } from "../auth";
import type { RowDataPacket } from "mysql2";

const router = Router();

function getCallbackUrl(req: Request): string {
  const host = req.get("host") || "";
  if (host.includes("localhost") || String(req.headers["x-forwarded-host"]).includes("localhost")) {
    return `http://localhost:${config.port}/auth/google/callback`;
  }
  if (config.backendUrl && config.backendUrl !== "http://localhost:4000") {
    return `${config.backendUrl}/auth/google/callback`;
  }
  return "https://outbox-ky91.onrender.com/auth/google/callback";
}

function getFrontendUrl(req: Request): string {
  if (config.frontendUrl && config.frontendUrl !== "http://localhost:5173") {
    return config.frontendUrl;
  }
  const host = req.get("host") || "";
  const fwdHost = String(req.headers["x-forwarded-host"] || "");
  if (host.includes("localhost") || fwdHost.includes("localhost")) {
    return "http://localhost:5173";
  }
  return "https://outbox-ebon.vercel.app";
}

router.get("/google", (req, res) => {
  if (!config.google.clientId || !config.google.clientSecret) {
    console.warn("[auth] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing.");
    return res.redirect(`${getFrontendUrl(req)}/?error=google_credentials_missing`);
  }
  const callbackUrl = getCallbackUrl(req);
  const client = new OAuth2Client(config.google.clientId, config.google.clientSecret, callbackUrl);
  const url = client.generateAuthUrl({
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
    redirect_uri: callbackUrl,
  });
  res.redirect(url);
});

router.get("/dev-login", async (req, res) => {
  const frontendBase = getFrontendUrl(req);
  try {
    const demoEmail = "demo@outboxlabs.ai";
    const demoName = "Outbox Labs Demo";
    await pool.query(
      `INSERT INTO users (google_id, email, name, avatar) VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE email=VALUES(email), name=VALUES(name)`,
      ["demo-user-id", demoEmail, demoName, null]
    );
    const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM users WHERE google_id=?", ["demo-user-id"]);
    const u = rows[0];
    const token = signToken({ id: u.id, email: u.email, name: u.name, avatar: u.avatar });
    res.cookie("token", token, { httpOnly: true, sameSite: "none", secure: true, maxAge: 7 * 86400_000 });
    res.redirect(`${frontendBase}/dashboard?token=${token}`);
  } catch (e) {
    console.error("[dev-auth]", e);
    res.redirect(`${frontendBase}/?error=dev_login_failed`);
  }
});

router.get("/google/callback", async (req, res) => {
  const frontendBase = getFrontendUrl(req);
  try {
    const callbackUrl = getCallbackUrl(req);
    const client = new OAuth2Client(config.google.clientId, config.google.clientSecret, callbackUrl);
    const { tokens } = await client.getToken({
      code: String(req.query.code),
      redirect_uri: callbackUrl,
    });
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
    res.cookie("token", token, { httpOnly: true, sameSite: "none", secure: true, maxAge: 7 * 86400_000 });
    res.redirect(`${frontendBase}/dashboard?token=${token}`);
  } catch (e) {
    console.error("[auth]", e);
    res.redirect(`${frontendBase}/?error=login_failed`);
  }
});

router.get("/me", requireAuth, (req, res) => res.json(userOf(req)));

router.post("/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

export default router;
