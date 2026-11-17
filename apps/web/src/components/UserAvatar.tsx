import { UserOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';

import type { AuthUser } from '@/types';

type UserAvatarProps = {
  user: Pick<AuthUser, 'avatarUrl' | 'nickname'>;
  size?: number;
  className?: string;
};

export function UserAvatar({ user, size = 40, className = '' }: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const initial = Array.from(user.nickname.trim())[0] ?? '';

  useEffect(() => {
    setImageFailed(false);
  }, [user.avatarUrl]);

  return (
    <span
      className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#eaf1ff] font-semibold text-[#3d7eff] ${className}`}
      style={{ width: size, height: size }}
    >
      {user.avatarUrl && !imageFailed ? (
        <img
          src={user.avatarUrl}
          alt={`${user.nickname || '用户'}的头像`}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : initial ? (
        <span style={{ fontSize: Math.max(12, Math.round(size * 0.4)) }}>{initial}</span>
      ) : (
        <UserOutlined style={{ fontSize: Math.round(size * 0.48) }} />
      )}
    </span>
  );
}
