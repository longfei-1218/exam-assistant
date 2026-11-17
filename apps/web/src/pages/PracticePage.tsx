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
import type { Attempt, PracticeMode, QuestionType } from '@/types';

const questionTypeLabels: Record<QuestionType, string> = {
  single_choice: '单选',
  multi_choice: '多选',
  fill_blank: '填空',
  short_answer: '简答',
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

export function PracticePage() {
  const navigate = useNavigate();
  const { examId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const categoryId = searchParams.get('categoryId') || undefined;
  const mode = (searchParams.get('mode') as PracticeMode) || 'all';
  const queryClient = useQueryClient();

  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<Attempt | null>(null);

  const questionsQuery = useQuery({
    queryKey: ['practice', examId, categoryId, mode],
    queryFn: () => api.listPracticeQuestions(examId, categoryId, mode),
    enabled: Boolean(examId),
  });

  const submitAttempt = useMutation({
    mutationFn: (nextAnswer: string) =>
      api.submitAttempt(questionsQuery.data![index]!.id, nextAnswer),
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

  useEffect(() => {
    setIndex(0);
    setAnswer('');
    setFeedback(null);
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
  const progress = Math.round((index / questions.length) * 100);
  const isLast = index === questions.length - 1;

  function handleSubmit() {
    if (!answer.trim()) {
      Toast.show('请先作答');
      return;
    }

    submitAttempt.mutate(answer, {
      onSuccess: (attempt) => {
        setFeedback(attempt);
      },
    });
  }

  function handleNext() {
    if (isLast) {
      setIndex(0);
      setAnswer('');
      setFeedback(null);
      Toast.show({
        icon: 'success',
        content: '本轮练习已完成',
      });
      return;
    }

    setIndex((current) => current + 1);
    setAnswer('');
    setFeedback(null);
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
              onChange={(value) => setAnswer(String(value))}
              disabled={Boolean(feedback)}
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

          {question.type === 'multi_choice' && (
            <Checkbox.Group
              value={parseAnswerArray(answer)}
              onChange={(value) => setAnswer(JSON.stringify(value))}
              disabled={Boolean(feedback)}
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
              onChange={setAnswer}
              placeholder="输入答案"
              clearable
              disabled={Boolean(feedback)}
            />
          )}

          {question.type === 'short_answer' && (
            <TextArea
              value={answer}
              onChange={setAnswer}
              placeholder="输入你的答案"
              rows={5}
              disabled={Boolean(feedback)}
            />
          )}

          {feedback && (
            <div
              className={`mt-4 rounded-xl px-3 py-3 text-sm ${
                feedback.isCorrect === true
                  ? 'bg-[#e8f6ee] text-[#128a44]'
                  : feedback.isCorrect === false
                    ? 'bg-[#fdeded] text-[#d13a3a]'
                    : 'bg-[#f4f5f7] text-[#5a5f66]'
              }`}
            >
              {feedback.isCorrect === true
                ? '回答正确'
                : feedback.isCorrect === false
                  ? '回答错误'
                  : '已保存，简答判分将在后续步骤开放'}
              {question.explanation && (
                <div className="mt-1 text-xs opacity-80">
                  {question.explanation}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4">
          {!feedback ? (
            <Button
              block
              color="primary"
              size="large"
              loading={submitAttempt.isPending}
              onClick={handleSubmit}
            >
              提交
            </Button>
          ) : (
            <Button block color="primary" size="large" onClick={handleNext}>
              {isLast ? '完成本轮' : '下一题'}
            </Button>
          )}
        </div>

        {question.type === 'multi_choice' && (
          <div className="mt-2 text-center text-xs text-[#9aa0a8]">
            多选题可勾选多个选项
          </div>
        )}
      </div>
    </main>
  );
}
