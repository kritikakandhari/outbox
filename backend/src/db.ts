import mysql from "mysql2/promise";
import { config } from "./config";

export const pool = mysql.createPool({ ...config.db, connectionLimit: 20, dateStrings: false });

export async function migrate() {
  // Create DB if missing
  const root = await mysql.createConnection({ ...config.db, database: undefined });
  await root.query(`CREATE DATABASE IF NOT EXISTS \`${config.db.database}\``);
  await root.end();

  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    google_id VARCHAR(64) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar VARCHAR(512) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS senders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    smtp_user VARCHAR(255) NOT NULL,
    smtp_pass VARCHAR(255) NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INT NOT NULL
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS emails (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    sender_id INT NOT NULL,
    batch_id VARCHAR(36) NOT NULL,
    to_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body MEDIUMTEXT NOT NULL,
    scheduled_at DATETIME(3) NOT NULL,
    sent_at DATETIME(3) NULL,
    status ENUM('scheduled','processing','sent','failed') NOT NULL DEFAULT 'scheduled',
    hourly_limit INT NULL,
    preview_url VARCHAR(512) NULL,
    error TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_status (user_id, status, scheduled_at),
    INDEX idx_status (status)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS slack_connections (
    user_id INT PRIMARY KEY,
    webhook_url VARCHAR(512) NOT NULL,
    team_name VARCHAR(255) NULL,
    channel VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
}
