import type { FastifyRequest } from 'fastify';

import { ApiError } from '../lib/api-error.js';
import { verifyAccessToken } from './tokens.js';

export async function authenticate(request: FastifyRequest): Promise<void> {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    throw new ApiError(401, 'UNAUTHORIZED', '缺少 Bearer access token');
  }

  request.authUser = await verifyAccessToken(authorization.slice('Bearer '.length));
}
