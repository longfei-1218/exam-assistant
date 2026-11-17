import { createHash } from 'node:crypto';

import { z } from 'zod';

import { prisma } from '../db/prisma.js';
import { Prisma } from '../generated/prisma/client.js';
import { ApiError } from '../lib/api-error.js';

export const examInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(5000).default(''),
  examDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export const categoryCreateSchema = z.object({
  examId: z.string().min(1),
  parentId: z.string().min(1).nullable().optional(),
  name: z.string().trim().min(1).max(80),
});

export const categoryUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

const questionTypeSchema = z.enum([
  'single_choice',
  'multi_choice',
  'fill_blank',
  'true_false',
  'short_answer',
]);

export const questionInputSchema = z.object({
  examId: z.string().min(1),
  categoryId: z.string().min(1),
  type: questionTypeSchema,
  stem: z.string().trim().min(1),
  options: z.array(z.string()).default([]),
  answer: z.string().trim().min(1),
  explanation: z.string().default(''),
});

export const attemptInputSchema = z.object({
  questionId: z.string().min(1),
  answer: z.string().min(1),
  durationMs: z.number().int().nonnegative().optional(),
});

export const practiceInputSchema = z.object({
  examId: z.string().min(1),
  categoryId: z.string().min(1).optional(),
  mode: z.enum(['all', 'wrong', 'unpassed', 'category']).default('all'),
  type: questionTypeSchema.optional(),
  shuffle: z.boolean().default(false),
});

export const practiceSubmitSchema = z.object({
  examId: z.string().min(1),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        answer: z.string().min(1),
        durationMs: z.number().int().nonnegative().optional(),
      }),
    )
    .min(1)
    .max(200),
});

type QuestionRecord = {
  id: string;
  examId: string;
  categoryId: string;
  type:
    | 'single_choice'
    | 'multi_choice'
    | 'fill_blank'
    | 'true_false'
    | 'short_answer';
  stem: string;
  optionsJson: Prisma.JsonValue;
  answer: string;
  explanation: string;
  stemHash: string;
  createdAt: Date;
};

function normalizeStemHash(stem: string) {
  const normalized = stem
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，。！？、：；""''（）【】,.!?;:'"()]/g, '');

  return createHash('sha256').update(normalized).digest('hex');
}

function answerHash(stem: string, answer: string) {
  return createHash('sha256').update(`${stem}\n${answer}`).digest('hex');
}

function examDateToDate(value?: string | null) {
  if (!value) {
    return null;
  }
  return new Date(`${value}T00:00:00.000Z`);
}

function examDateToString(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function parseOptions(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function questionDto(question: QuestionRecord) {
  return {
    id: question.id,
    examId: question.examId,
    categoryId: question.categoryId,
    type: question.type,
    stem: question.stem,
    options: parseOptions(question.optionsJson),
    answer: question.answer,
    explanation: question.explanation,
    stemHash: question.stemHash,
    createdAt: question.createdAt.toISOString(),
  };
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

async function requireOwnedExam(userId: string, examId: string) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, userId },
  });
  if (!exam) {
    throw new ApiError(404, 'NOT_FOUND', '考试不存在');
  }
  return exam;
}

async function examAttempts(userId: string, examIds: string[]) {
  if (examIds.length === 0) {
    return [];
  }
  return prisma.attempt.findMany({
    where: {
      userId,
      question: {
        is: {
          examId: { in: examIds },
        },
      },
    },
    select: {
      questionId: true,
      isCorrect: true,
      createdAt: true,
    },
  });
}

async function examDtos(userId: string, exams: Array<{
  id: string;
  name: string;
  description: string;
  examDate: Date | null;
  createdAt: Date;
  categories: Array<{ parentId: string | null }>;
  questions: Array<{ id: string; categoryId: string }>;
}>) {
  const attempts = await examAttempts(
    userId,
    exams.map((exam) => exam.id),
  );
  const questionToExam = new Map<string, string>();
  for (const exam of exams) {
    for (const question of exam.questions) {
      questionToExam.set(question.id, exam.id);
    }
  }

  return exams.map((exam) => {
    const questionIds = new Set(exam.questions.map((question) => question.id));
    const ownAttempts = attempts.filter((attempt) =>
      questionIds.has(attempt.questionId),
    );
    const passed = new Set(
      ownAttempts
        .filter((attempt) => attempt.isCorrect === true)
        .map((attempt) => attempt.questionId),
    ).size;
    const lastPracticedAt = ownAttempts.reduce<Date | null>(
      (latest, attempt) =>
        !latest || attempt.createdAt > latest ? attempt.createdAt : latest,
      null,
    );

    return {
      id: exam.id,
      name: exam.name,
      description: exam.description,
      examDate: examDateToString(exam.examDate),
      categoryCount: exam.categories.filter(
        (category) => category.parentId === null,
      ).length,
      questionCount: exam.questions.length,
      passedCount: passed,
      lastPracticedAt: lastPracticedAt?.toISOString() ?? null,
      createdAt: exam.createdAt.toISOString(),
    };
  });
}

