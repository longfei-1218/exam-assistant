import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import * as api from '@/api/client';
import type { AuthSession, LoginInput, RegisterInput } from '@/types';
import { AuthContext, type AuthContextValue } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() =>
    api.getStoredSession(),
  );

  const login = useCallback(async (input: LoginInput) => {
    const nextSession = await api.login(input);
    setSession(nextSession);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const nextSession = await api.register(input);
    setSession(nextSession);
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
      logout,
    }),
    [login, logout, register, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
