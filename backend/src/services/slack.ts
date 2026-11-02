import { pool } from "../db";
import type { RowDataPacket } from "mysql2";

/** If the user has not connected Slack we simply return - no crash, no log spam. */
export async function notifySlack(userId: number, text: string) {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT webhook_url FROM slack_connections WHERE user_id=?", [userId]
    );
    if (!rows.length) return false;
    const res = await fetch(rows[0].webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return res.ok;
  } catch (e) {
    console.warn("[slack] notify failed:", (e as Error).message);
    return false;
  }
}
