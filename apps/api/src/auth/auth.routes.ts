import type { FastifyInstance } from 'fastify';

import { ApiError } from '../lib/api-error.js';
import { authenticate } from './authenticate.js';
import {
  getCurrentUser,
  loginSchema,
  loginUser,
  logoutSchema,
  logoutUser,
  refreshSchema,
  refreshSession,
  registerSchema,
  registerUser,
  updateProfileSchema,
  updateUserProfile,
} from './auth.service.js';

function authUser(request: { authUser?: { userId: string; email: string } }) {
  if (!request.authUser) {
    throw new ApiError(401, 'UNAUTHORIZED', '登录状态无效');
  }
  return request.authUser;
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/register', async (request) => {
    return registerUser(registerSchema.parse(request.body));
  });

  app.post('/api/auth/login', async (request) => {
    return loginUser(loginSchema.parse(request.body));
  });

  app.post('/api/auth/refresh', async (request) => {
    const { refreshToken } = refreshSchema.parse(request.body);
    return refreshSession(refreshToken);
  });

  app.post('/api/auth/logout', { preHandler: authenticate }, async (request) => {
    const { userId } = authUser(request);
    const { refreshToken } = logoutSchema.parse(request.body ?? {});
    return logoutUser(userId, refreshToken);
  });

  app.get('/api/auth/me', { preHandler: authenticate }, async (request) => {
    const { userId } = authUser(request);
    return getCurrentUser(userId);
  });

  app.patch('/api/auth/me', { preHandler: authenticate }, async (request) => {
    const { userId } = authUser(request);
    return updateUserProfile(userId, updateProfileSchema.parse(request.body));
  });
}