export async function listExams(userId: string) {
  const exams = await prisma.exam.findMany({
    where: { userId },
    include: {
      categories: { select: { parentId: true } },
      questions: { select: { id: true, categoryId: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return examDtos(userId, exams);
}

export async function getExam(userId: string, examId: string) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, userId },
    include: {
      categories: { select: { parentId: true } },
      questions: { select: { id: true, categoryId: true } },
    },
  });
  if (!exam) {
    throw new ApiError(404, 'NOT_FOUND', '考试不存在');
  }
  return (await examDtos(userId, [exam]))[0];
}

export async function createExam(
  userId: string,
  input: z.infer<typeof examInputSchema>,
) {
  const exam = await prisma.exam.create({
    data: {
      userId,
      name: input.name,
      description: input.description,
      examDate: examDateToDate(input.examDate),
    },
    include: {
      categories: { select: { parentId: true } },
      questions: { select: { id: true, categoryId: true } },
    },
  });
  return (await examDtos(userId, [exam]))[0];
}

export async function updateExam(
  userId: string,
  examId: string,
  input: z.infer<typeof examInputSchema>,
) {
  await requireOwnedExam(userId, examId);
  await prisma.exam.update({
    where: { id: examId },
    data: {
      name: input.name,
      description: input.description,
      examDate: examDateToDate(input.examDate),
    },
  });
  return getExam(userId, examId);
}

export async function deleteExam(userId: string, examId: string) {
  await requireOwnedExam(userId, examId);
  await prisma.exam.delete({ where: { id: examId } });
  return { ok: true };
}

async function categoryDtos(userId: string, examId: string) {
  const categories = await prisma.category.findMany({
    where: { userId, examId },
    orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  });
  const questions = await prisma.question.findMany({
    where: { examId },
    select: { id: true, categoryId: true },
  });
  const attempts = await prisma.attempt.findMany({
    where: {
      userId,
      question: { is: { examId } },
    },
    select: { questionId: true, isCorrect: true },
  });
  const children = new Map<string, string[]>();
  for (const category of categories) {
    if (category.parentId) {
      children.set(category.parentId, [
        ...(children.get(category.parentId) ?? []),
        category.id,
      ]);
    }
  }

  return categories.map((category) => {
    const subtree = [category.id, ...(children.get(category.id) ?? [])];
    const questionIds = new Set(
      questions
        .filter((question) => subtree.includes(question.categoryId))
        .map((question) => question.id),
    );
    const ownAttempts = attempts.filter((attempt) =>
      questionIds.has(attempt.questionId),
    );
    const gradedAttempts = ownAttempts.filter(
      (attempt) => attempt.isCorrect !== null,
    );
    const errorCount = gradedAttempts.filter(
      (attempt) => attempt.isCorrect === false,
    ).length;

    return {
      id: category.id,
      examId: category.examId,
      parentId: category.parentId,
      name: category.name,
      sortOrder: category.sortOrder,
      stats: {
        total: questionIds.size,
        passed: new Set(
          ownAttempts
            .filter((attempt) => attempt.isCorrect === true)
            .map((attempt) => attempt.questionId),
        ).size,
        answerCount: ownAttempts.length,
        errorCount,
        errorRate:
          gradedAttempts.length > 0 ? errorCount / gradedAttempts.length : null,
      },
    };
  });
}

export async function listCategories(userId: string, examId: string) {
  await requireOwnedExam(userId, examId);
  return categoryDtos(userId, examId);
}

export async function createCategory(
  userId: string,
  input: z.infer<typeof categoryCreateSchema>,
) {
  await requireOwnedExam(userId, input.examId);
  if (input.parentId) {
    const parent = await prisma.category.findFirst({
      where: {
        id: input.parentId,
        userId,
        examId: input.examId,
      },
    });
    if (!parent || parent.parentId !== null) {
      throw new ApiError(422, 'RULE_VIOLATION', '一期只支持一层子类目');
    }
  }
  const maxSort = await prisma.category.aggregate({
    where: {
      userId,
      examId: input.examId,
      parentId: input.parentId ?? null,
    },
    _max: { sortOrder: true },
  });
  const category = await prisma.category.create({
    data: {
      userId,
      examId: input.examId,
      parentId: input.parentId ?? null,
      name: input.name,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });
  return (await categoryDtos(userId, category.examId)).find(
    (item) => item.id === category.id,
  );
}

export async function updateCategory(
  userId: string,
  categoryId: string,
  input: z.infer<typeof categoryUpdateSchema>,
) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
  });
  if (!category) {
    throw new ApiError(404, 'NOT_FOUND', '类目不存在');
  }
  await prisma.category.update({
    where: { id: categoryId },
    data: { name: input.name },
  });
  return (await categoryDtos(userId, category.examId)).find(
    (item) => item.id === categoryId,
  );
}

