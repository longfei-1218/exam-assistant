import type {
  Attempt,
  AuthSession,
  AuthUser,
  Category,
  CategoryInput,
  ConfirmImportInput,
  ConfirmImportResult,
  CreateImportInput,
  Exam,
  ExamInput,
  ImportJob,
  LlmConfig,
  LoginInput,
  PracticeAnswerInput,
  PracticeMode,
  PracticeSessionDetail,
  PracticeSessionSummary,
  PracticeSubmitResult,
  Question,
  QuestionInput,
  RegisterInput,
  UpdateProfileInput,
  WrongBookItem,
} from '@/types';
import { DEFAULT_LLM_CONFIG } from '@/types';

const SESSION_KEY = 'exam-assistant.session';
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3001';
export const AUTH_SESSION_EXPIRED_EVENT = 'exam-assistant:auth-session-expired';

type ApiErrorPayload = {
  message?: string;
  code?: string;
};

type AuthApiUser = {
  id: string;
  email: string;
  nickname: string;
  avatarUrl: string | null;
  llmConfig: Omit<LlmConfig, 'apiToken'>;
};

type AuthApiSession = {
  user: AuthApiUser;
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
};

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function apiRequest<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (init.token) {
    headers.set('Authorization', `Bearer ${init.token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      signal: init.signal ?? controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiClientError(
        '请求超时，请检查后端服务是否已启动',
        0,
        'REQUEST_TIMEOUT',
      );
    }
    throw new ApiClientError(
      '无法连接后端服务，请检查 3001 端口',
      0,
      'NETWORK_ERROR',
    );
  } finally {
    window.clearTimeout(timeout);
  }
  const raw = await response.text();
  let data: unknown = null;

  if (raw) {
    try {
      data = JSON.parse(raw) as unknown;
    } catch {
      data = raw;
    }
  }

  if (!response.ok) {
    const payload =
      typeof data === 'object' && data !== null
        ? (data as ApiErrorPayload)
        : null;
    throw new ApiClientError(
      payload?.message ?? `请求失败 (${response.status})`,
      response.status,
      payload?.code,
    );
  }

  return data as T;
}

function normalizeUserProfile(user: AuthApiUser): AuthUser {
  const model = user.llmConfig?.model;

  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl ?? null,
    llmConfig: {
      provider:
        user.llmConfig?.provider === 'deepseek'
          ? user.llmConfig.provider
          : DEFAULT_LLM_CONFIG.provider,
      model:
        model === 'deepseek-pro' ||
        model === 'deepseek-flash' ||
        model === 'deepseek-chat'
          ? model
          : DEFAULT_LLM_CONFIG.model,
      apiToken: '',
      configured: user.llmConfig?.configured ?? false,
      apiTokenMasked: user.llmConfig?.apiTokenMasked ?? null,
    },
  };
}

function readSession(): AuthSession | null {
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const session = JSON.parse(raw) as AuthSession;
    if (!session.token?.startsWith('eyJ') || !session.refreshToken?.startsWith('rt_')) {
      clearSession();
      return null;
    }

    return {
      ...session,
      user: normalizeUserProfile(session.user as unknown as AuthApiUser),
    };
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

function normalizeAuthSession(session: AuthApiSession): AuthSession {
  return {
    user: normalizeUserProfile(session.user),
    token: session.accessToken,
    refreshToken: session.refreshToken,
    expiresIn: session.expiresIn,
  };
}

let refreshInFlight: Promise<AuthSession> | null = null;

async function performRefreshAuthSession(): Promise<AuthSession> {
  const session = readSession();
  if (!session) {
    throw new Error('请先登录');
  }

  const refreshed = await apiRequest<{
    accessToken: string;
    refreshToken: string;
    expiresIn?: number;
  }>('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({
      refreshToken: session.refreshToken,
    }),
  });
  const nextSession: AuthSession = {
    ...session,
    token: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    expiresIn: refreshed.expiresIn,
  };
  writeSession(nextSession);
  return nextSession;
}

function refreshAuthSession(): Promise<AuthSession> {
  if (!refreshInFlight) {
    refreshInFlight = performRefreshAuthSession().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function authenticatedRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const session = readSession();
  if (!session) {
    window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
    throw new ApiClientError('请先登录', 401, 'SESSION_REQUIRED');
  }

  try {
    return await apiRequest<T>(path, {
      ...init,
      token: session.token,
    });
  } catch (error) {
    if (!(error instanceof ApiClientError) || error.statusCode !== 401) {
      throw error;
    }

    try {
      const refreshed = await refreshAuthSession();
      return await apiRequest<T>(path, {
        ...init,
        token: refreshed.token,
      });
    } catch (refreshError) {
      if (
        refreshError instanceof ApiClientError &&
        refreshError.statusCode === 401
      ) {
        clearSession();
        window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
        throw new ApiClientError(
          '登录状态已过期，请重新登录',
          401,
          'SESSION_EXPIRED',
        );
      }
      throw refreshError;
    }
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function register(input: RegisterInput): Promise<AuthSession> {
  const session = await apiRequest<AuthApiSession>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: normalizeEmail(input.email),
      password: input.password,
      nickname: input.nickname.trim() || undefined,
    }),
  });
  const normalizedSession = normalizeAuthSession(session);
  writeSession(normalizedSession);
  return normalizedSession;
}

export async function login(input: LoginInput): Promise<AuthSession> {
  const session = await apiRequest<AuthApiSession>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: normalizeEmail(input.email),
      password: input.password,
    }),
  });
  const normalizedSession = normalizeAuthSession(session);
  writeSession(normalizedSession);
  return normalizedSession;
}

export async function logout(): Promise<void> {
  const session = readSession();
  if (session) {
    try {
      await apiRequest('/api/auth/logout', {
        method: 'POST',
        token: session.token,
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
    } finally {
      clearSession();
    }
  }
}

export async function updateProfile(input: UpdateProfileInput): Promise<AuthUser> {
  const user = await authenticatedRequest<AuthUser>('/api/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  const normalizedUser = normalizeUserProfile(user as unknown as AuthApiUser);
  const session = readSession();
  if (session) {
    writeSession({ ...session, user: normalizedUser });
  }
  return normalizedUser;
}

export function getStoredSession(): AuthSession | null {
  return readSession();
}

export async function listExams(): Promise<Exam[]> {
  return authenticatedRequest<Exam[]>('/api/exams');
}

export async function getExam(examId: string): Promise<Exam> {
  return authenticatedRequest<Exam>(`/api/exams/${encodeURIComponent(examId)}`);
}

export async function createExam(input: ExamInput): Promise<Exam> {
  return authenticatedRequest<Exam>('/api/exams', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateExam(
  examId: string,
  input: ExamInput,
): Promise<Exam> {
  return authenticatedRequest<Exam>(
    `/api/exams/${encodeURIComponent(examId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export async function deleteExam(examId: string): Promise<void> {
  await authenticatedRequest(`/api/exams/${encodeURIComponent(examId)}`, {
    method: 'DELETE',
  });
}

export async function listCategories(examId: string): Promise<Category[]> {
  return authenticatedRequest<Category[]>(
    `/api/categories?examId=${encodeURIComponent(examId)}`,
  );
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  return authenticatedRequest<Category>('/api/categories', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateCategory(
  categoryId: string,
  input: { name: string },
): Promise<Category> {
  return authenticatedRequest<Category>(
    `/api/categories/${encodeURIComponent(categoryId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export async function deleteCategory(categoryId: string): Promise<void> {
  await authenticatedRequest(
    `/api/categories/${encodeURIComponent(categoryId)}`,
    {
      method: 'DELETE',
    },
  );
}

export async function listQuestions(
  examId: string,
  categoryId?: string,
): Promise<Question[]> {
  const query = new URLSearchParams({ examId });
  if (categoryId) {
    query.set('categoryId', categoryId);
  }
  return authenticatedRequest<Question[]>(`/api/questions?${query.toString()}`);
}

export async function createQuestion(input: QuestionInput): Promise<Question> {
  return authenticatedRequest<Question>('/api/questions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateQuestion(
  questionId: string,
  input: QuestionInput,
): Promise<Question> {
  return authenticatedRequest<Question>(
    `/api/questions/${encodeURIComponent(questionId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export async function deleteQuestion(questionId: string): Promise<void> {
  await authenticatedRequest(
    `/api/questions/${encodeURIComponent(questionId)}`,
    {
      method: 'DELETE',
    },
  );
}

export async function listPracticeQuestions(
  examId: string,
  categoryId?: string,
  mode: PracticeMode = 'all',
): Promise<Question[]> {
  const response = await authenticatedRequest<{
    mode: string;
    questions: Question[];
  }>('/api/practice/session', {
    method: 'POST',
    body: JSON.stringify({
      examId,
      categoryId,
      mode: mode === 'wrong' ? 'wrong' : 'all',
      shuffle: false,
    }),
  });
  return response.questions;
}

export async function submitAttempt(
  questionId: string,
  answer: string,
): Promise<Attempt> {
  return authenticatedRequest<Attempt>('/api/attempts', {
    method: 'POST',
    body: JSON.stringify({ questionId, answer }),
  });
}

export async function submitPracticeAnswers(
  examId: string,
  answers: PracticeAnswerInput[],
  options?: {
    categoryId?: string;
    mode?: PracticeMode;
  },
): Promise<PracticeSubmitResult> {
  return authenticatedRequest<PracticeSubmitResult>('/api/practice/submit', {
    method: 'POST',
    body: JSON.stringify({
      examId,
      categoryId: options?.categoryId,
      mode: options?.mode ?? 'all',
      answers,
    }),
  });
}

export async function listPracticeSessions(
  examId: string,
): Promise<PracticeSessionSummary[]> {
  return authenticatedRequest<PracticeSessionSummary[]>(
    `/api/practice/records?examId=${encodeURIComponent(examId)}`,
  );
}

export async function getPracticeSession(
  sessionId: string,
): Promise<PracticeSessionDetail> {
  return authenticatedRequest<PracticeSessionDetail>(
    `/api/practice/records/${encodeURIComponent(sessionId)}`,
  );
}

export async function listWrongBook(): Promise<WrongBookItem[]> {
  return authenticatedRequest<WrongBookItem[]>('/api/wrong-book');
}

export async function createImport(input: CreateImportInput): Promise<ImportJob> {
  return authenticatedRequest<ImportJob>('/api/imports', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getImportJob(jobId: string): Promise<ImportJob> {
  return authenticatedRequest<ImportJob>(
    `/api/imports/${encodeURIComponent(jobId)}`,
  );
}

export async function confirmImport(
  jobId: string,
  input: ConfirmImportInput,
): Promise<ConfirmImportResult> {
  return authenticatedRequest<ConfirmImportResult>(
    `/api/imports/${encodeURIComponent(jobId)}/confirm`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export async function retryImport(jobId: string): Promise<ImportJob> {
  return authenticatedRequest<ImportJob>(
    `/api/imports/${encodeURIComponent(jobId)}/retry`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  );
}
