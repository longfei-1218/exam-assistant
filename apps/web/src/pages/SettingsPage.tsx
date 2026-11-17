import { Dialog, Toast } from '@/components/feedback';
import { Button, Input, NavBar } from '@/components/ui';
import {
  CameraOutlined,
  DownOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useEffect, useState, type ChangeEvent, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';

import { UserAvatar } from '@/components/UserAvatar';
import { useAuth } from '@/auth/useAuth';
import { DEFAULT_LLM_CONFIG, type LlmModel, type LlmProvider } from '@/types';

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('头像读取失败'));
      }
    };
    reader.onerror = () => reject(new Error('头像读取失败'));
    reader.readAsDataURL(file);
  });
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, updateProfile, logout } = useAuth();
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [provider, setProvider] = useState<LlmProvider>(
    user?.llmConfig.provider ?? DEFAULT_LLM_CONFIG.provider,
  );
  const [model, setModel] = useState<LlmModel>(user?.llmConfig.model ?? DEFAULT_LLM_CONFIG.model);
  const [apiToken, setApiToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    setNickname(user.nickname);
    setAvatarUrl(user.avatarUrl);
    setProvider(user.llmConfig.provider);
    setModel(user.llmConfig.model);
    setApiToken('');
  }, [user]);

  if (!user) {
    return null;
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      Toast.show({ icon: 'fail', content: '请选择图片文件' });
      return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
      Toast.show({ icon: 'fail', content: '头像不能超过 2MB' });
      return;
    }

    try {
      setAvatarUrl(await readFileAsDataUrl(file));
    } catch (error) {
      Toast.show({
        icon: 'fail',
        content: error instanceof Error ? error.message : '头像读取失败',
      });
    }
  }

  async function handlePasteToken() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        Toast.show('剪贴板中没有 Token');
        return;
      }

      setApiToken(text.trim());
      Toast.show({ icon: 'success', content: '已粘贴 Token' });
    } catch {
      Toast.show('无法读取剪贴板，请手动粘贴');
    }
  }

  async function handleSave() {
    if (!nickname.trim()) {
      Toast.show({ icon: 'fail', content: '昵称不能为空' });
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        nickname: nickname.trim(),
        avatarUrl,
        llmConfig: {
          provider,
          model,
          apiToken: apiToken.trim() || undefined,
        },
      });
      Toast.show({ icon: 'success', content: '设置已保存' });
    } catch (error) {
      Toast.show({
        icon: 'fail',
        content: error instanceof Error ? error.message : '保存失败',
      });
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    Dialog.confirm({
      content: '退出后需要重新登录，确定退出吗？',
      confirmText: '退出登录',
      cancelText: '取消',
      onConfirm: async () => {
        await logout();
        navigate('/login', { replace: true });
      },
    });
  }

  return (
    <main className="min-h-screen bg-[#f5f6f8] pb-10">
      <NavBar onBack={() => navigate('/')}>个人设置</NavBar>

      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3 px-4 pt-3">
        <section className="rounded-2xl bg-white p-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <UserAvatar user={{ nickname, avatarUrl }} size={82} />
              <label
                htmlFor="avatar-upload"
                aria-label="更换头像"
                className="absolute -bottom-0.5 -right-0.5 grid h-8 w-8 cursor-pointer place-items-center rounded-full border-2 border-white bg-[#3d7eff] text-white shadow-sm"
              >
                <CameraOutlined style={{ fontSize: 16 }} />
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={handleAvatarChange}
              />
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-semibold text-[#26292e]">
                {nickname.trim() || '未设置昵称'}
              </h1>
              <p className="mt-1 truncate text-sm text-[#9aa0a8]">{user.email}</p>
              {avatarUrl && (
                <button
                  type="button"
                  className="mt-2 bg-transparent text-xs text-[#9aa0a8]"
                  onClick={() => setAvatarUrl(null)}
                >
                  移除头像
                </button>
              )}
            </div>
          </div>

          <label htmlFor="nickname" className="mt-5 block text-sm font-medium text-[#26292e]">
            昵称
          </label>
          <Input
            id="nickname"
            value={nickname}
            onChange={setNickname}
            placeholder="请输入昵称"
            clearable
            maxLength={24}
            className="mt-2 rounded-xl border border-[#eceef1] bg-[#f8f9fb] px-3 py-2.5"
          />
        </section>

        <section className="rounded-2xl bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#26292e]">大模型配置</h2>
            <span className="rounded-full bg-[#eaf1ff] px-2.5 py-1 text-xs font-medium text-[#3d7eff]">
              DeepSeek
            </span>
          </div>

          <label htmlFor="llm-provider" className="mt-5 block text-sm font-medium text-[#26292e]">
            模型供应商
          </label>
          <div className="relative mt-2">
            <select
              id="llm-provider"
              value={provider}
              onChange={(event) => setProvider(event.target.value as LlmProvider)}
              className="h-11 w-full appearance-none rounded-xl border border-[#eceef1] bg-[#f8f9fb] px-3 pr-10 text-sm text-[#26292e] outline-none focus:border-[#3d7eff]"
            >
              <option value="deepseek">DeepSeek</option>
            </select>
            <DownOutlined
              style={{ fontSize: 14 }}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9aa0a8]"
            />
          </div>

          <label htmlFor="llm-model" className="mt-4 block text-sm font-medium text-[#26292e]">
            模型名称
          </label>
          <div className="relative mt-2">
            <select
              id="llm-model"
              value={model}
              onChange={(event) => setModel(event.target.value as LlmModel)}
              className="h-11 w-full appearance-none rounded-xl border border-[#eceef1] bg-[#f8f9fb] px-3 pr-10 text-sm text-[#26292e] outline-none focus:border-[#3d7eff]"
            >
              <option value="deepseek-flash">DeepSeek Flash</option>
              <option value="deepseek-chat">DeepSeek Chat</option>
              <option value="deepseek-pro">DeepSeek Pro</option>
            </select>
            <DownOutlined
              style={{ fontSize: 14 }}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9aa0a8]"
            />
          </div>

          <label htmlFor="llm-token" className="mt-4 block text-sm font-medium text-[#26292e]">
            个人模型 API Token
          </label>
          <div className="mt-2 flex items-center rounded-xl border border-[#eceef1] bg-[#f8f9fb] px-3 focus-within:border-[#3d7eff]">
            <Input
              id="llm-token"
              type={showToken ? 'text' : 'password'}
              value={apiToken}
              onChange={setApiToken}
              placeholder={
                user.llmConfig.apiTokenMasked
                  ? `已配置：${user.llmConfig.apiTokenMasked}`
                  : '输入或粘贴 API Token'
              }
              clearable
              className="min-w-0 flex-1"
              style={{ '--font-size': '14px' } as CSSProperties}
            />
            <button
              type="button"
              aria-label={showToken ? '隐藏 Token' : '显示 Token'}
              className="grid h-9 w-9 shrink-0 place-items-center bg-transparent text-[#9aa0a8]"
              onClick={() => setShowToken((current) => !current)}
            >
              {showToken ? (
                <EyeInvisibleOutlined style={{ fontSize: 18 }} />
              ) : (
                <EyeOutlined style={{ fontSize: 18 }} />
              )}
            </button>
            <button
              type="button"
              aria-label="粘贴 Token"
              className="h-9 shrink-0 bg-transparent px-2 text-xs font-medium text-[#3d7eff]"
              onClick={handlePasteToken}
            >
              粘贴
            </button>
          </div>
          <p className="mt-2 text-xs text-[#9aa0a8]">Token 仅保存在当前浏览器</p>
        </section>

        <Button block color="primary" size="large" loading={saving} onClick={handleSave}>
          保存设置
        </Button>

        <Button block fill="none" color="danger" size="large" onClick={handleLogout}>
          退出登录
        </Button>
      </div>
    </main>
  );
}
