import cors from '@fastify/cors';
import Fastify from 'fastify';
import { ZodError } from 'zod';

import { registerAuthRoutes } from './auth/auth.routes.js';
import { env } from './config/env.js';
import { registerImportRoutes } from './imports/import.routes.js';
import { ApiError } from './lib/api-error.js';
import { registerStudyRoutes } from './study/study.routes.js';

export function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV === 'development',
  });
  const allowedOrigins = env.WEB_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  void app.register(cors, {
    origin: allowedOrigins.length > 1 ? allowedOrigins : (allowedOrigins[0] ?? false),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  void app.register(registerAuthRoutes);
  void app.register(registerImportRoutes);
  void app.register(registerStudyRoutes);

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

    const requestError = error as {
      code?: string;
      statusCode?: number;
    };

    if (requestError.code === 'FST_ERR_CTP_INVALID_JSON_BODY') {
      return reply.status(400).send({
        statusCode: 400,
        code: 'INVALID_JSON',
        message: '请求体不是合法 JSON',
        details: null,
        requestId: request.id,
      });
    }

    if (
      requestError.statusCode !== undefined &&
      requestError.statusCode >= 400 &&
      requestError.statusCode < 500
    ) {
      return reply.status(requestError.statusCode).send({
        statusCode: requestError.statusCode,
        code: requestError.code ?? 'BAD_REQUEST',
        message: '请求格式不正确',
        details: null,
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
