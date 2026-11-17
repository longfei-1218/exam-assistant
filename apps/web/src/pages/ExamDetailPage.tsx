import {
  Button,
  Card,
  Dialog,
  Empty,
  Form,
  Grid,
  Input,
  List,
  NavBar,
  Popup,
  ProgressBar,
  SpinLoading,
  Tag,
  Toast,
} from 'antd-mobile';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import * as api from '@/api/client';
import type { Category, CategoryInput } from '@/types';

function rateLabel(rate: number | null) {
  return rate === null ? '未练习' : `${rate.toFixed(1)}%`;
}

function rateColor(rate: number | null) {
  if (rate === null) {
    return 'default';
  }
  if (rate < 15) {
    return 'success';
  }
  if (rate <= 25) {
    return 'warning';
  }
  return 'danger';
}

type CategoryFormValues = {
  name?: string;
};

type CategoryFormPopupProps = {
  visible: boolean;
  examId: string;
  category: Category | null;
  parentCategory: Category | null;
  onClose: () => void;
};

function CategoryFormPopup({
  visible,
  examId,
  category,
  parentCategory,
  onClose,
}: CategoryFormPopupProps) {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  const saveCategory = useMutation({
    mutationFn: (name: string) =>
      category
        ? api.updateCategory(category.id, { name })
        : api.createCategory({
            examId,
            parentId: parentCategory?.id ?? null,
            name,
          } satisfies CategoryInput),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['categories', examId],
      });
      await queryClient.invalidateQueries({ queryKey: ['exams'] });
      Toast.show({
        icon: 'success',
        content: category ? '类目已更新' : '类目已创建',
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

    if (category) {
      form.setFieldsValue({ name: category.name });
    } else {
      form.resetFields();
    }
  }, [category, form, visible]);

  function handleFinish(values: CategoryFormValues) {
    saveCategory.mutate(values.name ?? '');
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
            {category
              ? '编辑类目'
              : parentCategory
                ? `新增子类目 · ${parentCategory.name}`
                : '新增类目'}
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
              loading={saveCategory.isPending}
            >
              {category ? '保存修改' : '新增类目'}
            </Button>
          }
        >
          <Form.Item
            name="name"
            label="类目名称"
            rules={[{ required: true, message: '请输入类目名称' }]}
          >
            <Input placeholder="例如：教育心理学" clearable />
          </Form.Item>
        </Form>
      </div>
    </Popup>
  );
}

