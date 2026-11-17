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

export type QuestionType =
  | 'single_choice'
  | 'multi_choice'
  | 'fill_blank'
  | 'true_false'
  | 'short_answer';

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

export type PracticeAnswerInput = {
  questionId: string;
  answer: string;
  durationMs?: number;
};

export type PracticeQuestionResult = {
  question: Question;
  attempt: Attempt;
};

export type PracticeSessionSummary = {
  id: string;
  examId: string;
  categoryId: string | null;
  mode: string;
  total: number;
  correctCount: number;
  wrongCount: number;
  pendingCount: number;
  createdAt: string;
};

export type PracticeSessionDetail = PracticeSessionSummary & {
  results: PracticeQuestionResult[];
};

export type PracticeSubmitResult = {
  sessionId: string;
  examId: string;
  categoryId: string | null;
  mode: string;
  total: number;
  correctCount: number;
  wrongCount: number;
  pendingCount: number;
  createdAt: string;
  results: PracticeQuestionResult[];
};

export type ImportStatus =
  | 'queued'
  | 'processing'
  | 'ready'
  | 'confirmed'
  | 'failed';

export type ImportProgress = {
  totalChunks: number;
  doneChunks: number;
  questionCount: number;
};

export type ImportDraftQuestion = {
  type: QuestionType;
  stem: string;
  options: string[];
  answer: string;
  explanation: string;
  categoryId: string;
  categoryHint: string;
  confidence: number;
  duplicate: boolean;
};

export type ImportJob = {
  id: string;
  userId: string;
  examId: string;
  targetCategoryId: string | null;
  status: ImportStatus;
  progressJson: ImportProgress;
  resultJson: {
    questions: ImportDraftQuestion[];
  } | null;
  error: string | null;
  promptVersion: string | null;
  model: string | null;
  tokenUsage: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateImportInput = {
  examId: string;
  targetCategoryId: string | null;
  rawText: string;
};

export type ConfirmImportInput = {
  questions: Array<
    ImportDraftQuestion & {
      selected: boolean;
    }
  >;
  createCategories?: string[];
};

export type ConfirmImportResult = {
  imported: number;
  skipped: number;
  questionIds: string[];
};
