import type { FastifyInstance, FastifyRequest } from 'fastify';

import { authenticate } from '../auth/authenticate.js';
import { ApiError } from '../lib/api-error.js';
import {
  attemptInputSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  createCategory,
  createExam,
  createQuestion,
  deleteCategory,
  deleteExam,
  deleteQuestion,
  examInputSchema,
  getExam,
  getPracticeSession,
  getQuestion,
  listAttempts,
  listCategories,
  listExams,
  listQuestions,
  listPracticeSessions,
  listWrongBook,
  practiceInputSchema,
  practiceQuestions,
  practiceSubmitSchema,
  questionInputSchema,
  submitAttempt,
  submitPracticeAnswers,
  updateCategory,
  updateExam,
  updateQuestion,
} from './study.service.js';

function userId(request: FastifyRequest) {
  if (!request.authUser) {
    throw new ApiError(401, 'UNAUTHORIZED', '登录状态无效');
  }
  return request.authUser.userId;
}

export async function registerStudyRoutes(app: FastifyInstance) {
  app.get('/api/exams', { preHandler: authenticate }, async (request) =>
    listExams(userId(request)),
  );

  app.post('/api/exams', { preHandler: authenticate }, async (request, reply) => {
    const exam = await createExam(
      userId(request),
      examInputSchema.parse(request.body),
    );
    return reply.status(201).send(exam);
  });

  app.get('/api/exams/:id', { preHandler: authenticate }, async (request) => {
    const { id } = request.params as { id: string };
    return getExam(userId(request), id);
  });

  app.patch('/api/exams/:id', { preHandler: authenticate }, async (request) => {
    const { id } = request.params as { id: string };
    return updateExam(
      userId(request),
      id,
      examInputSchema.parse(request.body),
    );
  });

  app.delete('/api/exams/:id', { preHandler: authenticate }, async (request) => {
    const { id } = request.params as { id: string };
    return deleteExam(userId(request), id);
  });

  app.get(
    '/api/categories',
    { preHandler: authenticate },
    async (request) => {
      const { examId } = request.query as { examId?: string };
      if (!examId) {
        throw new ApiError(400, 'VALIDATION_ERROR', '缺少 examId');
      }
      return listCategories(userId(request), examId);
    },
  );

  app.post(
    '/api/categories',
    { preHandler: authenticate },
    async (request, reply) => {
      const category = await createCategory(
        userId(request),
        categoryCreateSchema.parse(request.body),
      );
      return reply.status(201).send(category);
    },
  );

  app.patch(
    '/api/categories/:id',
    { preHandler: authenticate },
    async (request) => {
      const { id } = request.params as { id: string };
      return updateCategory(
        userId(request),
        id,
        categoryUpdateSchema.parse(request.body),
      );
    },
  );

  app.delete(
    '/api/categories/:id',
    { preHandler: authenticate },
    async (request) => {
      const { id } = request.params as { id: string };
      return deleteCategory(userId(request), id);
    },
  );

  app.get(
    '/api/questions',
    { preHandler: authenticate },
    async (request) => {
      const { examId, categoryId } = request.query as {
        examId?: string;
        categoryId?: string;
      };
      if (!examId) {
        throw new ApiError(400, 'VALIDATION_ERROR', '缺少 examId');
      }
      return listQuestions(userId(request), examId, categoryId);
    },
  );

  app.post(
    '/api/questions',
    { preHandler: authenticate },
    async (request, reply) => {
      const question = await createQuestion(
        userId(request),
        questionInputSchema.parse(request.body),
      );
      return reply.status(201).send(question);
    },
  );

  app.get(
    '/api/questions/:id',
    { preHandler: authenticate },
    async (request) => {
      const { id } = request.params as { id: string };
      return getQuestion(userId(request), id);
    },
  );

  app.patch(
    '/api/questions/:id',
    { preHandler: authenticate },
    async (request) => {
      const { id } = request.params as { id: string };
      return updateQuestion(
        userId(request),
        id,
        questionInputSchema.parse(request.body),
      );
    },
  );

  app.delete(
    '/api/questions/:id',
    { preHandler: authenticate },
    async (request) => {
      const { id } = request.params as { id: string };
      return deleteQuestion(userId(request), id);
    },
  );

  app.get(
    '/api/questions/:id/attempts',
    { preHandler: authenticate },
    async (request) => {
      const { id } = request.params as { id: string };
      return listAttempts(userId(request), id);
    },
  );

  app.post(
    '/api/attempts',
    { preHandler: authenticate },
    async (request) => submitAttempt(
      userId(request),
      attemptInputSchema.parse(request.body),
    ),
  );

  app.post(
    '/api/practice/session',
    { preHandler: authenticate },
    async (request) => {
      const input = practiceInputSchema.parse(request.body);
      return {
        mode: input.mode,
        questions: await practiceQuestions(userId(request), input),
      };
    },
  );

  app.post(
    '/api/practice/submit',
    { preHandler: authenticate },
    async (request) =>
      submitPracticeAnswers(
        userId(request),
        practiceSubmitSchema.parse(request.body),
      ),
  );

  app.get(
    '/api/practice/records',
    { preHandler: authenticate },
    async (request) => {
      const { examId } = request.query as { examId?: string };
      if (!examId) {
        throw new ApiError(400, 'VALIDATION_ERROR', '缺少 examId');
      }
      return listPracticeSessions(userId(request), examId);
    },
  );

  app.get(
    '/api/practice/records/:id',
    { preHandler: authenticate },
    async (request) => {
      const { id } = request.params as { id: string };
      return getPracticeSession(userId(request), id);
    },
  );

  app.get(
    '/api/wrong-book',
    { preHandler: authenticate },
    async (request) => listWrongBook(userId(request)),
  );
}
