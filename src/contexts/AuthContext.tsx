import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export interface User {
  id: string;
  email: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | true>;
  signup: (email: string, password: string, fullName: string) => Promise<string | true>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSupabaseUser(session.user);
        // Fetch user profile
        fetchUserProfile(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setSupabaseUser(session.user);
        fetchUserProfile(session.user.id);
      } else {
        setSupabaseUser(null);
        setUser(null);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return;
    }

    if (data) {
      setUser({
        id: data.id,
        email: data.email || '',
        full_name: data.full_name || undefined,
        avatar_url: data.avatar_url || undefined,
      });
    }
  };

  const login = async (email: string, password: string): Promise<string | true> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return error.message;
      }

      if (data.user) {
        setSupabaseUser(data.user);
        await fetchUserProfile(data.user.id);
        return true;
      }

      return 'Login failed';
    } catch (err) {
      return (err as Error).message;
    }
  };

  const signup = async (email: string, password: string, fullName: string): Promise<string | true> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        return error.message;
      }

      if (data.user) {
        setSupabaseUser(data.user);
        await fetchUserProfile(data.user.id);
        return true;
      }

      return 'Signup failed';
    } catch (err) {
      return (err as Error).message;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSupabaseUser(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, supabaseUser, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
