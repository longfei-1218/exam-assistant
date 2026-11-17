import { createHmac, randomBytes } from 'node:crypto';

import { errors as joseErrors, jwtVerify, SignJWT } from 'jose';

import { env } from '../config/env.js';
import { ApiError } from '../lib/api-error.js';

const JWT_ISSUER = 'exam-assistant-api';
const JWT_AUDIENCE = 'exam-assistant-web';
const accessTokenSecret = new TextEncoder().encode(env.JWT_SECRET);

type AccessTokenUser = {
  id: string;
  email: string;
};

export type AccessTokenPayload = {
  userId: string;
  email: string;
};

export type RefreshTokenValue = {
  token: string;
  tokenHash: string;
  expiresAt: Date;
};

export function durationToSeconds(value: string): number {
  const match = /^(\d+)([smhdw])$/.exec(value.trim());
  if (!match) {
    throw new Error(`Unsupported duration: ${value}`);
  }

  const amount = Number(match[1]);
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
    w: 7 * 24 * 60 * 60,
  };

  return amount * (multipliers[match[2] ?? 's'] ?? 1);
}

export function accessTokenExpiresIn(): number {
  return durationToSeconds(env.JWT_ACCESS_TTL);
}

export async function signAccessToken(user: AccessTokenUser): Promise<string> {
  return new SignJWT({
    email: user.email,
    type: 'access',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.id)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_TTL)
    .sign(accessTokenSecret);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, accessTokenSecret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    if (
      payload.type !== 'access' ||
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string'
    ) {
      throw new ApiError(401, 'UNAUTHORIZED', '登录状态无效');
    }

    return {
      userId: payload.sub,
      email: payload.email,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof joseErrors.JWTExpired) {
      throw new ApiError(401, 'TOKEN_EXPIRED', '登录状态已过期');
    }

    throw new ApiError(401, 'UNAUTHORIZED', '登录状态无效');
  }
}

export function createRefreshToken(): RefreshTokenValue {
  const token = `rt_${randomBytes(32).toString('base64url')}`;
  const expiresAt = new Date(
    Date.now() + durationToSeconds(env.JWT_REFRESH_TTL) * 1000,
  );

  return {
    token,
    tokenHash: hashRefreshToken(token),
    expiresAt,
  };
}

export function hashRefreshToken(token: string): string {
  return createHmac('sha256', env.JWT_REFRESH_SECRET).update(token).digest('hex');
}
