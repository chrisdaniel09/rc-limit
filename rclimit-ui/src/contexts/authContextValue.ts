import { createContext } from 'react';

export interface Role {
  roleId: string;
  code: string;
  name: string;
}

export interface User {
  userId: string;
  email: string;
  fullName: string;
  tenantId: string;
  roles?: Role[];
  rightCodes?: string[];
}

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRight: (rightCode: string) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
