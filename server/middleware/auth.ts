import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db.ts';
import type { PublicUser, UserRecord } from '../../src/types/ecommerce.ts';

const JWT_SECRET =
  process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length > 0
    ? process.env.JWT_SECRET
    : crypto.randomBytes(32).toString('hex');

export const WEBHOOK_SECRET =
  process.env.PAYMENT_WEBHOOK_SECRET && process.env.PAYMENT_WEBHOOK_SECRET.trim().length > 0
    ? process.env.PAYMENT_WEBHOOK_SECRET
    : crypto.randomBytes(32).toString('hex');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

export function signAuthToken(user: UserRecord): string {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: '7d',
  });
}

export function verifyAuthToken(token: string): { sub: string; email: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub?: string; email?: string };
    if (typeof decoded.sub === 'string' && typeof decoded.email === 'string') {
      return { sub: decoded.sub, email: decoded.email };
    }
    return null;
  } catch {
    return null;
  }
}

export function verifyAdminPasscode(candidate: string): boolean {
  const configured = process.env.ADMIN_PASSCODE?.trim();
  if (!configured) return false;
  const a = crypto.createHash('sha256').update(candidate).digest();
  const b = crypto.createHash('sha256').update(configured).digest();
  return crypto.timingSafeEqual(a, b);
}

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || 'customer',
    phone: user.phone,
    defaultAddress: user.defaultAddress,
    createdAt: user.createdAt,
  };
}

export interface AuthedRequest extends Request {
  user?: UserRecord;
  ownerKey?: string;
  anonymousSessionId?: string;
}

export function sanitizeSessionId(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const cleaned = raw.trim();
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(cleaned)) return undefined;
  return cleaned;
}

export function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const payload = verifyAuthToken(token);
    if (payload) {
      const user = db.userById.get(payload.sub);
      if (user) {
        req.user = user;
        req.ownerKey = `user:${user.id}`;
      }
    }
  }
  const sessionHeader = sanitizeSessionId(req.headers['x-session-id']);
  req.anonymousSessionId = sessionHeader;
  if (!req.ownerKey && sessionHeader) {
    req.ownerKey = `anon:${sessionHeader}`;
  }
  next();
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  const token = authHeader.slice(7).trim();
  const payload = verifyAuthToken(token);
  if (!payload) {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
    return;
  }
  const user = db.userById.get(payload.sub);
  if (!user) {
    res.status(401).json({ success: false, error: 'User account not found' });
    return;
  }
  req.user = user;
  req.ownerKey = `user:${user.id}`;
  req.anonymousSessionId = sanitizeSessionId(req.headers['x-session-id']);
  next();
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Administrator privileges required' });
    return;
  }
  next();
}