export async function deleteCategory(userId: string, categoryId: string) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
  });
  if (!category) {
    throw new ApiError(404, 'NOT_FOUND', '类目不存在');
  }
  await prisma.category.delete({ where: { id: categoryId } });
  return { ok: true };
}

function validateQuestion(input: z.infer<typeof questionInputSchema>) {
  if (input.type === 'true_false' && !['正确', '错误'].includes(input.answer)) {
    throw new ApiError(400, 'VALIDATION_ERROR', '判断题答案必须是正确或错误');
  }

  if (input.type === 'single_choice' || input.type === 'multi_choice') {
    if (input.options.length < 2) {
      throw new ApiError(400, 'VALIDATION_ERROR', '选择题至少需要 2 个选项');
    }
    if (input.type === 'single_choice' && !/^[A-Z]$/.test(input.answer)) {
      throw new ApiError(400, 'VALIDATION_ERROR', '单选题答案必须是单个选项字母');
    }
    if (input.type === 'multi_choice') {
      try {
        const parsed = JSON.parse(input.answer) as unknown;
        if (
          !Array.isArray(parsed) ||
          parsed.length === 0 ||
          !parsed.every((item) => typeof item === 'string' && /^[A-Z]$/.test(item))
        ) {
          throw new Error();
        }
      } catch {
        throw new ApiError(
          400,
          'VALIDATION_ERROR',
          '多选题答案必须是选项字母数组',
        );
      }
    }
  }
}

async function questionForUser(userId: string, questionId: string) {
  const question = await prisma.question.findFirst({
    where: {
      id: questionId,
      exam: { is: { userId } },
    },
  });
  if (!question) {
    throw new ApiError(404, 'NOT_FOUND', '题目不存在');
  }
  return question;
}

async function ensureQuestionTarget(
  userId: string,
  examId: string,
  categoryId: string,
) {
  await requireOwnedExam(userId, examId);
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId, examId },
  });
  if (!category) {
    throw new ApiError(404, 'NOT_FOUND', '类目不存在');
  }
}

export async function listQuestions(
  userId: string,
  examId: string,
  categoryId?: string,
) {
  await requireOwnedExam(userId, examId);
  const categories = categoryId
    ? await prisma.category.findMany({
        where: { examId, userId },
        select: { id: true, parentId: true },
      })
    : [];
  const categoryIds = categoryId
    ? [
        categoryId,
        ...categories
          .filter((category) => category.parentId === categoryId)
          .map((category) => category.id),
      ]
    : undefined;
  const questions = await prisma.question.findMany({
    where: {
      examId,
      ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
    },
    orderBy: { createdAt: 'asc' },
  });
  return questions.map(questionDto);
}

export async function getQuestion(userId: string, questionId: string) {
  return questionDto(await questionForUser(userId, questionId));
}

export async function createQuestion(
  userId: string,
  input: z.infer<typeof questionInputSchema>,
) {
  validateQuestion(input);
  await ensureQuestionTarget(userId, input.examId, input.categoryId);
  try {
    const question = await prisma.question.create({
      data: {
        examId: input.examId,
        categoryId: input.categoryId,
        type: input.type,
        stem: input.stem,
        optionsJson: input.options as Prisma.InputJsonValue,
        answer: input.answer,
        explanation: input.explanation,
        stemHash: normalizeStemHash(input.stem),
      },
    });
    return questionDto(question);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ApiError(409, 'CONFLICT', '该考试下已存在相同题干');
    }
    throw error;
  }
}

