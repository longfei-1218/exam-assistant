import type {
  Attempt,
  AuthSession,
  AuthUser,
  Category,
  CategoryInput,
  CategoryStats,
  Exam,
  ExamInput,
  LoginInput,
  PracticeMode,
  Question,
  QuestionInput,
  RegisterInput,
  WrongBookItem,
} from '@/types';

type StoredUser = AuthUser & {
  password: string;
};

type StoredExam = {
  id: string;
  userId: string;
  name: string;
  description: string;
  examDate: string | null;
  createdAt: string;
};

type StoredCategory = {
  id: string;
  userId: string;
  examId: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
};

type StoredQuestion = Question;

type StoredAttempt = Attempt;

type Database = {
  users: StoredUser[];
  exams: StoredExam[];
  categories: StoredCategory[];
  questions: StoredQuestion[];
  attempts: StoredAttempt[];
};

const DB_KEY = 'exam-assistant.db';
const SESSION_KEY = 'exam-assistant.session';

const delay = (milliseconds = 220) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function readDatabase(): Database {
  const fallback: Database = {
    users: [],
    exams: [],
    categories: [],
    questions: [],
    attempts: [],
  };

  const raw = window.localStorage.getItem(DB_KEY);
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<Database>;
    return {
      users: parsed.users ?? [],
      exams: parsed.exams ?? [],
      categories: parsed.categories ?? [],
      questions: parsed.questions ?? [],
      attempts: parsed.attempts ?? [],
    };
  } catch {
    return fallback;
  }
}

function writeDatabase(database: Database) {
  window.localStorage.setItem(DB_KEY, JSON.stringify(database));
}

function readSession(): AuthSession | null {
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

function writeSession(session: AuthSession) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  window.localStorage.removeItem(SESSION_KEY);
}

function publicUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
  };
}

function currentStoredUser(): StoredUser | null {
  const session = readSession();
  if (!session) {
    return null;
  }

  const database = readDatabase();
  return database.users.find((user) => user.id === session.user.id) ?? null;
}

