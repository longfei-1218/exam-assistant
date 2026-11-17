import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import * as api from '@/api/client';
import { Empty, List, NavBar, SpinLoading, Tag } from '@/components/ui';
import { PracticeResultView } from './PracticePage';

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PracticeRecordsPage() {
  const navigate = useNavigate();
  const { examId = '' } = useParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const recordsQuery = useQuery({
    queryKey: ['practice-records', examId],
    queryFn: () => api.listPracticeSessions(examId),
    enabled: Boolean(examId),
  });

  const detailQuery = useQuery({
    queryKey: ['practice-record', selectedId],
    queryFn: () => api.getPracticeSession(selectedId ?? ''),
    enabled: Boolean(selectedId),
  });

  if (selectedId) {
    if (detailQuery.isLoading) {
      return (
        <main className="grid min-h-screen place-items-center bg-[#f5f6f8]">
          <SpinLoading color="primary" />
        </main>
      );
    }

    if (detailQuery.data) {
      return (
        <PracticeResultView
          result={detailQuery.data}
          onBack={() => setSelectedId(null)}
          backLabel="返回练习记录"
        />
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f6f8] pb-8">
      <NavBar onBack={() => navigate(`/exams/${examId}`)}>
        练习记录
      </NavBar>
      <div className="mx-auto w-full max-w-[560px] px-4 pt-3">
        {recordsQuery.isLoading && (
          <div className="grid min-h-[300px] place-items-center">
            <SpinLoading color="primary" />
          </div>
        )}

        {recordsQuery.isError && <Empty description="练习记录加载失败" />}

        {recordsQuery.isSuccess && recordsQuery.data.length === 0 && (
          <div className="rounded-2xl bg-white px-5 py-12">
            <Empty description="还没有练习记录" />
          </div>
        )}

        {recordsQuery.isSuccess && recordsQuery.data.length > 0 && (
          <List>
            {recordsQuery.data.map((record) => (
              <List.Item
                key={record.id}
                onClick={() => setSelectedId(record.id)}
                extra={<span className="text-lg text-[#9aa0a8]">›</span>}
                description={
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Tag color="success" fill="outline">
                      正确 {record.correctCount}
                    </Tag>
                    <Tag color="danger" fill="outline">
                      错误 {record.wrongCount}
                    </Tag>
                    <Tag color="default" fill="outline">
                      共 {record.total} 题
                    </Tag>
                  </div>
                }
              >
                <div>
                  <div className="text-sm font-medium text-[#26292e]">
                    {formatTime(record.createdAt)}
                  </div>
                  <div className="mt-1 text-xs text-[#9aa0a8]">
                    练习模式：{record.mode}
                  </div>
                </div>
              </List.Item>
            ))}
          </List>
        )}
      </div>
    </main>
  );
}