export async function updateQuestion(
  userId: string,
  questionId: string,
  input: z.infer<typeof questionInputSchema>,
) {
  validateQuestion(input);
  await questionForUser(userId, questionId);
  await ensureQuestionTarget(userId, input.examId, input.categoryId);
  try {
    const question = await prisma.question.update({
      where: { id: questionId },
      data: {
        examId: input.examId,
        categoryId: input.categoryId,
        type: input.type,
        stem: input.stem,
        optionsJson: input.options as Prisma.InputJsonValue,
        answer: input.answer,
        explanation: input.explanation,
        stemHash: normalizeStemHash(input.stem),
      },
    });
    return questionDto(question);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ApiError(409, 'CONFLICT', '该考试下已存在相同题干');
    }
    throw error;
  }
}

export async function deleteQuestion(userId: string, questionId: string) {
  await questionForUser(userId, questionId);
  await prisma.question.delete({ where: { id: questionId } });
  return { ok: true };
}

function normalizeAnswer(answer: string) {
  return answer.trim().toUpperCase();
}

function parseMultiAnswer(answer: string) {
  try {
    const parsed = JSON.parse(answer) as unknown;
    return Array.isArray(parsed)
      ? parsed.map((item) => String(item).toUpperCase()).sort()
      : [];
  } catch {
    return [];
  }
}

function judgeObjective(
  type: QuestionRecord['type'],
  expected: string,
  actual: string,
): boolean | null {
  if (type === 'single_choice') {
    return normalizeAnswer(actual) === normalizeAnswer(expected);
  }
  if (type === 'multi_choice') {
    return (
      JSON.stringify(parseMultiAnswer(expected)) ===
      JSON.stringify(parseMultiAnswer(actual))
    );
  }
  if (type === 'true_false') {
    const normalizeJudgment = (value: string) =>
      /^(正确|对|√)$/.test(value.trim())
        ? '正确'
        : /^(错误|错|×)$/.test(value.trim())
          ? '错误'
          : value.trim();
    return normalizeJudgment(actual) === normalizeJudgment(expected);
  }
  if (type === 'fill_blank') {
    return actual.trim().toLowerCase() === expected.trim().toLowerCase();
  }
  return null;
}

function attemptDto(attempt: {
  id: string;
  userId: string;
  questionId: string;
  answerJson: Prisma.JsonValue;
  isCorrect: boolean | null;
  score: number | null;
  aiScore: number | null;
  aiFeedback: Prisma.JsonValue;
  overridden: boolean;
  originalAttemptId: string | null;
  durationMs: number | null;
  createdAt: Date;
}) {
  return {
    id: attempt.id,
    userId: attempt.userId,
    questionId: attempt.questionId,
    answer:
      typeof attempt.answerJson === 'string'
        ? attempt.answerJson
        : JSON.stringify(attempt.answerJson),
    answerJson: attempt.answerJson,
    isCorrect: attempt.isCorrect,
    score: attempt.score,
    aiScore: attempt.aiScore,
    aiFeedback: attempt.aiFeedback,
    overridden: attempt.overridden,
    originalAttemptId: attempt.originalAttemptId,
    durationMs: attempt.durationMs,
    createdAt: attempt.createdAt.toISOString(),
  };
}

export async function submitAttempt(
  userId: string,
  input: z.infer<typeof attemptInputSchema>,
) {
  const question = await questionForUser(userId, input.questionId);
  const isCorrect = judgeObjective(question.type, question.answer, input.answer);
  const attempt = await prisma.attempt.create({
    data: {
      userId,
      questionId: question.id,
      answerJson: input.answer,
      isCorrect,
      score: isCorrect === null ? null : isCorrect ? 100 : 0,
      answerHash: answerHash(question.stem, input.answer),
      durationMs: input.durationMs,
    },
  });
  return attemptDto(attempt);
}

export async function listAttempts(userId: string, questionId: string) {
  await questionForUser(userId, questionId);
  const attempts = await prisma.attempt.findMany({
    where: { userId, questionId },
    orderBy: { createdAt: 'asc' },
  });
  return attempts.map(attemptDto);
}

type WrongBookRecord = QuestionRecord & {
  exam: { name: string };
  category: { name: string };
  attempts: Array<{ id: string; isCorrect: boolean | null; createdAt: Date }>;
};

