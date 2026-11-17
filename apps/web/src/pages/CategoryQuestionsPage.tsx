import {
  Button,
  Dialog,
  Empty,
  Input,
  List,
  NavBar,
  Picker,
  Popup,
  SpinLoading,
  Tag,
  TextArea,
  Toast,
} from 'antd-mobile';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import * as api from '@/api/client';
import type { Question, QuestionInput, QuestionType } from '@/types';

const questionTypeOptions: Array<{ label: string; value: QuestionType }> = [
  { label: '单选', value: 'single_choice' },
  { label: '多选', value: 'multi_choice' },
  { label: '填空', value: 'fill_blank' },
  { label: '简答', value: 'short_answer' },
];

const questionTypeLabels: Record<QuestionType, string> = {
  single_choice: '单选',
  multi_choice: '多选',
  fill_blank: '填空',
  short_answer: '简答',
};

function isChoiceType(type: QuestionType) {
  return type === 'single_choice' || type === 'multi_choice';
}

type QuestionFormPopupProps = {
  visible: boolean;
  examId: string;
  categoryId: string;
  question: Question | null;
  onClose: () => void;
};

function QuestionFormPopup({
  visible,
  examId,
  categoryId,
  question,
  onClose,
}: QuestionFormPopupProps) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<QuestionType>('single_choice');
  const [stem, setStem] = useState('');
  const [optionsText, setOptionsText] = useState('');
  const [answer, setAnswer] = useState('');
  const [explanation, setExplanation] = useState('');

  const saveQuestion = useMutation({
    mutationFn: (input: QuestionInput) =>
      question ? api.updateQuestion(question.id, input) : api.createQuestion(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['questions', examId, categoryId],
      });
      await queryClient.invalidateQueries({ queryKey: ['exams'] });
      await queryClient.invalidateQueries({ queryKey: ['categories', examId] });
      Toast.show({
        icon: 'success',
        content: question ? '题目已更新' : '题目已创建',
      });
      onClose();
    },
    onError: (error) => {
      Toast.show({
        icon: 'fail',
        content: error instanceof Error ? error.message : '保存失败',
      });
    },
  });

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (question) {
      setType(question.type);
      setStem(question.stem);
      setOptionsText(question.options.join('\n'));
      setAnswer(question.answer);
      setExplanation(question.explanation);
    } else {
      setType('single_choice');
      setStem('');
      setOptionsText('');
      setAnswer('');
      setExplanation('');
    }
  }, [question, visible]);

  function handleSave() {
    const options = isChoiceType(type)
      ? optionsText
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

    saveQuestion.mutate({
      examId,
      categoryId,
      type,
      stem,
      options,
      answer,
      explanation,
    });
  }

  return (
    <Popup
      visible={visible}
      onMaskClick={onClose}
      position="bottom"
      bodyStyle={{ borderRadius: '16px 16px 0 0', paddingTop: '18px' }}
    >
      <div className="px-4 pb-4">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#26292e]">
            {question ? '编辑题目' : '新增题目'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="bg-transparent text-xl text-[#9aa0a8]"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-2 text-xs text-[#9aa0a8]">题型</div>
            <Picker
              columns={[questionTypeOptions]}
              value={[type]}
              onConfirm={(value) => setType(value[0] as QuestionType)}
            >
              {(_, { open }) => (
                <button
                  type="button"
                  onClick={open}
                  className="flex h-11 w-full items-center justify-between rounded-xl border border-line bg-surface px-3 text-sm text-ink"
                >
                  <span>{questionTypeLabels[type]}</span>
                  <span className="text-muted">选择</span>
                </button>
              )}
            </Picker>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-[#9aa0a8]">题干</span>
            <TextArea
              value={stem}
              onChange={setStem}
              placeholder="输入题干"
              rows={4}
              showCount
              maxLength={500}
            />
          </label>

          {isChoiceType(type) && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[#9aa0a8]">
                选项（每行一个，建议使用 A. 开头）
              </span>
              <TextArea
                value={optionsText}
                onChange={setOptionsText}
                placeholder={'A. 选项内容\nB. 选项内容'}
                rows={4}
              />
            </label>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-[#9aa0a8]">
              {type === 'single_choice'
                ? '答案（选项字母，如 A）'
                : type === 'multi_choice'
                  ? '答案（字母数组，如 ["A","C"]）'
                  : '参考答案'}
            </span>
            {type === 'fill_blank' || type === 'short_answer' ? (
              <TextArea
                value={answer}
                onChange={setAnswer}
                placeholder="输入参考答案"
                rows={3}
              />
            ) : (
              <Input
                value={answer}
                onChange={setAnswer}
                placeholder={
                  type === 'single_choice' ? 'A' : '["A","C"]'
                }
                clearable
              />
            )}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-[#9aa0a8]">解析（选填）</span>
            <TextArea
              value={explanation}
              onChange={setExplanation}
              placeholder="填写解析"
              rows={3}
              showCount
              maxLength={500}
            />
          </label>

          <Button
            block
            color="primary"
            size="large"
            loading={saveQuestion.isPending}
            onClick={handleSave}
          >
            {question ? '保存修改' : '保存题目'}
          </Button>
        </div>
      </div>
    </Popup>
  );
}

export function CategoryQuestionsPage() {
  const navigate = useNavigate();
  const { examId = '', categoryId = '' } = useParams();
  const queryClient = useQueryClient();
  const [formVisible, setFormVisible] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ['categories', examId],
    queryFn: () => api.listCategories(examId),
    enabled: Boolean(examId),
  });

  const questionsQuery = useQuery({
    queryKey: ['questions', examId, categoryId],
    queryFn: () => api.listQuestions(examId, categoryId),
    enabled: Boolean(examId && categoryId),
  });

  const deleteQuestion = useMutation({
    mutationFn: api.deleteQuestion,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['questions', examId, categoryId],
      });
      await queryClient.invalidateQueries({ queryKey: ['exams'] });
      await queryClient.invalidateQueries({ queryKey: ['categories', examId] });
      Toast.show({
        icon: 'success',
        content: '题目已删除',
      });
    },
    onError: (error) => {
      Toast.show({
        icon: 'fail',
        content: error instanceof Error ? error.message : '删除失败',
      });
    },
  });

  const category = categoriesQuery.data?.find((item) => item.id === categoryId);

  function openCreate() {
    setEditingQuestion(null);
    setFormVisible(true);
  }

  function openEdit(question: Question) {
    setEditingQuestion(question);
    setFormVisible(true);
  }

  function closeForm() {
    setFormVisible(false);
    setEditingQuestion(null);
  }

  function handleDelete(question: Question) {
    Dialog.confirm({
      content: '确定删除这道题吗？',
      confirmText: '删除',
      cancelText: '取消',
      onConfirm: () => deleteQuestion.mutate(question.id),
    });
  }

  return (
    <main className="min-h-screen bg-[#f5f6f8] pb-8">
      <NavBar onBack={() => navigate(`/exams/${examId}`)}>
        {category?.name ?? '题单'}
      </NavBar>

      <div className="mx-auto w-full max-w-[560px] px-4 pt-3">
        <Button
          block
          color="primary"
          size="large"
          onClick={openCreate}
        >
          ＋ 新增题目
        </Button>

        <div className="mt-4">
          {questionsQuery.isLoading && (
            <div className="grid min-h-[280px] place-items-center">
              <SpinLoading color="primary" />
            </div>
          )}

          {questionsQuery.isError && (
            <Empty description="题目加载失败" />
          )}

          {questionsQuery.isSuccess &&
            questionsQuery.data.length === 0 && (
              <div className="rounded-2xl bg-white px-5 py-10 text-center">
                <Empty description="还没有题目，先录一道试试" />
              </div>
            )}

          {questionsQuery.isSuccess &&
            questionsQuery.data.length > 0 && (
              <List className="!rounded-2xl">
                {questionsQuery.data.map((question) => (
                  <List.Item
                    key={question.id}
                    description={
                      <div className="mt-1">
                        <Tag color="primary" fill="outline">
                          {questionTypeLabels[question.type]}
                        </Tag>
                      </div>
                    }
                    extra={
                      <div className="flex gap-1">
                        <Button
                          size="mini"
                          fill="none"
                          color="primary"
                          onClick={() => openEdit(question)}
                        >
                          编辑
                        </Button>
                        <Button
                          size="mini"
                          fill="none"
                          color="danger"
                          onClick={() => handleDelete(question)}
                        >
                          删除
                        </Button>
                      </div>
                    }
                  >
                    <span className="line-clamp-2 text-sm text-[#26292e]">
                      {question.stem}
                    </span>
                  </List.Item>
                ))}
              </List>
            )}
        </div>
      </div>

      <QuestionFormPopup
        visible={formVisible}
        examId={examId}
        categoryId={categoryId}
        question={editingQuestion}
        onClose={closeForm}
      />
    </main>
  );
}
