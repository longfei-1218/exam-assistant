import {
  Button,
  Checkbox,
  Empty,
  Input,
  NavBar,
  ProgressBar,
  Radio,
  Space,
  SpinLoading,
  TextArea,
} from '@/components/ui';
import { Toast } from '@/components/feedback';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import * as api from '@/api/client';
import { useThrottledCallback } from '@/hooks/useThrottledCallback';
import type {
  PracticeMode,
  PracticeSubmitResult,
  Question,
  QuestionType,
} from '@/types';

const questionTypeLabels: Record<QuestionType, string> = {
  single_choice: '单选',
  multi_choice: '多选',
  fill_blank: '填空',
  true_false: '判断',
  short_answer: '主观题',
};

function optionKey(option: string) {
  return option.trim()[0] ?? '';
}

function parseAnswerArray(answer: string) {
  try {
    const parsed = JSON.parse(answer) as unknown;
    return Array.isArray(parsed)
      ? parsed.map((item) => String(item).toUpperCase())
      : [];
  } catch {
    return [];
  }
}

function formatAnswer(question: Question, answer: string) {
  if (!answer) {
    return '未作答';
  }
  if (question.type === 'multi_choice') {
    return parseAnswerArray(answer).join('、') || answer;
  }
  return answer;
}

function resultTone(isCorrect: boolean | null) {
  if (isCorrect === true) {
    return {
      button: 'border-[#b7e4c7] bg-[#e8f6ee] text-[#128a44]',
      panel: 'border-[#b7e4c7] bg-[#f5fcf7]',
      label: '回答正确',
      labelClass: 'text-[#128a44]',
    };
  }
  if (isCorrect === false) {
    return {
      button: 'border-[#f3c4c4] bg-[#fdeded] text-[#d13a3a]',
      panel: 'border-[#f3c4c4] bg-[#fff8f8]',
      label: '回答错误',
      labelClass: 'text-[#d13a3a]',
    };
  }
  return {
    button: 'border-[#e3e5e8] bg-[#f4f5f7] text-[#5a5f66]',
    panel: 'border-[#e3e5e8] bg-[#fafbfc]',
    label: '待判定',
    labelClass: 'text-[#5a5f66]',
  };
}

