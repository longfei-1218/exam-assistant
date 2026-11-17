import { createHash } from 'node:crypto';

import { z } from 'zod';

import { prisma } from '../db/prisma.js';
import { Prisma } from '../generated/prisma/client.js';
import { ApiError } from '../lib/api-error.js';

export const createImportSchema = z.object({
  examId: z.string().min(1),
  targetCategoryId: z.string().min(1).nullable().optional(),
  rawText: z.string().trim().min(1).max(30_000),
});

const confirmQuestionSchema = z.object({
  type: z.enum([
    'single_choice',
    'multi_choice',
    'fill_blank',
    'true_false',
    'short_answer',
  ]),
  stem: z.string().trim().min(1),
  options: z.array(z.string()).default([]),
  answer: z.string().trim().min(1),
  explanation: z.string().default(''),
  categoryId: z.string().min(1),
  selected: z.boolean(),
});

export const confirmImportSchema = z.object({
  questions: z.array(confirmQuestionSchema).min(1),
  createCategories: z.array(z.string().trim().min(1)).max(20).optional(),
});

export type CreateImportInput = z.infer<typeof createImportSchema>;
export type ConfirmImportInput = z.infer<typeof confirmImportSchema>;

type DraftQuestion = {
  type:
    | 'single_choice'
    | 'multi_choice'
    | 'fill_blank'
    | 'true_false'
    | 'short_answer';
  stem: string;
  options: string[];
  answer: string;
  explanation: string;
  categoryId: string;
  categoryHint: string;
  confidence: number;
  duplicate: boolean;
};

type ParsedQuestion = Omit<
  DraftQuestion,
  'categoryId' | 'categoryHint' | 'duplicate'
>;

function normalizeStemHash(stem: string) {
  const normalized = stem
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，。！？、：；""''（）【】,.!?;:'"()]/g, '');

  return createHash('sha256').update(normalized).digest('hex');
}

function extractAnswerLetters(answer: string) {
  return [...new Set(answer.toUpperCase().match(/[A-Z]/g) ?? [])];
}

function parseQuestionBlock(
  block: string[],
  section: string,
): ParsedQuestion | null {
  const stemLines: string[] = [];
  const options: string[] = [];
  let answer = '';
  let explanation = '';
  let readingExplanation = false;

  for (const line of block) {
    const optionMatch = /^([A-Z])[.、．]\s*(.+)$/i.exec(line);
    if (optionMatch) {
      options.push(`${optionMatch[1]?.toUpperCase()}. ${optionMatch[2]?.trim() ?? ''}`);
      readingExplanation = false;
      continue;
    }

    const answerMatch = /^答案[:：]\s*(.+)$/.exec(line);
    if (answerMatch) {
      answer = answerMatch[1]?.trim() ?? '';
      readingExplanation = false;
      continue;
    }

    const explanationMatch = /^解析[:：]\s*(.*)$/.exec(line);
    if (explanationMatch) {
      explanation = explanationMatch[1]?.trim() ?? '';
      readingExplanation = true;
      continue;
    }

    if (readingExplanation) {
      explanation = `${explanation}${explanation ? '\n' : ''}${line}`;
      continue;
    }

    if (!options.length && !answer) {
      stemLines.push(line);
    }
  }

  const stem = stemLines.join('\n').trim();
  if (!stem || !answer) {
    return null;
  }

  const isJudgment =
    /判断/.test(section) ||
    /^(正确|错误|对|错|√|×)$/.test(answer);

  if (isJudgment) {
    const isTrue = /^(正确|对|√)$/.test(answer);
    return {
      type: 'true_false',
      stem,
      options: ['正确', '错误'],
      answer: isTrue ? '正确' : '错误',
      explanation,
      confidence: 1,
    };
  }

  const letters = extractAnswerLetters(answer);
  const isMulti = /多选/.test(section) || letters.length > 1;

  if (isMulti && letters.length > 0) {
    return {
      type: 'multi_choice',
      stem,
      options,
      answer: JSON.stringify(letters.sort()),
      explanation,
      confidence: 1,
    };
  }

  if (letters.length === 1 && options.length >= 2) {
    return {
      type: 'single_choice',
      stem,
      options,
      answer: letters[0] ?? '',
      explanation,
      confidence: 1,
    };
  }

  return {
    type: 'fill_blank',
    stem,
    options,
    answer,
    explanation,
    confidence: 1,
  };
}

