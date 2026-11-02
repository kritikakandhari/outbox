import nodemailer from "nodemailer";
import { pool } from "../db";
import { config } from "../config";
import type { RowDataPacket } from "mysql2";

export interface Sender extends RowDataPacket {
  id: number; email: string; smtp_user: string; smtp_pass: string; host: string; port: number;
}

/** Creates Ethereal accounts once and keeps them in MySQL, so restarts reuse the same senders. */
export async function ensureSenders() {
  const [rows] = await pool.query<Sender[]>("SELECT * FROM senders");
  for (let i = rows.length; i < config.senderCount; i++) {
    const acc = await nodemailer.createTestAccount();
    await pool.query(
      "INSERT INTO senders (email, smtp_user, smtp_pass, host, port) VALUES (?,?,?,?,?)",
      [acc.user, acc.user, acc.pass, acc.smtp.host, acc.smtp.port]
    );
  }
  const [all] = await pool.query<Sender[]>("SELECT * FROM senders ORDER BY id");
  return all;
}

export async function getSender(id: number) {
  const [rows] = await pool.query<Sender[]>("SELECT * FROM senders WHERE id=?", [id]);
  return rows[0];
}

export function transportFor(s: Sender) {
  return nodemailer.createTransport({
    host: s.host, port: s.port, secure: false,
    auth: { user: s.smtp_user, pass: s.smtp_pass },
  });
}