function requireCurrentUser(): StoredUser {
  const user = currentStoredUser();
  if (!user) {
    throw new Error('请先登录');
  }

  return user;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function createSession(user: StoredUser): AuthSession {
  const session = {
    user: publicUser(user),
    token: createId('token'),
  };
  writeSession(session);
  return session;
}

function normalizeStemHash(stem: string) {
  return stem
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，。！？、：；""''（）【】,.!?;:'"()]/g, '');
}

function getCategorySubtreeIds(
  database: Database,
  categoryId: string,
): string[] {
  const childIds = database.categories
    .filter((category) => category.parentId === categoryId)
    .map((category) => category.id);
  return [categoryId, ...childIds];
}

function computeCategoryStats(
  database: Database,
  category: StoredCategory,
  userId: string,
): CategoryStats {
  const categoryIds = new Set(getCategorySubtreeIds(database, category.id));
  const questionIds = database.questions
    .filter(
      (question) =>
        question.examId === category.examId &&
        categoryIds.has(question.categoryId),
    )
    .map((question) => question.id);
  const attempts = database.attempts.filter(
    (attempt) => attempt.userId === userId && questionIds.includes(attempt.questionId),
  );
  const passed = new Set(
    attempts
      .filter((attempt) => attempt.isCorrect === true)
      .map((attempt) => attempt.questionId),
  ).size;
  const errorCount = attempts.filter(
    (attempt) => attempt.isCorrect === false,
  ).length;

  return {
    total: questionIds.length,
    passed,
    answerCount: attempts.length,
    errorCount,
    errorRate: attempts.length > 0 ? errorCount / attempts.length : null,
  };
}

function toExam(
  exam: StoredExam,
  database: Database,
  userId: string,
): Exam {
  const ownCategories = database.categories.filter(
    (category) => category.examId === exam.id,
  );
  const topLevelCount = ownCategories.filter((category) => category.parentId === null).length;
  const questions = database.questions.filter(
    (question) => question.examId === exam.id,
  );
  const questionIds = new Set(questions.map((question) => question.id));
  const attempts = database.attempts.filter(
    (attempt) =>
      attempt.userId === userId && questionIds.has(attempt.questionId),
  );
  const passed = new Set(
    attempts
      .filter((attempt) => attempt.isCorrect === true)
      .map((attempt) => attempt.questionId),
  ).size;
  const lastPracticedAt = attempts.reduce<string | null>(
    (latest, attempt) => (!latest || attempt.createdAt > latest ? attempt.createdAt : latest),
    null,
  );

  return {
    id: exam.id,
    name: exam.name,
    description: exam.description,
    examDate: exam.examDate,
    categoryCount: topLevelCount,
    questionCount: questions.length,
    passedCount: passed,
    lastPracticedAt,
    createdAt: exam.createdAt,
  };
}

function toCategory(
  category: StoredCategory,
  database: Database,
  userId: string,
): Category {
  return {
    ...category,
    stats: computeCategoryStats(database, category, userId),
  };
}

export async function register(input: RegisterInput): Promise<AuthSession> {
  await delay();
  const database = readDatabase();
  const email = normalizeEmail(input.email);

  if (!email || !input.password) {
    throw new Error('邮箱和密码不能为空');
  }

  if (database.users.some((user) => user.email === email)) {
    throw new Error('该邮箱已注册');
  }

  const user: StoredUser = {
    id: createId('user'),
    email,
    password: input.password,
    nickname: input.nickname.trim(),
  };

  database.users.push(user);
  writeDatabase(database);
  return createSession(user);
}

export async function login(input: LoginInput): Promise<AuthSession> {
  await delay();
  const database = readDatabase();
  const email = normalizeEmail(input.email);
  const user = database.users.find((item) => item.email === email);

  if (!user || user.password !== input.password) {
    throw new Error('邮箱或密码错误');
  }

  return createSession(user);
}

export async function logout(): Promise<void> {
  await delay(80);
  clearSession();
}

export function getStoredSession(): AuthSession | null {
  return readSession();
}

export async function listExams(): Promise<Exam[]> {
  await delay();
  const user = requireCurrentUser();
  const database = readDatabase();

  return database.exams
    .filter((exam) => exam.userId === user.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((exam) => toExam(exam, database, user.id));
}

export async function getExam(examId: string): Promise<Exam> {
  await delay();
  const user = requireCurrentUser();
  const database = readDatabase();
  const exam = database.exams.find(
    (item) => item.id === examId && item.userId === user.id,
  );

  if (!exam) {
    throw new Error('考试不存在');
  }

  return toExam(exam, database, user.id);
}

export async function createExam(input: ExamInput): Promise<Exam> {
  await delay();
  const user = requireCurrentUser();
  const database = readDatabase();
  const name = input.name.trim();

  if (!name) {
    throw new Error('考试名称不能为空');
  }

  const exam: StoredExam = {
    id: createId('exam'),
    userId: user.id,
    name,
    description: input.description.trim(),
    examDate: input.examDate,
    createdAt: new Date().toISOString(),
  };

  database.exams.push(exam);
  writeDatabase(database);
  return toExam(exam, database, user.id);
}

export async function updateExam(
  examId: string,
  input: ExamInput,
): Promise<Exam> {
  await delay();
  const user = requireCurrentUser();
  const database = readDatabase();
  const exam = database.exams.find(
    (item) => item.id === examId && item.userId === user.id,
  );

  if (!exam) {
    throw new Error('考试不存在');
  }

  const name = input.name.trim();
  if (!name) {
    throw new Error('考试名称不能为空');
  }

  exam.name = name;
  exam.description = input.description.trim();
  exam.examDate = input.examDate;
  writeDatabase(database);
  return toExam(exam, database, user.id);
}

export async function deleteExam(examId: string): Promise<void> {
  await delay();
  const user = requireCurrentUser();
  const database = readDatabase();
  const exam = database.exams.find(
    (item) => item.id === examId && item.userId === user.id,
  );

  if (!exam) {
    throw new Error('考试不存在');
  }

  const questionIds = database.questions
    .filter((question) => question.examId === examId)
    .map((question) => question.id);

  database.exams = database.exams.filter((item) => item.id !== examId);
  database.categories = database.categories.filter(
    (category) => category.examId !== examId,
  );
  database.questions = database.questions.filter(
    (question) => question.examId !== examId,
  );
  database.attempts = database.attempts.filter(
    (attempt) => !questionIds.includes(attempt.questionId),
  );
  writeDatabase(database);
}

export async function listCategories(examId: string): Promise<Category[]> {
  await delay();
  const user = requireCurrentUser();
  const database = readDatabase();
  const exam = database.exams.find(
    (item) => item.id === examId && item.userId === user.id,
  );

  if (!exam) {
    throw new Error('考试不存在');
  }

  return database.categories
    .filter((category) => category.examId === examId)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
    .map((category) => toCategory(category, database, user.id));
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  await delay();
  const user = requireCurrentUser();
  const database = readDatabase();
  const name = input.name.trim();

  if (!name) {
    throw new Error('类目名称不能为空');
  }

  const exam = database.exams.find(
    (item) => item.id === input.examId && item.userId === user.id,
  );
  if (!exam) {
    throw new Error('考试不存在');
  }

  if (input.parentId) {
    const parent = database.categories.find(
      (category) =>
        category.id === input.parentId &&
        category.examId === input.examId &&
        category.userId === user.id,
    );

    if (!parent || parent.parentId !== null) {
      throw new Error('一期只支持一层子类目');
    }
  }

  const siblings = database.categories.filter(
    (category) =>
      category.examId === input.examId && category.parentId === input.parentId,
  );
  const sortOrder =
    siblings.reduce((max, category) => Math.max(max, category.sortOrder), 0) + 1;

  const category: StoredCategory = {
    id: createId('category'),
    userId: user.id,
    examId: input.examId,
    parentId: input.parentId,
    name,
    sortOrder,
  };

  database.categories.push(category);
  writeDatabase(database);
  return toCategory(category, database, user.id);
}

export async function updateCategory(
  categoryId: string,
  input: { name: string },
): Promise<Category> {
  await delay();
  const user = requireCurrentUser();
  const database = readDatabase();
  const category = database.categories.find(
    (item) => item.id === categoryId && item.userId === user.id,
  );

  if (!category) {
    throw new Error('类目不存在');
  }

  const name = input.name.trim();
  if (!name) {
    throw new Error('类目名称不能为空');
  }

  category.name = name;
  writeDatabase(database);
  return toCategory(category, database, user.id);
}

export async function deleteCategory(categoryId: string): Promise<void> {
  await delay();
  const user = requireCurrentUser();
  const database = readDatabase();
  const category = database.categories.find(
    (item) => item.id === categoryId && item.userId === user.id,
  );

  if (!category) {
    throw new Error('类目不存在');
  }

  const categoryIds = getCategorySubtreeIds(database, categoryId);
  const questionIds = database.questions
    .filter((question) => categoryIds.includes(question.categoryId))
    .map((question) => question.id);

  database.categories = database.categories.filter(
    (item) => item.id !== categoryId && item.parentId !== categoryId,
  );
  database.questions = database.questions.filter(
    (question) => !categoryIds.includes(question.categoryId),
  );
  database.attempts = database.attempts.filter(
    (attempt) => !questionIds.includes(attempt.questionId),
  );
  writeDatabase(database);
}

function validateQuestionInput(input: QuestionInput) {
  const stem = input.stem.trim();
  if (!stem) {
    throw new Error('题干不能为空');
  }

  if (input.type === 'single_choice' || input.type === 'multi_choice') {
    if (input.options.length < 2) {
      throw new Error('选择题至少需要 2 个选项');
    }

    if (input.type === 'single_choice') {
      if (!/^[A-Z]$/.test(input.answer.trim())) {
        throw new Error('单选题答案必须是单个选项字母');
      }
    } else {
      let answerList: unknown;
      try {
        answerList = JSON.parse(input.answer);
      } catch {
        throw new Error('多选题答案格式不正确');
      }

      if (
        !Array.isArray(answerList) ||
        answerList.length === 0 ||
        !answerList.every((item) => typeof item === 'string' && /^[A-Z]$/.test(item))
      ) {
        throw new Error('多选题答案必须是选项字母数组');
      }
    }
  }

  if (
    (input.type === 'fill_blank' || input.type === 'short_answer') &&
    !input.answer.trim()
  ) {
    throw new Error('请输入参考答案');
  }
}

function findOwnQuestion(
  database: Database,
  questionId: string,
  userId: string,
) {
  const question = database.questions.find(
    (item) => item.id === questionId,
  );
  if (!question) {
    throw new Error('题目不存在');
  }

  const exam = database.exams.find(
    (item) => item.id === question.examId && item.userId === userId,
  );
  if (!exam) {
    throw new Error('题目不存在');
  }

  return question;
}

function findOwnCategory(
  database: Database,
  categoryId: string,
  examId: string,
  userId: string,
) {
  const category = database.categories.find(
    (item) => item.id === categoryId && item.examId === examId && item.userId === userId,
  );
  if (!category) {
    throw new Error('类目不存在');
  }
  return category;
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

function judgeAnswer(question: Question, answer: string): boolean | null {
  if (question.type === 'single_choice') {
    return normalizeAnswer(answer) === question.answer.toUpperCase();
  }

  if (question.type === 'multi_choice') {
    const expected = parseMultiAnswer(question.answer);
    const actual = parseMultiAnswer(answer);
    return JSON.stringify(expected) === JSON.stringify(actual);
  }

  if (question.type === 'fill_blank') {
    return answer.trim().toLowerCase() === question.answer.trim().toLowerCase();
  }

  return null;
}

function getWrongBookItems(
  database: Database,
  userId: string,
): WrongBookItem[] {
  const questionIds = database.questions
    .filter((question) => {
      const exam = database.exams.find(
        (item) => item.id === question.examId && item.userId === userId,
      );
      return Boolean(exam);
    })
    .map((question) => question.id);
  const attemptsByQuestion = database.attempts
    .filter(
      (attempt) =>
        attempt.userId === userId && questionIds.includes(attempt.questionId),
    )
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  const items: WrongBookItem[] = [];

  for (const questionId of new Set(attemptsByQuestion.map((attempt) => attempt.questionId))) {
    const question = database.questions.find((item) => item.id === questionId);
    if (!question) {
      continue;
    }

    const attempts = attemptsByQuestion.filter(
      (attempt) => attempt.questionId === questionId,
    );
    const latest = attempts.at(-1);
    if (!latest || latest.isCorrect === null) {
      continue;
    }

    const hasWrong = attempts.some((attempt) => attempt.isCorrect === false);
    if (!hasWrong && latest.isCorrect === false) {
      continue;
    }

    const exam = database.exams.find((item) => item.id === question.examId);
    const category = database.categories.find(
      (item) => item.id === question.categoryId,
    );

    items.push({
      question,
      examName: exam?.name ?? '未知考试',
      categoryName: category?.name ?? '未知类目',
      wrongCount: attempts.filter((attempt) => attempt.isCorrect === false).length,
      lastAttemptAt: latest.createdAt,
      corrected: latest.isCorrect === true,
    });
  }

  return items.sort(
    (left, right) =>
      right.wrongCount - left.wrongCount ||
      right.lastAttemptAt.localeCompare(left.lastAttemptAt),
  );
}

export async function listQuestions(
  examId: string,
  categoryId?: string,
): Promise<Question[]> {
  await delay();
  const user = requireCurrentUser();
  const database = readDatabase();
  const exam = database.exams.find(
    (item) => item.id === examId && item.userId === user.id,
  );
  if (!exam) {
    throw new Error('考试不存在');
  }

  if (categoryId) {
    findOwnCategory(database, categoryId, examId, user.id);
  }

  const categoryIds = categoryId
    ? new Set(getCategorySubtreeIds(database, categoryId))
    : null;

  return database.questions
    .filter(
      (question) =>
        question.examId === examId &&
        (!categoryIds || categoryIds.has(question.categoryId)),
    )
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function createQuestion(input: QuestionInput): Promise<Question> {
  await delay();
  const user = requireCurrentUser();
  const database = readDatabase();
  const exam = database.exams.find(
    (item) => item.id === input.examId && item.userId === user.id,
  );
  if (!exam) {
    throw new Error('考试不存在');
  }
  findOwnCategory(database, input.categoryId, input.examId, user.id);
  validateQuestionInput(input);

  const stemHash = normalizeStemHash(input.stem);
  if (
    database.questions.some(
      (question) =>
        question.examId === input.examId && question.stemHash === stemHash,
    )
  ) {
    throw new Error('该考试下已存在相同题干');
  }

  const question: StoredQuestion = {
    id: createId('question'),
    examId: input.examId,
    categoryId: input.categoryId,
    type: input.type,
    stem: input.stem.trim(),
    options: input.options,
    answer: input.answer,
    explanation: input.explanation.trim(),
    stemHash,
    createdAt: new Date().toISOString(),
  };

  database.questions.push(question);
  writeDatabase(database);
  return question;
}

export async function updateQuestion(
  questionId: string,
  input: QuestionInput,
): Promise<Question> {
  await delay();
  const user = requireCurrentUser();
  const database = readDatabase();
  const question = findOwnQuestion(database, questionId, user.id);
  findOwnCategory(database, input.categoryId, input.examId, user.id);
  validateQuestionInput(input);

  const stemHash = normalizeStemHash(input.stem);
  if (
    database.questions.some(
      (item) =>
        item.examId === input.examId &&
        item.id !== questionId &&
        item.stemHash === stemHash,
    )
  ) {
    throw new Error('该考试下已存在相同题干');
  }

  question.examId = input.examId;
  question.categoryId = input.categoryId;
  question.type = input.type;
  question.stem = input.stem.trim();
  question.options = input.options;
  question.answer = input.answer;
  question.explanation = input.explanation.trim();
  question.stemHash = stemHash;
  writeDatabase(database);
  return question;
}

export async function deleteQuestion(questionId: string): Promise<void> {
  await delay();
  const user = requireCurrentUser();
  const database = readDatabase();
  findOwnQuestion(database, questionId, user.id);

  database.questions = database.questions.filter(
    (question) => question.id !== questionId,
  );
  database.attempts = database.attempts.filter(
    (attempt) => attempt.questionId !== questionId,
  );
  writeDatabase(database);
}

export async function listPracticeQuestions(
  examId: string,
  categoryId?: string,
  mode: PracticeMode = 'all',
): Promise<Question[]> {
  await delay();
  const user = requireCurrentUser();
  const database = readDatabase();

  if (mode === 'wrong') {
    const wrongQuestionIds = getWrongBookItems(database, user.id)
      .filter((item) => !item.corrected)
      .map((item) => item.question.id);

    return database.questions.filter(
      (question) =>
        question.examId === examId &&
        wrongQuestionIds.includes(question.id) &&
        (!categoryId || question.categoryId === categoryId),
    );
  }

  return listQuestions(examId, categoryId);
}

export async function submitAttempt(
  questionId: string,
  answer: string,
): Promise<Attempt> {
  await delay();
  const user = requireCurrentUser();
  const database = readDatabase();
  const question = findOwnQuestion(database, questionId, user.id);
  const isCorrect = judgeAnswer(question, answer);

  const attempt: StoredAttempt = {
    id: createId('attempt'),
    userId: user.id,
    questionId,
    answer,
    isCorrect,
    createdAt: new Date().toISOString(),
  };

  database.attempts.push(attempt);
  writeDatabase(database);
  return attempt;
}

export async function listWrongBook(): Promise<WrongBookItem[]> {
  await delay();
  const user = requireCurrentUser();
  return getWrongBookItems(readDatabase(), user.id);
}
