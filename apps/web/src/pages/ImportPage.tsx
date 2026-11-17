import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import * as api from '@/api/client';
import { Toast } from '@/components/feedback';
import {
  Button,
  Empty,
  Input,
  NavBar,
  Popup,
  Picker,
  ProgressBar,
  SpinLoading,
  Tag,
  TextArea,
} from '@/components/ui';
import type {
  ConfirmImportResult,
  ImportDraftQuestion,
  QuestionType,
} from '@/types';

const questionTypeLabels: Record<QuestionType, string> = {
  single_choice: '单选题',
  multi_choice: '多选题',
  fill_blank: '填空题',
  true_false: '判断题',
  short_answer: '主观题',
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请重试';
}

const DraftQuestionRow = memo(function DraftQuestionRow({
  question,
  index,
  checked,
  onToggle,
}: {
  question: ImportDraftQuestion;
  index: number;
  checked: boolean;
  onToggle: (index: number, checked: boolean) => void;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        question.duplicate
          ? 'border-[#f0f1f3] bg-[#fafbfc]'
          : 'border-[#e6ebf2] bg-white'
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onToggle(index, event.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-[#3d7eff]"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-[#eaf1ff] px-2 py-0.5 font-medium text-[#3d7eff]">
              {questionTypeLabels[question.type]}
            </span>
            {question.confidence < 0.7 && (
              <span className="rounded-full bg-[#fff4e5] px-2 py-0.5 font-medium text-[#c47a00]">
                需校对 {Math.round(question.confidence * 100)}%
              </span>
            )}
            {question.duplicate && (
              <span className="rounded-full bg-[#fff1f0] px-2 py-0.5 font-medium text-[#d94c4c]">
                与已有题目重复
              </span>
            )}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm font-medium text-[#26292e]">
            {question.stem}
          </p>
          {question.options.length > 0 && (
            <div className="mt-2 space-y-1 text-xs text-[#6f7681]">
              {question.options.map((option) => (
                <div key={option}>{option}</div>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-[#3d7eff]">答案：{question.answer}</p>
          <p className="mt-1 text-xs text-[#9aa0a8]">
            类目：{question.categoryHint}
          </p>
        </div>
      </div>
    </div>
  );
});

export function ImportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { examId = '' } = useParams();
  const [rawText, setRawText] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [confirmResult, setConfirmResult] =
    useState<ConfirmImportResult | null>(null);
  const [categoryPopupVisible, setCategoryPopupVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const updateSelected = useCallback((index: number, checked: boolean) => {
    setSelected((current) => ({
      ...current,
      [index]: checked,
    }));
  }, []);

  const examQuery = useQuery({
    queryKey: ['exam', examId],
    queryFn: () => api.getExam(examId),
    enabled: Boolean(examId),
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories', examId],
    queryFn: () => api.listCategories(examId),
    enabled: Boolean(examId),
  });

  const createCategoryMutation = useMutation({
    mutationFn: () =>
      api.createCategory({
        examId,
        parentId: null,
        name: newCategoryName.trim(),
      }),
    onSuccess: async (category) => {
      setCategoryId(category.id);
      setNewCategoryName('');
      setCategoryPopupVisible(false);
      await queryClient.invalidateQueries({ queryKey: ['categories', examId] });
    },
    onError: (error) => {
      Toast.show({ icon: 'fail', content: errorMessage(error) });
    },
  });

  const createImportMutation = useMutation({
    mutationFn: () =>
      api.createImport({
        examId,
        targetCategoryId: categoryId,
        rawText: rawText.trim(),
      }),
    onSuccess: (job) => {
      setJobId(job.id);
      setSelected({});
      setConfirmResult(null);
    },
    onError: (error) => {
      Toast.show({ icon: 'fail', content: errorMessage(error) });
    },
  });

  const jobQuery = useQuery({
    queryKey: ['import-job', jobId],
    queryFn: () => api.getImportJob(jobId ?? ''),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'queued' || status === 'processing' ? 1500 : false;
    },
  });

  const drafts = useMemo(
    () => jobQuery.data?.resultJson?.questions ?? [],
    [jobQuery.data?.resultJson],
  );

  useEffect(() => {
    if (jobQuery.data?.status !== 'ready' || drafts.length === 0) {
      return;
    }

    setSelected((current) => {
      if (Object.keys(current).length > 0) {
        return current;
      }

      return Object.fromEntries(
        drafts.map((question, index) => [index, !question.duplicate]),
      );
    });
  }, [drafts, jobQuery.data?.status]);

  const confirmMutation = useMutation({
    mutationFn: () =>
      api.confirmImport(jobId ?? '', {
        questions: drafts.map((question, index) => ({
          ...question,
          selected: selected[index] ?? !question.duplicate,
        })),
      }),
    onSuccess: (result) => {
      setConfirmResult(result);
      Toast.show({
        icon: 'success',
        content: `已导入 ${result.imported} 道题，跳过 ${result.skipped} 道`,
      });
      void queryClient.invalidateQueries({ queryKey: ['import-job', jobId] });
      void queryClient.invalidateQueries({ queryKey: ['questions', examId] });
    },
    onError: (error) => {
      Toast.show({ icon: 'fail', content: errorMessage(error) });
    },
  });

  const retryMutation = useMutation({
    mutationFn: () => api.retryImport(jobId ?? ''),
    onSuccess: () => {
      setConfirmResult(null);
      void queryClient.invalidateQueries({ queryKey: ['import-job', jobId] });
    },
    onError: (error) => {
      Toast.show({ icon: 'fail', content: errorMessage(error) });
    },
  });

  if (examQuery.isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f6f8]">
        <SpinLoading color="primary" />
      </main>
    );
  }

  if (examQuery.isError || !examQuery.data) {
    return (
      <main className="min-h-screen bg-[#f5f6f8]">
        <NavBar onBack={() => navigate(-1)}>导入</NavBar>
        <div className="px-5 py-12 text-center">
          <Empty description="考试不存在或已删除" />
        </div>
      </main>
    );
  }

  const categories = categoriesQuery.data ?? [];
  const categoryOptions = categories.map((category) => ({
    label: category.name,
    value: category.id,
  }));
  const job = jobQuery.data;
  const progress = job?.progressJson;
  const progressPercent =
    progress && progress.totalChunks > 0
      ? Math.round((progress.doneChunks / progress.totalChunks) * 100)
      : 0;
  const selectedCount = Object.values(selected).filter(Boolean).length;

  function handleStartImport() {
    if (!rawText.trim()) {
      Toast.show({
        icon: 'fail',
        content: '请先粘贴需要解析的文本',
      });
      return;
    }

    createImportMutation.mutate();
  }

  const renderJob = () => {
    if (!job) {
      return (
        <div className="mt-6 grid place-items-center py-10">
          <SpinLoading color="primary" />
          <p className="mt-3 text-sm text-[#9aa0a8]">正在创建导入任务...</p>
        </div>
      );
    }

    if (job.status === 'queued' || job.status === 'processing') {
      return (
        <div className="mt-6 rounded-2xl bg-white p-5">
          <div className="flex items-center gap-3">
            <SpinLoading color="primary" />
            <div>
              <div className="text-sm font-medium text-[#26292e]">
                {job.status === 'queued' ? '任务已创建，等待解析' : '正在解析题目'}
              </div>
              <div className="mt-1 text-xs text-[#9aa0a8]">
                已处理 {progress?.doneChunks ?? 0}/{progress?.totalChunks ?? 0} 段
              </div>
            </div>
          </div>
          <ProgressBar percent={progressPercent} className="mt-4" />
        </div>
      );
    }

    if (job.status === 'failed') {
      return (
        <div className="mt-6 rounded-2xl bg-white p-5 text-center">
          <p className="text-sm font-medium text-[#26292e]">解析失败</p>
          <p className="mt-2 text-xs text-[#d94c4c]">
            {job.error ?? '请检查文本格式后重试'}
          </p>
          <Button
            block
            color="primary"
            className="mt-4"
            loading={retryMutation.isPending}
            onClick={() => retryMutation.mutate()}
          >
            重新解析
          </Button>
        </div>
      );
    }

    if (job.status === 'confirmed' || confirmResult) {
      return (
        <div className="mt-6 rounded-2xl bg-white p-5 text-center">
          <p className="text-base font-semibold text-[#26292e]">导入完成</p>
          <p className="mt-2 text-sm text-[#6f7681]">
            已导入 {confirmResult?.imported ?? 0} 道题，跳过{' '}
            {confirmResult?.skipped ?? 0} 道
          </p>
          <Button
            block
            color="primary"
            className="mt-5"
            onClick={() => navigate(`/exams/${examId}`)}
          >
            返回考试
          </Button>
        </div>
      );
    }

    return (
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#26292e]">解析结果</p>
            <p className="mt-1 text-xs text-[#9aa0a8]">
              共 {drafts.length} 道题，已选择 {selectedCount} 道
            </p>
          </div>
          <Tag color="primary">{drafts.length} 题</Tag>
        </div>
        <div className="space-y-3">
          {drafts.map((question, index) => (
            <DraftQuestionRow
              key={`${question.stem}-${index}`}
              question={question}
              index={index}
              checked={selected[index] ?? !question.duplicate}
              onToggle={updateSelected}
            />
          ))}
        </div>
        <Button
          block
          color="primary"
          size="large"
          className="mt-4"
          loading={confirmMutation.isPending}
          disabled={selectedCount === 0}
          onClick={() => confirmMutation.mutate()}
        >
          确认导入 {selectedCount} 道题
        </Button>
      </div>
    );
  };

  if (jobId) {
    return (
      <main className="min-h-screen bg-[#f5f6f8] pb-8">
        <NavBar onBack={() => navigate(`/exams/${examId}`)}>
          导入题目
        </NavBar>
        <div className="mx-auto w-full max-w-[560px] px-4 pt-3">
          <div className="rounded-xl bg-white px-4 py-3 text-sm text-[#26292e]">
            {examQuery.data.name}
          </div>
          {renderJob()}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f6f8] pb-8">
      <NavBar onBack={() => navigate(-1)}>导入题目</NavBar>

      <div className="mx-auto w-full max-w-[560px] px-4 pt-3">
        <div className="rounded-2xl bg-white p-4">
          <div className="mb-3 text-sm font-semibold text-[#26292e]">
            {examQuery.data.name}
          </div>

          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs text-[#9aa0a8]">目标类目</div>
              <button
                type="button"
                className="bg-transparent text-xs font-medium text-[#3d7eff]"
                onClick={() => setCategoryPopupVisible(true)}
              >
                ＋ 新增类目
              </button>
            </div>
            <Picker
              columns={[categoryOptions]}
              value={categoryId ? [categoryId] : []}
              onConfirm={(value) => {
                const next = value[0];
                setCategoryId(
                  typeof next === 'string' || typeof next === 'number'
                    ? String(next)
                    : null,
                );
              }}
            >
              {(_, { open }) => (
                <button
                  type="button"
                  onClick={open}
                  className="flex h-11 w-full items-center justify-between rounded-xl border border-line bg-surface px-3 text-sm text-ink"
                >
                  <span>
                    {categories.find((category) => category.id === categoryId)?.name ??
                      '不指定，自动使用未分类'}
                  </span>
                  <span className="text-muted">选择</span>
                </button>
              )}
            </Picker>
            {categories.length === 0 && (
              <p className="mt-2 text-xs text-[#c47a00]">
                当前考试还没有类目，请先新增一个类目
              </p>
            )}
          </div>

          <TextArea
            value={rawText}
            onChange={setRawText}
            placeholder="粘贴教材重点、真题、笔记或公众号文章"
            rows={12}
            showCount
            maxLength={30000}
          />

          <Button
            block
            color="primary"
            size="large"
            className="mt-4"
            loading={createImportMutation.isPending}
            onClick={handleStartImport}
          >
            开始解析
          </Button>

          <p className="mt-3 text-center text-xs text-[#9aa0a8]">
            解析完成后先校对，确认后才会写入题库
          </p>
        </div>
      </div>

      <Popup
        visible={categoryPopupVisible}
        onMaskClick={() => setCategoryPopupVisible(false)}
        position="bottom"
        bodyStyle={{ borderRadius: '16px 16px 0 0', padding: '18px 16px 20px' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#26292e]">新增类目</h2>
          <button
            type="button"
            className="bg-transparent text-xl text-[#9aa0a8]"
            onClick={() => setCategoryPopupVisible(false)}
          >
            ×
          </button>
        </div>
        <Input
          value={newCategoryName}
          onChange={setNewCategoryName}
          placeholder="例如：教育心理学"
          clearable
          className="mt-2"
        />
        <Button
          block
          color="primary"
          size="large"
          className="mt-4"
          loading={createCategoryMutation.isPending}
          disabled={!newCategoryName.trim()}
          onClick={() => createCategoryMutation.mutate()}
        >
          创建并选中
        </Button>
      </Popup>
    </main>
  );
}
