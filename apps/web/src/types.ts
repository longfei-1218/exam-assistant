export type LlmProvider = 'deepseek';

export type LlmModel = 'deepseek-chat' | 'deepseek-flash' | 'deepseek-pro';

export type LlmConfig = {
  provider: LlmProvider;
  model: LlmModel;
  apiToken: string;
  configured?: boolean;
  apiTokenMasked?: string | null;
};

export const DEFAULT_LLM_CONFIG: LlmConfig = {
  provider: 'deepseek',
  model: 'deepseek-flash',
  apiToken: '',
};

export type AuthUser = {
  id: string;
  email: string;
  nickname: string;
  avatarUrl: string | null;
  llmConfig: LlmConfig;
};

export type AuthSession = {
  user: AuthUser;
  token: string;
  refreshToken: string;
  expiresIn?: number;
};

export type CategoryStats = {
  total: number;
  passed: number;
  answerCount: number;
  errorCount: number;
  errorRate: number | null;
};

export type Category = {
  id: string;
  examId: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
  stats: CategoryStats;
};

export type Exam = {
  id: string;
  name: string;
  description: string;
  examDate: string | null;
  categoryCount: number;
  questionCount: number;
  passedCount: number;
  lastPracticedAt: string | null;
  createdAt: string;
};

export type RegisterInput = {
  email: string;
  password: string;
  nickname: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type UpdateProfileInput = {
  nickname: string;
  avatarUrl: string | null;
  llmConfig: Omit<LlmConfig, 'apiToken'> & {
    apiToken?: string | null;
  };
};

export type ExamInput = {
  name: string;
  description: string;
  examDate: string | null;
};

export type CategoryInput = {
  examId: string;
  parentId: string | null;
  name: string;
};

export type QuestionType = 'single_choice' | 'multi_choice' | 'fill_blank' | 'short_answer';

export type Question = {
  id: string;
  examId: string;
  categoryId: string;
  type: QuestionType;
  stem: string;
  options: string[];
  answer: string;
  explanation: string;
  stemHash: string;
  createdAt: string;
};

export type QuestionInput = {
  examId: string;
  categoryId: string;
  type: QuestionType;
  stem: string;
  options: string[];
  answer: string;
  explanation: string;
};

export type Attempt = {
  id: string;
  userId: string;
  questionId: string;
  answer: string;
  isCorrect: boolean | null;
  createdAt: string;
};

export type WrongBookItem = {
  question: Question;
  examName: string;
  categoryName: string;
  wrongCount: number;
  lastAttemptAt: string;
  corrected: boolean;
};

export type PracticeMode = 'all' | 'wrong' | 'category';
