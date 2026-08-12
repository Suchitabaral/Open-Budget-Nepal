import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/http';

export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

export function positiveInteger(value: unknown, name: string, fallback?: number, max?: number) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new HttpError(400, `${name} must be a positive integer.`);
  const parsed = Number(value);
  if (parsed < 1 || (max !== undefined && parsed > max)) {
    throw new HttpError(400, `${name} must be between 1 and ${max ?? 'the supported maximum'}.`);
  }
  return parsed;
}

export function enumValue<T extends string>(value: unknown, name: string, allowed: readonly T[]) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new HttpError(400, `${name} must be one of: ${allowed.join(', ')}.`);
  }
  return value as T;
}

export function stringValue(value: unknown, name: string, maxLength = 200) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new HttpError(400, `${name} must be a non-empty string of at most ${maxLength} characters.`);
  }
  return value.trim();
}

export function integerId(value: unknown, name = 'id') {
  if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) < 1) throw new HttpError(400, `${name} must be a positive integer.`);
  return Number(value);
}

export function pagination(query: Request['query']) {
  const page = positiveInteger(query.page, 'page', 1);
  const limit = positiveInteger(query.limit, 'limit', DEFAULT_LIMIT, MAX_LIMIT);
  return { page, limit, skip: (page - 1) * limit };
}

export function collection<T>(data: T[], page: number, limit: number, total: number, meta: Record<string, unknown> = {}) {
  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }, meta };
}

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
export const PUBLIC_RATE_LIMIT = 120;

export function publicRateLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  const key = req.ip ?? 'unknown';
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  const remaining = Math.max(0, PUBLIC_RATE_LIMIT - bucket.count);
  res.setHeader('RateLimit-Limit', PUBLIC_RATE_LIMIT);
  res.setHeader('RateLimit-Remaining', remaining);
  res.setHeader('RateLimit-Reset', Math.ceil(bucket.resetAt / 1000));
  if (bucket.count > PUBLIC_RATE_LIMIT) {
    res.setHeader('Retry-After', Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)));
    res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again after the indicated delay.', details: [] } });
    return;
  }
  next();
}
