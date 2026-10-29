/* Token for auth stored only in sessionStorage — never in localStorage */

const TOKEN_KEY = 'ls_token';
const USER_KEY  = 'ls_user';

export interface AuthUser {
  email:     string;
  full_name: string;
  role:      string;
}

export const saveAuth = (token: string, user: AuthUser) => {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAuth = () => {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
};

export const getToken = (): string | null =>
  sessionStorage.getItem(TOKEN_KEY);

export const getUser = (): AuthUser | null => {
  const raw = sessionStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as AuthUser) : null;
};

export const isAuthenticated = (): boolean => !!getToken();