function parseImportText(rawText: string): ParsedQuestion[] {
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks: Array<{ section: string; lines: string[] }> = [];
  let section = '';
  let current: { section: string; lines: string[] } | null = null;

  function flush() {
    if (current) {
      blocks.push(current);
      current = null;
    }
  }

  for (const line of lines) {
    if (/^[一二三四五六七八九十]+、/.test(line)) {
      flush();
      section = line;
      continue;
    }

    const questionMatch = /^\d+\s*[.、．]\s*(.*)$/.exec(line);
    if (questionMatch) {
      flush();
      current = {
        section,
        lines: [questionMatch[1]?.trim() ?? ''],
      };
      continue;
    }

    if (current) {
      current.lines.push(line);
    }
  }
  flush();

  return blocks
    .map((block) => parseQuestionBlock(block.lines, block.section))
    .filter((question): question is ParsedQuestion => Boolean(question))
    .slice(0, 50);
}

async function resolveTargetCategory(
  userId: string,
  examId: string,
  targetCategoryId?: string | null,
) {
  if (targetCategoryId) {
    const category = await prisma.category.findFirst({
      where: {
        id: targetCategoryId,
        userId,
        examId,
      },
    });

    if (!category) {
      throw new ApiError(404, 'NOT_FOUND', '目标类目不存在');
    }

    return category;
  }

  const category = await prisma.category.findFirst({
    where: { userId, examId },
    orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }],
  });

  if (category) {
    return category;
  }

  return prisma.category.create({
    data: {
      userId,
      examId,
      name: '未分类',
      sortOrder: 1,
    },
  });
}

async function processImportJob(jobId: string) {
  try {
    const job = await prisma.importJob.findUnique({
      where: { id: jobId },
      include: { targetCategory: true },
    });

    if (!job || (job.status !== 'queued' && job.status !== 'processing')) {
      return;
    }

    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: 'processing',
        error: null,
        progressJson: {
          totalChunks: 1,
          doneChunks: 0,
          questionCount: 0,
        } as Prisma.InputJsonValue,
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 80));

    const parsed = parseImportText(job.rawText);
    if (parsed.length === 0) {
      throw new ApiError(
        400,
        'IMPORT_PARSE_FAILED',
        '没有识别到题目，请检查文本格式',
      );
    }

    const hashes = parsed.map((question) => normalizeStemHash(question.stem));
    const existingQuestions = await prisma.question.findMany({
      where: {
        examId: job.examId,
        stemHash: { in: hashes },
      },
      select: { stemHash: true },
    });
    const duplicateHashes = new Set(
      existingQuestions.map((question) => question.stemHash),
    );

    const categoryId = job.targetCategoryId;
    if (!categoryId) {
      throw new ApiError(400, 'IMPORT_PARSE_FAILED', '导入任务缺少目标类目');
    }

    const questions: DraftQuestion[] = parsed.map((question, index) => ({
      ...question,
      categoryId,
      categoryHint: job.targetCategory?.name ?? '未分类',
      duplicate: duplicateHashes.has(hashes[index] ?? ''),
    }));

    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: 'ready',
        resultJson: { questions } as unknown as Prisma.InputJsonValue,
        progressJson: {
          totalChunks: 1,
          doneChunks: 1,
          questionCount: questions.length,
        } as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '导入解析失败';

    await prisma.importJob.updateMany({
      where: { id: jobId },
      data: {
        status: 'failed',
        error: message,
        progressJson: {
          totalChunks: 1,
          doneChunks: 0,
          questionCount: 0,
        } as Prisma.InputJsonValue,
      },
    });
  }
}

