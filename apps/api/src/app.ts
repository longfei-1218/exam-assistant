import cors from '@fastify/cors';
import Fastify from 'fastify';

import { env } from './config/env.js';

export function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV === 'development',
  });

  void app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
  });

  app.get('/health', async () => ({
    ok: true,
    service: 'exam-assistant-api',
  }));

  return app;
}
