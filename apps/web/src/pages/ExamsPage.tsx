import {
  Button,
  Card,
  DatePicker,
  Dialog,
  Empty,
  Form,
  Input,
  NavBar,
  Popup,
  ProgressBar,
  SpinLoading,
  Tag,
  TextArea,
  Toast,
} from 'antd-mobile';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import * as api from '@/api/client';
import { useAuth } from '@/auth/useAuth';
import type { Exam, ExamInput } from '@/types';

type ExamFormValues = {
  name?: string;
  description?: string;
  examDate?: string | Date | null;
};

type ExamFormPopupProps = {
  visible: boolean;
  exam: Exam | null;
  onClose: () => void;
};

function ExamFormPopup({ visible, exam, onClose }: ExamFormPopupProps) {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  const saveExam = useMutation({
    mutationFn: (input: ExamInput) =>
      exam ? api.updateExam(exam.id, input) : api.createExam(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['exams'] });
      Toast.show({
        icon: 'success',
        content: exam ? '考试已更新' : '考试已创建',
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

    if (exam) {
      form.setFieldsValue({
        name: exam.name,
        description: exam.description,
        examDate: exam.examDate ? new Date(exam.examDate) : undefined,
      });
    } else {
      form.resetFields();
    }
  }, [exam, form, visible]);

  function handleFinish(values: ExamFormValues) {
    const examDate =
      values.examDate instanceof Date
        ? values.examDate.toISOString().slice(0, 10)
        : values.examDate || null;

    saveExam.mutate({
      name: values.name ?? '',
      description: values.description ?? '',
      examDate,
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
            {exam ? '编辑考试' : '新建考试'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="bg-transparent text-xl text-[#9aa0a8]"
          >
            ×
          </button>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          footer={
            <Button
              block
              type="submit"
              color="primary"
              size="large"
              loading={saveExam.isPending}
            >
              {exam ? '保存修改' : '创建考试'}
            </Button>
          }
        >
          <Form.Item
            name="name"
            label="考试名称"
            rules={[{ required: true, message: '请输入考试名称' }]}
          >
            <Input placeholder="例如：2026 下半年教资笔试" clearable />
          </Form.Item>

          <Form.Item name="examDate" label="考试日期">
            <DatePicker precision="day" title="考试日期" />
          </Form.Item>

          <Form.Item name="description" label="描述（选填）">
            <TextArea
              placeholder="这个考试的目标、范围或提醒"
              rows={3}
              showCount
              maxLength={200}
            />
          </Form.Item>
        </Form>
      </div>
    </Popup>
  );
}

export function ExamsPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const [formVisible, setFormVisible] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);

  const examsQuery = useQuery({
    queryKey: ['exams'],
    queryFn: api.listExams,
  });

  const deleteExam = useMutation({
    mutationFn: api.deleteExam,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['exams'] });
      Toast.show({
        icon: 'success',
        content: '考试已删除',
      });
    },
    onError: (error) => {
      Toast.show({
        icon: 'fail',
        content: error instanceof Error ? error.message : '删除失败',
      });
    },
  });

  function openCreateModal() {
    setEditingExam(null);
    setFormVisible(true);
  }

  function openEditModal(exam: Exam) {
    setEditingExam(exam);
    setFormVisible(true);
  }

  function closeModal() {
    setFormVisible(false);
    setEditingExam(null);
  }

  function handleDelete(exam: Exam) {
    Dialog.confirm({
      content: `确定删除「${exam.name}」吗？该操作不可撤销。`,
      confirmText: '删除',
      cancelText: '取消',
      onConfirm: () => deleteExam.mutate(exam.id),
    });
  }

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <main className="min-h-screen bg-[#f5f6f8] pb-8">
      <NavBar
        back={null}
        right={
          <Button
            color="primary"
            fill="solid"
            size="small"
            onClick={openCreateModal}
          >
            ＋ 新建
          </Button>
        }
      >
        备考助手
      </NavBar>

      <div className="mx-auto w-full max-w-[560px] px-4 pt-3">
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="text-sm text-[#9aa0a8]">考试列表</span>
          <button
            type="button"
            onClick={handleLogout}
            className="bg-transparent text-sm text-[#3d7eff]"
          >
            退出登录
          </button>
        </div>

        {examsQuery.isLoading && (
          <div className="grid min-h-[360px] place-items-center">
            <SpinLoading color="primary" />
          </div>
        )}

        {examsQuery.isError && (
          <Empty
            description={
              examsQuery.error instanceof Error
                ? examsQuery.error.message
                : '考试列表加载失败'
            }
          />
        )}

        {examsQuery.isSuccess && examsQuery.data.length === 0 && (
          <div className="rounded-2xl bg-white px-5 py-12 text-center">
            <Empty description="还没有考试，创建第一个开始备考" />
            <Button
              block
              color="primary"
              size="large"
              onClick={openCreateModal}
            >
              新建考试
            </Button>
          </div>
        )}

        {examsQuery.isSuccess && examsQuery.data.length > 0 && (
          <div className="flex flex-col gap-3">
            {examsQuery.data.map((exam) => {
              const passRate =
                exam.questionCount > 0
                  ? Math.round((exam.passedCount / exam.questionCount) * 100)
                  : 0;

              return (
                <Card
                  key={exam.id}
                  onClick={() => navigate(`/exams/${exam.id}`)}
                  bodyClassName="!p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-semibold text-[#26292e]">
                        {exam.name}
                      </h2>
                      <p className="mt-1 truncate text-xs text-[#9aa0a8]">
                        {exam.description || '暂无描述'}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="mini"
                        fill="none"
                        color="primary"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditModal(exam);
                        }}
                      >
                        编辑
                      </Button>
                      <Button
                        size="mini"
                        fill="none"
                        color="danger"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDelete(exam);
                        }}
                      >
                        删除
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Tag color="primary" fill="outline">
                      {exam.categoryCount} 个类目
                    </Tag>
                    <Tag color="primary" fill="outline">
                      {exam.questionCount} 题
                    </Tag>
                    <Tag color="default" fill="outline">
                      最近练习 {exam.lastPracticedAt ?? '暂无'}
                    </Tag>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-xs text-[#9aa0a8]">
                      <span>
                        已过关 {exam.passedCount} / {exam.questionCount}
                      </span>
                      <span className="font-medium text-[#26292e]">
                        {passRate}%
                      </span>
                    </div>
                    <ProgressBar percent={passRate} />
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button
                      block
                      color="primary"
                      fill="solid"
                      size="middle"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/practice/${exam.id}`);
                      }}
                    >
                      继续练习
                    </Button>
                    <Button
                      block
                      color="primary"
                      fill="outline"
                      size="middle"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/import/${exam.id}`);
                      }}
                    >
                      导入
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <ExamFormPopup
        visible={formVisible}
        exam={editingExam}
        onClose={closeModal}
      />
    </main>
  );
}