export async function createImportJob(
  userId: string,
  input: CreateImportInput,
) {
  const exam = await prisma.exam.findFirst({
    where: {
      id: input.examId,
      userId,
    },
  });

  if (!exam) {
    throw new ApiError(404, 'NOT_FOUND', '考试不存在');
  }

  const category = await resolveTargetCategory(
    userId,
    input.examId,
    input.targetCategoryId,
  );

  const job = await prisma.importJob.create({
    data: {
      userId,
      examId: input.examId,
      targetCategoryId: category.id,
      rawText: input.rawText,
      status: 'queued',
      progressJson: {
        totalChunks: 0,
        doneChunks: 0,
        questionCount: 0,
      } as Prisma.InputJsonValue,
      promptVersion: 'local-import-v1',
      model: 'local-parser',
      tokenUsage: 0,
    },
  });

  setTimeout(() => {
    void processImportJob(job.id);
  }, 0);

  return job;
}

export async function getImportJob(userId: string, jobId: string) {
  const job = await prisma.importJob.findFirst({
    where: {
      id: jobId,
      userId,
    },
  });

  if (!job) {
    throw new ApiError(404, 'NOT_FOUND', '导入任务不存在');
  }

  return job;
}

export async function confirmImportJob(
  userId: string,
  jobId: string,
  input: ConfirmImportInput,
) {
  const job = await prisma.importJob.findFirst({
    where: {
      id: jobId,
      userId,
    },
  });

  if (!job) {
    throw new ApiError(404, 'NOT_FOUND', '导入任务不存在');
  }

  if (job.status !== 'ready') {
    throw new ApiError(422, 'RULE_VIOLATION', '导入任务尚未完成解析');
  }

  const selectedQuestions = input.questions.filter(
    (question) => question.selected,
  );

  const result = await prisma.$transaction(async (tx) => {
    for (const name of new Set(input.createCategories ?? [])) {
      const existing = await tx.category.findFirst({
        where: {
          userId,
          examId: job.examId,
          parentId: null,
          name,
        },
      });

      if (!existing) {
        await tx.category.create({
          data: {
            userId,
            examId: job.examId,
            name,
            sortOrder: 1,
          },
        });
      }
    }

    const categoryIds = [
      ...new Set(selectedQuestions.map((question) => question.categoryId)),
    ];
    const validCategories = await tx.category.findMany({
      where: {
        id: { in: categoryIds },
        userId,
        examId: job.examId,
      },
      select: { id: true },
    });
    const validCategoryIds = new Set(
      validCategories.map((category) => category.id),
    );

    const existingQuestions = await tx.question.findMany({
      where: { examId: job.examId },
      select: { stemHash: true },
    });
    const existingHashes = new Set(
      existingQuestions.map((question) => question.stemHash),
    );

    const questionIds: string[] = [];
    let skipped = 0;

    for (const question of selectedQuestions) {
      if (!validCategoryIds.has(question.categoryId)) {
        skipped += 1;
        continue;
      }

      const stemHash = normalizeStemHash(question.stem);
      if (existingHashes.has(stemHash)) {
        skipped += 1;
        continue;
      }

      const created = await tx.question.create({
        data: {
          examId: job.examId,
          categoryId: question.categoryId,
          type: question.type,
          stem: question.stem,
          optionsJson: question.options as Prisma.InputJsonValue,
          answer: question.answer,
          explanation: question.explanation,
          stemHash,
        },
      });
      questionIds.push(created.id);
      existingHashes.add(stemHash);
    }

    await tx.importJob.update({
      where: { id: job.id },
      data: { status: 'confirmed' },
    });

    return {
      imported: questionIds.length,
      skipped:
        skipped +
        (input.questions.length - selectedQuestions.length),
      questionIds,
    };
  });

  return result;
}

export async function retryImportJob(userId: string, jobId: string) {
  const job = await prisma.importJob.findFirst({
    where: {
      id: jobId,
      userId,
    },
  });

  if (!job) {
    throw new ApiError(404, 'NOT_FOUND', '导入任务不存在');
  }

  if (job.status !== 'failed') {
    throw new ApiError(422, 'RULE_VIOLATION', '只有失败任务可以重试');
  }

  const updated = await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status: 'queued',
      error: null,
      resultJson: Prisma.JsonNull,
      progressJson: {
        totalChunks: 0,
        doneChunks: 0,
        questionCount: 0,
      } as Prisma.InputJsonValue,
    },
  });

  setTimeout(() => {
    void processImportJob(updated.id);
  }, 0);

  return updated;
}
