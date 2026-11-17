import { createCipheriv, randomBytes } from 'node:crypto';

import { env } from '../config/env.js';
import { ApiError } from '../lib/api-error.js';

export type EncryptedToken = {
  tokenCiphertext: string;
  tokenIv: string;
  tokenTag: string;
  tokenMasked: string;
};

function encryptionKey(): Buffer {
  if (!env.LLM_TOKEN_ENCRYPTION_KEY) {
    throw new ApiError(
      500,
      'LLM_ENCRYPTION_NOT_CONFIGURED',
      '服务端未配置 LLM_TOKEN_ENCRYPTION_KEY',
    );
  }

  const key = Buffer.from(env.LLM_TOKEN_ENCRYPTION_KEY, 'base64');
  if (key.length !== 32) {
    throw new ApiError(
      500,
      'LLM_ENCRYPTION_NOT_CONFIGURED',
      'LLM_TOKEN_ENCRYPTION_KEY 必须是 32 字节密钥的 Base64 编码',
    );
  }

  return key;
}

export function maskApiToken(token: string): string {
  const suffix = token.slice(-4);
  const prefixLength = token.startsWith('sk-') ? 3 : Math.min(3, token.length);
  const prefix = token.slice(0, prefixLength);
  const hiddenLength = Math.max(4, token.length - prefixLength - suffix.length);

  return `${prefix}${'*'.repeat(hiddenLength)}${suffix}`;
}

export function encryptApiToken(token: string): EncryptedToken {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    tokenCiphertext: ciphertext.toString('base64'),
    tokenIv: iv.toString('base64'),
    tokenTag: tag.toString('base64'),
    tokenMasked: maskApiToken(token),
  };
}
