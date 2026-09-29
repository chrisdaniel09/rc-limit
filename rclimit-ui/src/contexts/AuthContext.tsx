import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';

interface User {
  userId: string;
  email: string;
  fullName: string;
  tenantId: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
}

type AuthAction =
  | { type: 'LOGIN'; payload: { token: string; user: User } }
  | { type: 'LOGOUT' }
  | { type: 'SET_USER'; payload: User };

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, phoneNumber: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN':
      return { token: action.payload.token, user: action.payload.user, isAuthenticated: true };
    case 'LOGOUT':
      return { token: null, user: null, isAuthenticated: false };
    case 'SET_USER':
      return { ...state, user: action.payload };
    default:
      return state;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, {
    token: null,
    user: null,
    isAuthenticated: false,
  });

  useEffect(() => {
    const token = localStorage.getItem('rclimit_token');
    const userJson = localStorage.getItem('rclimit_user');
    if (token && userJson) {
      try {
        const user = JSON.parse(userJson) as User;
        dispatch({ type: 'LOGIN', payload: { token, user } });
      } catch {
        localStorage.removeItem('rclimit_token');
        localStorage.removeItem('rclimit_user');
      }
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || 'Invalid credentials');
    }
    const raw = await res.json();
    const data = raw.data ?? raw;
    localStorage.setItem('rclimit_token', data.accessToken);
    localStorage.setItem('rclimit_refresh', data.refreshToken);
    localStorage.setItem('rclimit_user', JSON.stringify(data.user));
    dispatch({ type: 'LOGIN', payload: { token: data.accessToken, user: data.user } });
  };

  const register = async (email: string, password: string, fullName: string, phoneNumber: string) => {
    const res = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName, phoneNumber }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || 'Registration failed');
    }
    const raw = await res.json();
    const data = raw.data ?? raw;
    localStorage.setItem('rclimit_token', data.accessToken);
    localStorage.setItem('rclimit_refresh', data.refreshToken);
    localStorage.setItem('rclimit_user', JSON.stringify(data.user));
    dispatch({ type: 'LOGIN', payload: { token: data.accessToken, user: data.user } });
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('rclimit_refresh');
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.token}`,
        },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // ignore logout API errors
    }
    localStorage.removeItem('rclimit_token');
    localStorage.removeItem('rclimit_refresh');
    localStorage.removeItem('rclimit_user');
    dispatch({ type: 'LOGOUT' });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
