import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

config({
  path: fileURLToPath(new URL('../../../../.env', import.meta.url)),
});

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  LLM_PROVIDER: z.string().default('deepseek'),
  LLM_MODEL: z.string().default('deepseek-chat'),
  LLM_TOKEN_ENCRYPTION_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);
