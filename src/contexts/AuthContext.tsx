import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { UserRole } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { apiFetch, setAuthToken, getAuthToken } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string, role: UserRole) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, name: string, role: UserRole) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });
  const { toast } = useToast();

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setState({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    (async () => {
      try {
        const { user } = await apiFetch<{ user: User }>('/api/auth/me');
        setState({ user, isAuthenticated: true, isLoading: false });
      } catch {
        setAuthToken(null);
        setState({ user: null, isAuthenticated: false, isLoading: false });
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string, role: UserRole): Promise<{ success: boolean; error?: string }> => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const { token, user } = await apiFetch<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, role }),
      });
      setAuthToken(token);
      setState({ user, isAuthenticated: true, isLoading: false });
      return { success: true };
    } catch (e) {
      setState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error: String((e as Error)?.message ?? e) };
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string, role: UserRole): Promise<{ success: boolean; error?: string }> => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const { token, user } = await apiFetch<{ token: string; user: User }>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, name, role }),
      });
      setAuthToken(token);
      setState({ user, isAuthenticated: true, isLoading: false });
      return { success: true };
    } catch (e) {
      setState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error: String((e as Error)?.message ?? e) };
    }
  }, []);

  const logout = useCallback(async () => {
    setAuthToken(null);
    setState({ user: null, isAuthenticated: false, isLoading: false });
    toast({
      title: 'Signed out',
      description: 'You have been successfully signed out.',
    });
  }, [toast]);

  const hasRole = useCallback((roles: UserRole[]): boolean => {
    if (!state.user) return false;
    return roles.includes(state.user.role);
  }, [state.user]);

  return (
    <AuthContext.Provider value={{ ...state, login, signup, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