function PracticeResultView({
  result,
  onRestart,
}: {
  result: PracticeSubmitResult;
  onRestart: () => void;
}) {
  const firstWrongIndex = result.results.findIndex(
    (item) => item.attempt.isCorrect === false,
  );
  const [detailIndex, setDetailIndex] = useState(
    firstWrongIndex >= 0 ? firstWrongIndex : 0,
  );
  const detail = result.results[detailIndex];
  if (!detail) {
    return null;
  }
  const tone = resultTone(detail.attempt.isCorrect);

  return (
    <main className="min-h-screen bg-[#f5f6f8] pb-8">
      <NavBar onBack={() => window.history.back()}>练习结果</NavBar>

      <div className="mx-auto w-full max-w-[560px] px-4 pt-3">
        <section className="rounded-2xl bg-white p-4">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div>
              <div className="text-xl font-semibold text-[#128a44]">
                {result.correctCount}
              </div>
              <div className="mt-1 text-xs text-[#9aa0a8]">正确</div>
            </div>
            <div>
              <div className="text-xl font-semibold text-[#d13a3a]">
                {result.total - result.correctCount}
              </div>
              <div className="mt-1 text-xs text-[#9aa0a8]">错误</div>
            </div>
          </div>

          <div className="mt-5 text-xs text-[#9aa0a8]">点击题号查看答案解析</div>
          <div
            className="mt-2 grid gap-2"
            style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}
          >
            {result.results.map((item, index) => {
              const itemTone = resultTone(item.attempt.isCorrect);
              return (
                <button
                  key={item.question.id}
                  type="button"
                  onClick={() => setDetailIndex(index)}
                  className={`h-10 rounded-lg border text-sm font-medium transition ${itemTone.button} ${
                    detailIndex === index ? 'ring-2 ring-[#3d7eff]/40' : ''
                  }`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </section>

        <section className={`mt-4 rounded-2xl border p-4 ${tone.panel}`}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#9aa0a8]">
              第 {detailIndex + 1} 题 · {questionTypeLabels[detail.question.type]}
            </span>
            <span className={`text-sm font-medium ${tone.labelClass}`}>
              {tone.label}
            </span>
          </div>
          <h2 className="mt-3 whitespace-pre-wrap text-base font-semibold leading-7 text-[#26292e]">
            {detail.question.stem}
          </h2>
          <div className="mt-4 space-y-2 text-sm">
            <div className="text-[#5a5f66]">
              你的答案：
              <span className="ml-1 text-[#26292e]">
                {formatAnswer(detail.question, detail.attempt.answer)}
              </span>
            </div>
            <div className="text-[#5a5f66]">
              正确答案：
              <span className="ml-1 text-[#128a44]">
                {formatAnswer(detail.question, detail.question.answer)}
              </span>
            </div>
          </div>
          {detail.question.explanation && (
            <div className="mt-4 rounded-xl bg-white/70 p-3 text-sm leading-6 text-[#5a5f66]">
              {detail.question.explanation}
            </div>
          )}
        </section>

        <Button
          block
          color="primary"
          size="large"
          className="mt-4"
          onClick={onRestart}
        >
          重新练习
        </Button>
      </div>
    </main>
  );
}

export function PracticePage() {
  const navigate = useNavigate();
  const { examId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const categoryId = searchParams.get('categoryId') || undefined;
  const mode = (searchParams.get('mode') as PracticeMode) || 'all';
  const queryClient = useQueryClient();

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const questionsQuery = useQuery({
    queryKey: ['practice', examId, categoryId, mode],
    queryFn: () => api.listPracticeQuestions(examId, categoryId, mode),
    enabled: Boolean(examId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const submitPractice = useMutation({
    mutationFn: () =>
      api.submitPracticeAnswers(
        examId,
        (questionsQuery.data ?? []).map((question) => ({
          questionId: question.id,
          answer: answers[question.id] ?? '',
        })),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['exams'] });
      await queryClient.invalidateQueries({ queryKey: ['categories', examId] });
      await queryClient.invalidateQueries({ queryKey: ['wrong-book'] });
    },
    onError: (error) => {
      Toast.show({
        icon: 'fail',
        content: error instanceof Error ? error.message : '提交失败',
      });
    },
  });

  const submitAll = useThrottledCallback(() => {
    if (submitPractice.isPending) {
      return;
    }
    submitPractice.mutate();
  }, 800);

  useEffect(() => {
    setIndex(0);
    setAnswers({});
  }, [questionsQuery.data]);

  if (questionsQuery.isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f6f8]">
        <SpinLoading color="primary" />
      </main>
    );
  }

  if (questionsQuery.isError) {
    return (
      <main className="min-h-screen bg-[#f5f6f8]">
        <NavBar onBack={() => navigate(-1)}>练习</NavBar>
        <div className="px-5 py-12 text-center">
          <Empty description="练习题目加载失败" />
        </div>
      </main>
    );
  }

  const questions = questionsQuery.data ?? [];

  if (submitPractice.data) {
    return (
      <PracticeResultView
        result={submitPractice.data}
        onRestart={() => {
          setIndex(0);
          setAnswers({});
          submitPractice.reset();
        }}
      />
    );
  }

  if (questions.length === 0) {
    return (
      <main className="min-h-screen bg-[#f5f6f8]">
        <NavBar onBack={() => navigate(-1)}>练习</NavBar>
        <div className="px-5 py-12 text-center">
          <Empty description="当前范围还没有可练习的题目" />
          <Button
            block
            color="primary"
            size="large"
            onClick={() => navigate(-1)}
          >
            返回
          </Button>
        </div>
      </main>
    );
  }

  const question = questions[index]!;
  const answer = answers[question.id] ?? '';
  const progress = Math.round((index / questions.length) * 100);
  const isLast = index === questions.length - 1;

  function setCurrentAnswer(nextAnswer: string) {
    setAnswers((current) => ({
      ...current,
      [question.id]: nextAnswer,
    }));
  }

  function handleNext() {
    if (!answer.trim()) {
      Toast.show('请先作答');
      return;
    }

    if (isLast) {
      submitAll();
      return;
    }

    setIndex((current) => current + 1);
  }

  return (
    <main className="min-h-screen bg-[#f5f6f8] pb-8">
      <NavBar onBack={() => navigate(-1)}>练习</NavBar>

      <div className="mx-auto w-full max-w-[560px] px-4 pt-3">
        <div className="mb-2 flex items-center justify-between text-xs text-[#9aa0a8]">
          <span>
            {index + 1} / {questions.length}
          </span>
          <span>{questionTypeLabels[question.type]}</span>
        </div>
        <ProgressBar percent={progress} />

        <div className="mt-5 rounded-2xl bg-white p-4">
          <h2 className="text-base font-semibold leading-7 text-[#26292e]">
            {question.stem}
          </h2>

          {question.type === 'single_choice' && (
            <Radio.Group
              value={answer}
              onChange={(value) => setCurrentAnswer(String(value))}
            >
              <Space direction="vertical" block>
                {question.options.map((option) => (
                  <Radio key={option} value={optionKey(option)}>
                    {option}
                  </Radio>
                ))}
              </Space>
            </Radio.Group>
          )}

          {question.type === 'true_false' && (
            <Radio.Group
              value={answer}
              onChange={(value) => setCurrentAnswer(String(value))}
            >
              <Space direction="vertical" block>
                {(question.options.length > 0
                  ? question.options
                  : ['正确', '错误']
                ).map((option) => (
                  <Radio key={option} value={option}>
                    {option}
                  </Radio>
                ))}
              </Space>
            </Radio.Group>
          )}

          {question.type === 'multi_choice' && (
            <Checkbox.Group
              value={parseAnswerArray(answer)}
              onChange={(value) => setCurrentAnswer(JSON.stringify(value))}
            >
              <Space direction="vertical" block>
                {question.options.map((option) => (
                  <Checkbox key={option} value={optionKey(option)}>
                    {option}
                  </Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
          )}

          {question.type === 'fill_blank' && (
            <Input
              value={answer}
              onChange={setCurrentAnswer}
              placeholder="输入答案"
              clearable
            />
          )}

          {question.type === 'short_answer' && (
            <TextArea
              value={answer}
              onChange={setCurrentAnswer}
              placeholder="输入你的答案"
              rows={5}
            />
          )}
        </div>

        <div className="mt-4">
          <Button
            block
            color="primary"
            size="large"
            loading={submitPractice.isPending}
            onClick={handleNext}
          >
            {isLast ? '提交全部答案' : '下一题'}
          </Button>
        </div>

        <p className="mt-2 text-center text-xs text-[#9aa0a8]">
          {isLast
            ? '提交后统一判分并展示本次练习结果'
            : '答题过程中不会请求接口，可连续完成全部题目'}
        </p>

        {question.type === 'multi_choice' && (
          <div className="mt-2 text-center text-xs text-[#9aa0a8]">
            多选题可勾选多个选项
          </div>
        )}
      </div>
    </main>
  );
}
