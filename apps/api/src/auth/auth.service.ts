import { compare, hash } from 'bcryptjs';
import { z } from 'zod';

import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import type { User, UserLlmCredential } from '../generated/prisma/client.js';
import { ApiError } from '../lib/api-error.js';
import { encryptApiToken } from './secret-box.js';
import {
  accessTokenExpiresIn,
  createRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from './tokens.js';

const DUMMY_PASSWORD_HASH =
  '$2b$10$Z/cBqV0qCB0cak3SFZBgWOO2o2aVdlmF9XRVTbr/QEWa6kDZ/MpbO';

const emailSchema = z.string().trim().toLowerCase().email().max(320);
const passwordSchema = z.string().min(8).max(72);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  nickname: z.string().trim().min(1).max(60).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

const llmConfigSchema = z.object({
  provider: z.literal('deepseek').optional(),
  model: z.enum(['deepseek-chat', 'deepseek-pro', 'deepseek-flash']).optional(),
  apiToken: z.string().trim().max(512).nullable().optional(),
});

export const updateProfileSchema = z.object({
  nickname: z.string().trim().min(1).max(60).optional(),
  avatarUrl: z.string().trim().url().max(2048).nullable().optional(),
  llmConfig: llmConfigSchema.optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

type UserWithCredential = User & {
  llmCredential: UserLlmCredential | null;
};

type SessionUser = Pick<User, 'id' | 'email'>;

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

function defaultNickname(email: string): string {
  return (email.split('@')[0] ?? '备考人').slice(0, 60);
}

function serializeUser(user: UserWithCredential) {
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    llmConfig: {
      provider: user.llmCredential?.provider ?? env.LLM_PROVIDER,
      model: user.llmCredential?.model ?? env.LLM_MODEL,
      configured: user.llmCredential?.configured ?? false,
      apiTokenMasked: user.llmCredential?.tokenMasked ?? null,
    },
  };
}

async function createSession(user: SessionUser) {
  const refresh = createRefreshToken();
  const accessToken = await signAccessToken(user);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: refresh.tokenHash,
      expiresAt: refresh.expiresAt,
    },
  });

  return {
    accessToken,
    refreshToken: refresh.token,
    expiresIn: accessTokenExpiresIn(),
  };
}

export async function registerUser(input: RegisterInput) {
  const passwordHash = await hash(input.password, 12);
  const refresh = createRefreshToken();

  let user: UserWithCredential;
  try {
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          nickname: input.nickname ?? defaultNickname(input.email),
        },
        include: {
          llmCredential: true,
        },
      });

      await tx.refreshToken.create({
        data: {
          userId: created.id,
          tokenHash: refresh.tokenHash,
          expiresAt: refresh.expiresAt,
        },
      });

      return created;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ApiError(409, 'CONFLICT', '该邮箱已注册');
    }
    throw error;
  }

  return {
    user: serializeUser(user),
    accessToken: await signAccessToken(user),
    refreshToken: refresh.token,
    expiresIn: accessTokenExpiresIn(),
  };
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { llmCredential: true },
  });

  const passwordMatches = await compare(
    input.password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );

  if (!user || !passwordMatches) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', '邮箱或密码错误');
  }

  return {
    user: serializeUser(user),
    ...(await createSession(user)),
  };
}

export async function refreshSession(rawRefreshToken: string) {
  const tokenHash = hashRefreshToken(rawRefreshToken);
  const current = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!current || current.revokedAt) {
    throw new ApiError(401, 'UNAUTHORIZED', 'refresh token 无效');
  }

  if (current.expiresAt.getTime() <= Date.now()) {
    throw new ApiError(401, 'TOKEN_EXPIRED', 'refresh token 已过期');
  }

  const next = createRefreshToken();
  const revokedAt = new Date();

  await prisma.$transaction(async (tx) => {
    const revoked = await tx.refreshToken.updateMany({
      where: {
        id: current.id,
        revokedAt: null,
      },
      data: { revokedAt },
    });

    if (revoked.count !== 1) {
      throw new ApiError(401, 'UNAUTHORIZED', 'refresh token 已被使用');
    }

    await tx.refreshToken.create({
      data: {
        userId: current.userId,
        tokenHash: next.tokenHash,
        expiresAt: next.expiresAt,
      },
    });
  });

  return {
    accessToken: await signAccessToken(current.user),
    refreshToken: next.token,
    expiresIn: accessTokenExpiresIn(),
  };
}

export async function logoutUser(userId: string, rawRefreshToken?: string) {
  await prisma.refreshToken.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(rawRefreshToken
        ? { tokenHash: hashRefreshToken(rawRefreshToken) }
        : {}),
    },
    data: {
      revokedAt: new Date(),
    },
  });

  return { ok: true };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { llmCredential: true },
  });

  if (!user) {
    throw new ApiError(401, 'UNAUTHORIZED', '用户不存在');
  }

  return serializeUser(user);
}

export async function updateUserProfile(userId: string, input: UpdateProfileInput) {
  const userData: {
    nickname?: string;
    avatarUrl?: string | null;
  } = {};

  if (input.nickname !== undefined) {
    userData.nickname = input.nickname;
  }
  if (Object.hasOwn(input, 'avatarUrl')) {
    userData.avatarUrl = input.avatarUrl ?? null;
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(userData).length > 0) {
      await tx.user.update({
        where: { id: userId },
        data: userData,
      });
    }

    if (input.llmConfig) {
      const { provider, model, apiToken } = input.llmConfig;
      const updateData: {
        provider?: string;
        model?: string;
        tokenCiphertext?: string | null;
        tokenIv?: string | null;
        tokenTag?: string | null;
        tokenMasked?: string | null;
        configured?: boolean;
      } = {};

      if (provider !== undefined) {
        updateData.provider = provider;
      }
      if (model !== undefined) {
        updateData.model = model;
      }

      if (apiToken !== undefined) {
        if (!apiToken) {
          Object.assign(updateData, {
            tokenCiphertext: null,
            tokenIv: null,
            tokenTag: null,
            tokenMasked: null,
            configured: false,
          });
        } else {
          Object.assign(updateData, encryptApiToken(apiToken), {
            configured: true,
          });
        }
      }

      if (Object.keys(updateData).length > 0) {
        await tx.userLlmCredential.upsert({
          where: { userId },
          update: updateData,
          create: {
            userId,
            ...updateData,
          },
        });
      }
    }
  });

  return getCurrentUser(userId);
}