function wrongBookItem(record: WrongBookRecord) {
  const attempts = [...record.attempts].sort((left, right) =>
    left.createdAt.getTime() - right.createdAt.getTime(),
  );
  const latest = attempts.at(-1);
  if (!latest || latest.isCorrect === null) {
    return null;
  }
  const wrongCount = attempts.filter(
    (attempt) => attempt.isCorrect === false,
  ).length;
  if (wrongCount === 0) {
    return null;
  }
  return {
    question: questionDto(record),
    examName: record.exam.name,
    categoryName: record.category.name,
    wrongCount,
    lastAttemptAt: latest.createdAt.toISOString(),
    corrected: latest.isCorrect === true,
  };
}

async function wrongBookRecords(
  userId: string,
): Promise<WrongBookRecord[]> {
  return prisma.question.findMany({
    where: { exam: { is: { userId } } },
    include: {
      exam: { select: { name: true } },
      category: { select: { name: true } },
      attempts: {
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, isCorrect: true, createdAt: true },
      },
    },
  });
}

export async function listWrongBook(userId: string) {
  const records = await wrongBookRecords(userId);
  return records
    .map(wrongBookItem)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort(
      (left, right) =>
        right.wrongCount - left.wrongCount ||
        right.lastAttemptAt.localeCompare(left.lastAttemptAt),
    );
}

export async function practiceQuestions(
  userId: string,
  input: z.infer<typeof practiceInputSchema>,
) {
  await requireOwnedExam(userId, input.examId);
  const categories = await prisma.category.findMany({
    where: { examId: input.examId, userId },
    select: { id: true, parentId: true },
  });
  const categoryIds = input.categoryId
    ? [
        input.categoryId,
        ...categories
          .filter((category) => category.parentId === input.categoryId)
          .map((category) => category.id),
      ]
    : undefined;

  const records = await prisma.question.findMany({
    where: {
      examId: input.examId,
      ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
      ...(input.type ? { type: input.type } : {}),
    },
    include: {
      attempts: {
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: { isCorrect: true, createdAt: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  let filtered = records;
  if (input.mode === 'wrong') {
    const wrongIds = new Set(
      (await listWrongBook(userId))
        .filter((item) => !item.corrected)
        .map((item) => item.question.id),
    );
    filtered = filtered.filter((question) => wrongIds.has(question.id));
  } else if (input.mode === 'unpassed') {
    filtered = filtered.filter(
      (question) =>
        !question.attempts.some((attempt) => attempt.isCorrect === true),
    );
  }

  if (input.shuffle) {
    filtered = [...filtered].sort(() => Math.random() - 0.5);
  }

  return filtered.map(questionDto);
}

export async function submitPracticeAnswers(
  userId: string,
  input: z.infer<typeof practiceSubmitSchema>,
) {
  await requireOwnedExam(userId, input.examId);
  const questionIds = input.answers.map((answer) => answer.questionId);
  if (new Set(questionIds).size !== questionIds.length) {
    throw new ApiError(400, 'VALIDATION_ERROR', '同一道题不能重复提交');
  }

  const questions = await prisma.question.findMany({
    where: {
      id: { in: questionIds },
      examId: input.examId,
      exam: { is: { userId } },
    },
  });
  if (questions.length !== questionIds.length) {
    throw new ApiError(404, 'NOT_FOUND', '练习题目不存在');
  }

  const questionMap = new Map(
    questions.map((question) => [question.id, question]),
  );
  const attempts = await prisma.$transaction(
    input.answers.map((item) => {
      const question = questionMap.get(item.questionId);
      if (!question) {
        throw new ApiError(404, 'NOT_FOUND', '练习题目不存在');
      }
      const isCorrect = judgeObjective(
        question.type,
        question.answer,
        item.answer,
      );
      return prisma.attempt.create({
        data: {
          userId,
          questionId: question.id,
          answerJson: item.answer,
          isCorrect,
          score: isCorrect === null ? null : isCorrect ? 100 : 0,
          answerHash: answerHash(question.stem, item.answer),
          durationMs: item.durationMs,
        },
      });
    }),
  );

  const results = input.answers.map((item, index) => ({
    question: questionDto(questionMap.get(item.questionId) as QuestionRecord),
    attempt: attemptDto(attempts[index] as (typeof attempts)[number]),
  }));
  const correctCount = results.filter(
    (result) => result.attempt.isCorrect === true,
  ).length;
  const wrongCount = results.filter(
    (result) => result.attempt.isCorrect === false,
  ).length;

  return {
    total: results.length,
    correctCount,
    wrongCount,
    pendingCount: results.length - correctCount - wrongCount,
    results,
  };
}
