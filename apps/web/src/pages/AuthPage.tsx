import { Toast } from '@/components/feedback';
import { Button, Form, Input, Tabs } from '@/components/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/useAuth';

type AuthMode = 'login' | 'register';

type AuthFormValues = {
  email: string;
  password: string;
  confirmPassword?: string;
  nickname?: string;
};

export function AuthPage() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === 'register';

  async function handleFinish(values: AuthFormValues) {
    if (!values.email || !values.password) {
      Toast.show({
        icon: 'fail',
        content: '邮箱和密码不能为空',
      });
      return;
    }

    if (isRegister && values.password !== values.confirmPassword) {
      Toast.show({
        icon: 'fail',
        content: '两次输入的密码不一致',
      });
      return;
    }

    setSubmitting(true);
    try {
      if (isRegister) {
        await register({
          email: values.email,
          password: values.password,
          nickname: values.nickname ?? '',
        });
        Toast.show({
          icon: 'success',
          content: '注册成功',
        });
      } else {
        await login({
          email: values.email,
          password: values.password,
        });
        Toast.show({
          icon: 'success',
          content: '登录成功',
        });
      }

      navigate('/', { replace: true });
    } catch (error) {
      Toast.show({
        icon: 'fail',
        content: error instanceof Error ? error.message : '操作失败，请重试',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f6f8] px-5 py-8">
      <section className="mx-auto w-full max-w-[420px]">
        <div className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-[20px] bg-[#3d7eff] text-2xl font-semibold text-white shadow-sm">
            备
          </div>
          <h1 className="mt-4 text-xl font-semibold text-[#26292e]">
            备考助手
          </h1>
          <p className="mt-1 text-sm text-[#9aa0a8]">
            把一整段杂乱文本，变成能练的题
          </p>
        </div>

        <Tabs
          activeKey={mode}
          onChange={(key) => setMode(key as AuthMode)}
          className="mt-7"
        >
          <Tabs.Tab title="登录" key="login" />
          <Tabs.Tab title="注册" key="register" />
        </Tabs>

        <Form
          layout="vertical"
          className="mt-2"
          onFinish={handleFinish}
          footer={
            <Button
              block
              type="submit"
              color="primary"
              size="large"
              loading={submitting}
            >
              {isRegister ? '注册' : '登录'}
            </Button>
          }
        >
          <Form.Item
            name="email"
            label="邮箱"
            rules={[{ required: true, message: '请输入邮箱' }]}
          >
            <Input
              type="email"
              placeholder="you@example.com"
              clearable
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input
              type="password"
              placeholder="请输入密码"
              clearable
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
          </Form.Item>

          {isRegister && (
            <>
              <Form.Item
                name="confirmPassword"
                label="确认密码"
                rules={[{ required: true, message: '请再次输入密码' }]}
              >
                <Input
                  type="password"
                  placeholder="请再次输入密码"
                  clearable
                  autoComplete="new-password"
                />
              </Form.Item>

              <Form.Item name="nickname" label="昵称（选填）">
                <Input
                  type="text"
                  placeholder="如何称呼你"
                  clearable
                  autoComplete="nickname"
                />
              </Form.Item>
            </>
          )}
        </Form>

        {!isRegister && (
          <button
            type="button"
            className="mx-auto mt-3 block bg-transparent text-sm text-[#9aa0a8]"
          >
            忘记密码？
          </button>
        )}
      </section>
    </main>
  );
}
