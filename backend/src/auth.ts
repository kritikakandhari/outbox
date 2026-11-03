import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "./config";

export interface AuthUser { id: number; email: string; name: string; avatar: string | null }

export const signToken = (u: AuthUser) => jwt.sign(u, config.jwtSecret, { expiresIn: "7d" });

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const token = req.cookies?.token || bearerToken;
    if (!token) return res.status(401).json({ error: "Not authenticated" });
    (req as any).user = jwt.verify(token, config.jwtSecret) as AuthUser;
    next();
  } catch {
    res.status(401).json({ error: "Invalid session" });
  }
}

export const userOf = (req: Request) => (req as any).user as AuthUser;
