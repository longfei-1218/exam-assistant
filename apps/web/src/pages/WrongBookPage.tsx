import {
  Button,
  Empty,
  List,
  NavBar,
  Selector,
  SpinLoading,
  Tag,
} from '@/components/ui';
import { Toast } from '@/components/feedback';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import * as api from '@/api/client';
import type { WrongBookItem } from '@/types';

const questionTypeLabels = {
  single_choice: '单选',
  multi_choice: '多选',
  fill_blank: '填空',
  true_false: '判断',
  short_answer: '主观题',
} as const;

export function WrongBookPage() {
  const navigate = useNavigate();
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const wrongBookQuery = useQuery({
    queryKey: ['wrong-book'],
    queryFn: api.listWrongBook,
  });

  const categoryOptions = useMemo(() => {
    const categories = new Map(
      wrongBookQuery.data?.map((item) => [
        item.question.categoryId,
        item.categoryName,
      ]),
    );

    return Array.from(categories.entries()).map(([value, label]) => ({
      value,
      label,
    }));
  }, [wrongBookQuery.data]);

  if (wrongBookQuery.isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f6f8]">
        <SpinLoading color="primary" />
      </main>
    );
  }

  if (wrongBookQuery.isError) {
    return (
      <main className="min-h-screen bg-[#f5f6f8]">
        <NavBar onBack={() => navigate(-1)}>错题本</NavBar>
        <div className="px-5 py-12 text-center">
          <Empty description="错题本加载失败" />
        </div>
      </main>
    );
  }

  const items = wrongBookQuery.data ?? [];
  const pendingItems = items.filter((item) => !item.corrected);
  const visibleItems = categoryId
    ? items.filter((item) => item.question.categoryId === categoryId)
    : items;
  const firstPendingExamId = pendingItems[0]?.question.examId;

  function renderItem(item: WrongBookItem) {
    return (
      <List.Item
        key={item.question.id}
        description={
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Tag color="primary" fill="outline">
              {questionTypeLabels[item.question.type]}
            </Tag>
            <Tag color="default" fill="outline">
              {item.categoryName}
            </Tag>
            <Tag color={item.corrected ? 'success' : 'danger'} fill="outline">
              {item.corrected ? '已订正' : `错 ${item.wrongCount} 次`}
            </Tag>
          </div>
        }
      >
        <span className="line-clamp-2 text-sm text-[#26292e]">
          {item.question.stem}
        </span>
      </List.Item>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f6f8] pb-8">
      <NavBar onBack={() => navigate(-1)}>错题本</NavBar>

      <div className="mx-auto w-full max-w-[560px] px-4 pt-3">
        {items.length === 0 ? (
          <div className="rounded-2xl bg-white px-5 py-12 text-center">
            <Empty description="还没有错题" />
          </div>
        ) : (
          <>
            {categoryOptions.length > 0 && (
              <div className="mb-3">
                <div className="mb-2 text-xs text-[#9aa0a8]">按类目筛选</div>
                <Selector
                  options={categoryOptions}
                  value={categoryId ? [categoryId] : []}
                  onChange={(value) => setCategoryId(value[0] ?? null)}
                />
              </div>
            )}

            <Button
              block
              color="primary"
              size="middle"
              disabled={!firstPendingExamId}
              onClick={() => {
                if (firstPendingExamId) {
                  navigate(`/practice/${firstPendingExamId}?mode=wrong`);
                } else {
                  Toast.show('暂无待订正错题');
                }
              }}
            >
              只刷错题（{pendingItems.length}）
            </Button>

            <div className="mt-4 flex flex-col gap-3">
              {visibleItems.filter((item) => !item.corrected).length > 0 && (
                <List header="待订正" className="!rounded-2xl">
                  {visibleItems
                    .filter((item) => !item.corrected)
                    .map(renderItem)}
                </List>
              )}

              {visibleItems.filter((item) => item.corrected).length > 0 && (
                <List header="已订正" className="!rounded-2xl">
                  {visibleItems
                    .filter((item) => item.corrected)
                    .map(renderItem)}
                </List>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