export function ExamDetailPage() {
  const navigate = useNavigate();
  const { examId = '' } = useParams();
  const queryClient = useQueryClient();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [parentCategory, setParentCategory] = useState<Category | null>(null);

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

  const wrongBookQuery = useQuery({
    queryKey: ['wrong-book'],
    queryFn: api.listWrongBook,
  });

  const deleteCategory = useMutation({
    mutationFn: api.deleteCategory,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['categories', examId],
      });
      await queryClient.invalidateQueries({ queryKey: ['exams'] });
      Toast.show({
        icon: 'success',
        content: '类目已删除',
      });
    },
    onError: (error) => {
      Toast.show({
        icon: 'fail',
        content: error instanceof Error ? error.message : '删除失败',
      });
    },
  });

  function openCreateCategory(parent: Category | null = null) {
    setEditingCategory(null);
    setParentCategory(parent);
    setModalVisible(true);
  }

  function openEditCategory(category: Category) {
    setEditingCategory(category);
    setParentCategory(null);
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
    setEditingCategory(null);
    setParentCategory(null);
  }

  function handleDelete(category: Category) {
    const suffix = category.parentId === null ? '及其子类目' : '';
    Dialog.confirm({
      content: `确定删除「${category.name}」${suffix}吗？`,
      confirmText: '删除',
      cancelText: '取消',
      onConfirm: () => deleteCategory.mutate(category.id),
    });
  }

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
        <NavBar onBack={() => navigate('/')}>考试详情</NavBar>
        <div className="px-5 py-12 text-center">
          <Empty description="考试不存在或已删除" />
          <Button
            block
            color="primary"
            size="large"
            onClick={() => navigate('/')}
          >
            返回考试列表
          </Button>
        </div>
      </main>
    );
  }

  const exam = examQuery.data;
  const categories = categoriesQuery.data ?? [];
  const topLevelCategories = categories.filter(
    (category) => category.parentId === null,
  );
  const totalQuestions = categories.reduce(
    (sum, category) => sum + category.stats.total,
    0,
  );
  const passedQuestions = categories.reduce(
    (sum, category) => sum + category.stats.passed,
    0,
  );
  const answerCount = categories.reduce(
    (sum, category) => sum + category.stats.answerCount,
    0,
  );
  const errorCount = categories.reduce(
    (sum, category) => sum + category.stats.errorCount,
    0,
  );
  const errorRate = answerCount > 0 ? errorCount / answerCount : null;
  const pendingWrongCount =
    wrongBookQuery.data?.filter((item) => !item.corrected).length ?? 0;

  return (
    <main className="min-h-screen bg-[#f5f6f8] pb-8">
      <NavBar onBack={() => navigate('/')}>{exam.name}</NavBar>

      <div className="mx-auto w-full max-w-[560px] px-4 pt-3">
        <Grid columns={3} gap={8} className="mb-3">
          <Grid.Item>
            <div className="rounded-xl bg-white p-3 text-center">
              <div className="text-xs text-[#9aa0a8]">总题数</div>
              <div className="mt-1 text-xl font-semibold text-[#26292e]">
                {totalQuestions}
              </div>
            </div>
          </Grid.Item>
          <Grid.Item>
            <div className="rounded-xl bg-white p-3 text-center">
              <div className="text-xs text-[#9aa0a8]">已过关</div>
              <div className="mt-1 text-xl font-semibold text-[#16a34a]">
                {passedQuestions}
              </div>
            </div>
          </Grid.Item>
          <Grid.Item>
            <div className="rounded-xl bg-white p-3 text-center">
              <div className="text-xs text-[#9aa0a8]">错误率</div>
              <div className="mt-1 text-xl font-semibold text-[#c77714]">
                {rateLabel(errorRate)}
              </div>
            </div>
          </Grid.Item>
        </Grid>

        <List className="mb-4 !rounded-2xl">
          <List.Item
            extra={<span className="text-lg text-[#9aa0a8]">›</span>}
            onClick={() => navigate('/wrong-book')}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">错题本</span>
              <Tag color="danger" fill="outline">
                待订正 {pendingWrongCount}
              </Tag>
            </div>
          </List.Item>
        </List>

        {categoriesQuery.isLoading && (
          <div className="grid min-h-[240px] place-items-center">
            <SpinLoading color="primary" />
          </div>
        )}

        {categoriesQuery.isError && (
          <Empty description="类目加载失败" />
        )}

        {topLevelCategories.length === 0 && !categoriesQuery.isLoading && (
          <div className="rounded-2xl bg-white px-5 py-10 text-center">
            <Empty description="还没有类目，先添加一个开始整理题目" />
          </div>
        )}

        <div className="flex flex-col gap-3">
          {topLevelCategories.map((category) => {
            const children = categories.filter(
              (item) => item.parentId === category.id,
            );
            const progress =
              category.stats.total > 0
                ? Math.round(
                    (category.stats.passed / category.stats.total) * 100,
                  )
                : 0;

            return (
              <Card
                key={category.id}
                onClick={() =>
                  navigate(`/exams/${examId}/categories/${category.id}`)
                }
                title={
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">
                      {category.name}
                    </span>
                    <Tag color="primary" fill="outline">
                      {category.stats.total} 题
                    </Tag>
                  </div>
                }
                extra={
                  <div className="flex gap-1">
                    <Button
                      size="mini"
                      fill="none"
                      color="primary"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditCategory(category);
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
                        handleDelete(category);
                      }}
                    >
                      删除
                    </Button>
                  </div>
                }
                bodyClassName="!p-3"
              >
                <div className="flex flex-wrap gap-1.5">
                  <Tag color="success" fill="outline">
                    已过关 {category.stats.passed}
                  </Tag>
                  <Tag color={rateColor(category.stats.errorRate)} fill="outline">
                    错误率 {rateLabel(category.stats.errorRate)}
                  </Tag>
                </div>

                <ProgressBar
                  percent={progress}
                  className="mt-3"
                />

                {children.length > 0 && (
                  <List className="mt-3 !rounded-xl">
                    {children.map((child) => (
                      <List.Item
                        key={child.id}
                        description={
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            <Tag color="primary" fill="outline">
                              {child.stats.total} 题
                            </Tag>
                            <Tag
                              color={rateColor(child.stats.errorRate)}
                              fill="outline"
                            >
                              错误率 {rateLabel(child.stats.errorRate)}
                            </Tag>
                          </div>
                        }
                        extra={
                          <div className="flex gap-1">
                            <Button
                              size="mini"
                              fill="none"
                              color="primary"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditCategory(child);
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
                                handleDelete(child);
                              }}
                            >
                              删除
                            </Button>
                          </div>
                        }
                        onClick={() =>
                          navigate(`/exams/${examId}/categories/${child.id}`)
                        }
                      >
                        {child.name}
                      </List.Item>
                    ))}
                  </List>
                )}

                <Button
                  block
                  size="small"
                  fill="none"
                  color="primary"
                  className="mt-2"
                  onClick={() => openCreateCategory(category)}
                >
                  ＋ 新增子类目
                </Button>
              </Card>
            );
          })}
        </div>

        <Button
          block
          size="large"
          color="primary"
          fill="outline"
          className="mt-4"
          onClick={() => openCreateCategory()}
        >
          ＋ 新增类目
        </Button>
      </div>

      <CategoryFormPopup
        visible={modalVisible}
        examId={examId}
        category={editingCategory}
        parentCategory={parentCategory}
        onClose={closeModal}
      />
    </main>
  );
}
