import {
  Button,
  Empty,
  NavBar,
  Picker,
  SpinLoading,
  TextArea,
} from '@/components/ui';
import { Toast } from '@/components/feedback';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import * as api from '@/api/client';

export function ImportPage() {
  const navigate = useNavigate();
  const { examId = '' } = useParams();
  const [rawText, setRawText] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);

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

  function handleStartImport() {
    if (!rawText.trim()) {
      Toast.show({
        icon: 'fail',
        content: '请先粘贴需要解析的文本',
      });
      return;
    }

    Toast.show({
      content: 'AI 导入将在第 11-13 步实现',
    });
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
            <div className="mb-2 text-xs text-[#9aa0a8]">目标类目</div>
            <Picker
              columns={[categoryOptions]}
              value={categoryId ? [categoryId] : []}
              onConfirm={(value) => {
                const selected = value[0];
                setCategoryId(
                  typeof selected === 'string' || typeof selected === 'number'
                    ? String(selected)
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
                      '不指定，由 AI 推荐'}
                  </span>
                  <span className="text-muted">选择</span>
                </button>
              )}
            </Picker>
          </div>

          <TextArea
            value={rawText}
            onChange={setRawText}
            placeholder="粘贴教材重点、真题、笔记或公众号文章"
            rows={10}
            showCount
            maxLength={10000}
          />

          <Button
            block
            color="primary"
            size="large"
            className="mt-4"
            onClick={handleStartImport}
          >
            开始 AI 解析
          </Button>

          <p className="mt-3 text-center text-xs text-[#9aa0a8]">
            当前仅完成导入入口，AI 解析和校对将在后续步骤接入。
          </p>
        </div>
      </div>
    </main>
  );
}
