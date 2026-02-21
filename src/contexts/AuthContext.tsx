import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, getCurrentUser, login as doLogin, signup as doSignup, logout as doLogout } from '@/lib/storage';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => string | true;
  signup: (email: string, username: string, password: string) => string | true;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(getCurrentUser());
    setLoading(false);
  }, []);

  const login = (email: string, password: string): string | true => {
    const result = doLogin(email, password);
    if (typeof result === 'string') return result;
    setUser(result);
    return true;
  };

  const signup = (email: string, username: string, password: string): string | true => {
    const result = doSignup(email, username, password);
    if (typeof result === 'string') return result;
    setUser(result);
    return true;
  };

  const logout = () => {
    doLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
