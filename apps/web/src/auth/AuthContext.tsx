import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import * as api from '@/api/client';
import type { AuthSession, LoginInput, RegisterInput, UpdateProfileInput } from '@/types';
import { AuthContext, type AuthContextValue } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => api.getStoredSession());

  useEffect(() => {
    const handleSessionExpired = () => setSession(null);
    window.addEventListener(
      api.AUTH_SESSION_EXPIRED_EVENT,
      handleSessionExpired,
    );
    return () => {
      window.removeEventListener(
        api.AUTH_SESSION_EXPIRED_EVENT,
        handleSessionExpired,
      );
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const nextSession = await api.login(input);
    setSession(nextSession);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const nextSession = await api.register(input);
    setSession(nextSession);
  }, []);

  const updateProfile = useCallback(async (input: UpdateProfileInput) => {
    const user = await api.updateProfile(input);
    setSession((currentSession) =>
      currentSession
        ? {
            ...currentSession,
            user,
          }
        : currentSession,
    );
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      status: session ? 'authenticated' : 'unauthenticated',
      login,
      register,
      updateProfile,
      logout,
    }),
    [login, logout, register, session, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
