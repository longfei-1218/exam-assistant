import type { FastifyInstance } from 'fastify';

import { authenticate } from '../auth/authenticate.js';
import { ApiError } from '../lib/api-error.js';
import {
  confirmImportJob,
  confirmImportSchema,
  createImportJob,
  createImportSchema,
  getImportJob,
  retryImportJob,
} from './import.service.js';

function authUser(request: { authUser?: { userId: string } }) {
  if (!request.authUser) {
    throw new ApiError(401, 'UNAUTHORIZED', '登录状态无效');
  }
  return request.authUser;
}

export async function registerImportRoutes(app: FastifyInstance) {
  app.post('/api/imports', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = authUser(request);
    const job = await createImportJob(
      userId,
      createImportSchema.parse(request.body),
    );
    return reply.status(202).send(job);
  });

  app.get(
    '/api/imports/:id',
    { preHandler: authenticate },
    async (request) => {
      const { userId } = authUser(request);
      const { id } = request.params as { id: string };
      return getImportJob(userId, id);
    },
  );

  app.post(
    '/api/imports/:id/confirm',
    { preHandler: authenticate },
    async (request) => {
      const { userId } = authUser(request);
      const { id } = request.params as { id: string };
      return confirmImportJob(
        userId,
        id,
        confirmImportSchema.parse(request.body),
      );
    },
  );

  app.post(
    '/api/imports/:id/retry',
    { preHandler: authenticate },
    async (request, reply) => {
      const { userId } = authUser(request);
      const { id } = request.params as { id: string };
      const job = await retryImportJob(userId, id);
      return reply.status(202).send(job);
    },
  );
}
