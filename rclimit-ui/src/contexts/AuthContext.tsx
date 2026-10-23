import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadConfig } from '../config';
import { AuthContext, type AuthContextValue, type User } from './authContextValue';
import {
  clearSession,
  loginRequest,
  logoutRequest,
  refreshOnce,
  subscribeSession,
} from '../api/client';

// Other tabs learn about login and logout through this channel.
const sessionChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('rclimit-auth') : null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Mirror the client's session state into React.
  useEffect(() => subscribeSession(setUser), []);

  // Startup: load config, then try a silent refresh through the cookie.
  // Under StrictMode the effect runs twice; refreshOnce shares one request between the two runs.
  useEffect(() => {
    let cancelled = false;

    const initialise = async () => {
      await loadConfig();
      await refreshOnce();
      if (!cancelled) setIsInitializing(false);
    };
    void initialise();

    const onMessage = (event: MessageEvent<string>) => {
      if (event.data === 'logout') clearSession();
      if (event.data === 'login') void refreshOnce();
    };
    sessionChannel?.addEventListener('message', onMessage);

    return () => {
      cancelled = true;
      sessionChannel?.removeEventListener('message', onMessage);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await loginRequest(email, password);
    sessionChannel?.postMessage('login');
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    sessionChannel?.postMessage('logout');
  }, []);

  const hasRight = useCallback(
    (rightCode: string) => user?.rightCodes?.includes(rightCode) ?? false,
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isInitializing,
      login,
      logout,
      hasRight,
    }),
    [user, isInitializing, login, logout, hasRight],
  );

  if (isInitializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-sm font-medium text-gray-500">Loading...</div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
