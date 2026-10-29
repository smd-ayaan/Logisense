import React, { createContext, useContext, useState, useCallback } from 'react';
import { saveAuth, clearAuth, getUser, getToken, AuthUser } from '@/lib/auth';
import api from '@/lib/api';

interface AuthCtx {
  user:    AuthUser | null;
  isAuth:  boolean;
  login:   (email: string, password: string) => Promise<void>;
  logout:  () => void;
}

const AuthContext = createContext<AuthCtx>({} as AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getUser());

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post('/api/v1/auth/login', { email, password });
    const { access_token, role, full_name } = res.data;
    const u: AuthUser = { email, role, full_name };
    saveAuth(access_token, u);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuth: !!user && !!getToken(), login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
