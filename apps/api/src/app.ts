import cors from '@fastify/cors';
import Fastify from 'fastify';
import { ZodError } from 'zod';

import { registerAuthRoutes } from './auth/auth.routes.js';
import { env } from './config/env.js';
import { ApiError } from './lib/api-error.js';

export function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV === 'development',
  });

  void app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
  });

  void app.register(registerAuthRoutes);

  app.get('/health', async () => ({
    ok: true,
    service: 'exam-assistant-api',
  }));

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: '请求参数校验失败',
        details: error.flatten(),
        requestId: request.id,
      });
    }

    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        code: error.code,
        message: error.message,
        details: error.details ?? null,
        requestId: request.id,
      });
    }

    request.log.error({ err: error }, 'Unhandled request error');
    return reply.status(500).send({
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: '服务器内部错误',
      details: null,
      requestId: request.id,
    });
  });

  return app;
}
